import { randomUUID } from 'node:crypto';
import {
  createReferenceImageRequestSchema,
  referenceFolderNameRequestSchema,
  referenceImageNameRequestSchema,
  uuidSchema,
  type CreateReferenceImageRequest,
} from '@harness/contracts';
import {
  referenceFolderSchema,
  referenceImageSchema,
  SCHEMA_VERSION,
  type ReferenceFolder,
  type ReferenceImage,
} from '@harness/domain';
import {
  decodeCanonicalBase64,
  imageSidecarPath,
  inspectImage,
  mediaTypeFromImageFormat,
  outputFileForMediaType,
  sha256Hex,
} from '@harness/image';
import {
  findDirectoryManifest,
  hasActiveNameConflict,
  loadDirectoryManifests,
  requireDirectoryManifest,
  type DirectoryManifestCollection,
} from './manifest-collection.js';
import {
  type LocalImageRepository,
  type LocalRepositoryManager,
  safeSlug,
} from './local-repository.js';

interface ReferenceFolderWithImages {
  folder: ReferenceFolder;
  images: ReferenceImage[];
}

export interface ReferenceLibraryService {
  list(): Promise<ReferenceFolderWithImages[]>;
  createFolder(name: string): Promise<ReferenceFolder>;
  renameFolder(folderId: string, name: string): Promise<void>;
  deleteFolder(folderId: string): Promise<void>;
  createImage(folderId: string, input: CreateReferenceImageRequest): Promise<ReferenceImage>;
  getImage(folderId: string, imageId: string): Promise<ReferenceImage | undefined>;
  getImageById(imageId: string): Promise<ReferenceImage | undefined>;
  readImage(imageOrRelativePath: ReferenceImage | string): Promise<Uint8Array>;
  renameImage(folderId: string, imageId: string, name: string): Promise<void>;
  deleteImage(folderId: string, imageId: string): Promise<void>;
}

export class ReferenceLibraryError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'ReferenceLibraryError';
  }
}

function imageSlug(name: string): string {
  return safeSlug(name.replace(/\.(?:jpe?g|png|webp)$/iu, ''));
}

function referenceSidecarPath(repositoryRelativePath: string): string {
  try {
    return imageSidecarPath(repositoryRelativePath);
  } catch {
    throw new ReferenceLibraryError('Reference image record has an invalid path.', 409);
  }
}

function assertImageBinding(image: ReferenceImage, folder: ReferenceFolder): void {
  const expectedPrefix = `${folder.directory}/`;
  const fileName = image.repositoryRelativePath.slice(expectedPrefix.length);
  const extension = outputFileForMediaType(image.mediaType).extension;
  if (
    image.folderId !== folder.folderId ||
    !image.repositoryRelativePath.startsWith(expectedPrefix) ||
    fileName.includes('/') ||
    !fileName.includes(`--${image.imageId}.`) ||
    !image.repositoryRelativePath.endsWith(`.${extension}`)
  ) {
    throw new ReferenceLibraryError(
      'A reference image manifest has an invalid folder or file binding.',
      409,
    );
  }
}

const referenceFoldersCollection: DirectoryManifestCollection<ReferenceFolder> = {
  root: 'references',
  manifestName: 'folder.json',
  schema: referenceFolderSchema,
  identifier: (folder) => folder.folderId,
  validateBinding: (folder, directory, directoryName) => {
    if (folder.directory !== directory || !directoryName.endsWith(`--${folder.folderId}`)) {
      throw new ReferenceLibraryError(
        'A reference folder manifest has an invalid directory binding.',
        409,
      );
    }
  },
};

export class LocalReferenceLibraryService implements ReferenceLibraryService {
  constructor(private readonly manager: LocalRepositoryManager) {}

  async list(): Promise<ReferenceFolderWithImages[]> {
    return this.manager.withRepository(async (repository) => {
      const folders = await this.#loadFolders(repository);
      const result = await Promise.all(
        folders.map(async (folder) => ({
          folder,
          images: (await this.#loadImages(repository, folder)).sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
          ),
        })),
      );
      return result.sort((left, right) =>
        left.folder.createdAt.localeCompare(right.folder.createdAt),
      );
    });
  }

  async createFolder(name: string): Promise<ReferenceFolder> {
    let validatedName: string;
    try {
      validatedName = referenceFolderNameRequestSchema.parse({ name }).name;
    } catch {
      throw new ReferenceLibraryError('Invalid reference folder name.', 400);
    }
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folders = await this.#loadFolders(repository);
        if (hasActiveNameConflict(folders, validatedName)) {
          throw new ReferenceLibraryError('A reference folder already has that name.', 409);
        }
        const folderId = randomUUID();
        const now = new Date().toISOString();
        const directory = `references/${safeSlug(validatedName)}--${folderId}`;
        const folder = referenceFolderSchema.parse({
          schemaVersion: SCHEMA_VERSION,
          folderId,
          name: validatedName,
          directory,
          createdAt: now,
          updatedAt: now,
        });
        await repository.ensureDirectory(directory);
        await repository.writeJson(`${directory}/folder.json`, folder, referenceFolderSchema);
        return folder;
      }),
    );
  }

  async renameFolder(folderId: string, name: string): Promise<void> {
    let validatedName: string;
    try {
      validatedName = referenceFolderNameRequestSchema.parse({ name }).name;
    } catch {
      throw new ReferenceLibraryError('Invalid reference folder name.', 400);
    }
    await this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folder = await this.#requireFolder(repository, folderId);
        const folders = await this.#loadFolders(repository);
        if (
          hasActiveNameConflict(
            folders,
            validatedName,
            (candidate) => candidate.folderId === folderId,
          )
        ) {
          throw new ReferenceLibraryError('A reference folder already has that name.', 409);
        }
        const updated = referenceFolderSchema.parse({
          ...folder,
          name: validatedName,
          updatedAt: new Date().toISOString(),
        });
        await repository.writeJson(
          `${folder.directory}/folder.json`,
          updated,
          referenceFolderSchema,
        );
      }),
    );
  }

  async deleteFolder(folderId: string): Promise<void> {
    await this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folder = await this.#requireFolder(repository, folderId);
        await repository.removeRelative(folder.directory, { recursive: true });
      }),
    );
  }

  async createImage(folderId: string, input: CreateReferenceImageRequest): Promise<ReferenceImage> {
    let validated: CreateReferenceImageRequest;
    try {
      validated = createReferenceImageRequestSchema.parse(input);
    } catch {
      throw new ReferenceLibraryError('Invalid reference image.', 400);
    }
    let bytes: Uint8Array;
    try {
      bytes = decodeCanonicalBase64(validated.data, { label: 'Reference image data' });
    } catch {
      throw new ReferenceLibraryError('Reference image data is not valid base64.', 400);
    }
    let inspected: Awaited<ReturnType<typeof inspectImage>>;
    try {
      inspected = await inspectImage(bytes);
    } catch {
      throw new ReferenceLibraryError(
        'The uploaded file is not a valid PNG, JPEG, or WebP image.',
        400,
      );
    }
    const detectedMediaType = mediaTypeFromImageFormat(inspected.format);
    if (!detectedMediaType || detectedMediaType !== validated.mediaType) {
      throw new ReferenceLibraryError(
        'The image content does not match its declared media type.',
        400,
      );
    }

    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folder = await this.#requireFolder(repository, folderId);
        const imageId = randomUUID();
        const now = new Date().toISOString();
        const extension = outputFileForMediaType(detectedMediaType).extension;
        const repositoryRelativePath = `${folder.directory}/${imageSlug(validated.name)}--${imageId}.${extension}`;
        const image = referenceImageSchema.parse({
          schemaVersion: SCHEMA_VERSION,
          folderId,
          imageId,
          name: validated.name,
          repositoryRelativePath,
          sha256: sha256Hex(bytes),
          mediaType: detectedMediaType,
          byteLength: bytes.byteLength,
          width: inspected.width,
          height: inspected.height,
          createdAt: now,
          updatedAt: now,
        });
        await repository.publishImmutableWithSidecar(
          repositoryRelativePath,
          bytes,
          referenceSidecarPath(repositoryRelativePath),
          image,
          referenceImageSchema,
        );
        return image;
      }),
    );
  }

  async getImage(folderId: string, imageId: string): Promise<ReferenceImage | undefined> {
    return this.manager.withRepository(async (repository) => {
      const folder = await this.#findFolder(repository, folderId);
      if (!folder) return undefined;
      return (await this.#loadImages(repository, folder)).find(
        (image) => image.imageId === imageId,
      );
    });
  }

  async getImageById(imageId: string): Promise<ReferenceImage | undefined> {
    return this.manager.withRepository((repository) =>
      this.#findUniqueImage(
        repository,
        (image) => image.imageId === imageId,
        'Duplicate reference image identifiers were found.',
      ),
    );
  }

  async readImage(imageOrRelativePath: ReferenceImage | string): Promise<Uint8Array> {
    const image =
      typeof imageOrRelativePath === 'string'
        ? await this.#findImageForRead(imageOrRelativePath)
        : await this.getImage(imageOrRelativePath.folderId, imageOrRelativePath.imageId);
    if (!image) throw new ReferenceLibraryError('Reference image not found.', 404);
    if (
      typeof imageOrRelativePath !== 'string' &&
      image.repositoryRelativePath !== imageOrRelativePath.repositoryRelativePath
    ) {
      throw new ReferenceLibraryError('Reference image record does not match the repository.', 409);
    }
    return this.manager.withRepository(async (repository) => {
      const bytes = await repository.readBytes(image.repositoryRelativePath);
      if (bytes.byteLength !== image.byteLength || sha256Hex(bytes) !== image.sha256) {
        throw new ReferenceLibraryError('Reference image integrity verification failed.', 409);
      }
      return bytes;
    });
  }

  async renameImage(folderId: string, imageId: string, name: string): Promise<void> {
    let validatedName: string;
    try {
      validatedName = referenceImageNameRequestSchema.parse({ name }).name;
    } catch {
      throw new ReferenceLibraryError('Invalid reference image name.', 400);
    }
    await this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folder = await this.#requireFolder(repository, folderId);
        const image = await this.#requireImage(repository, folder, imageId);
        const updated = referenceImageSchema.parse({
          ...image,
          name: validatedName,
          updatedAt: new Date().toISOString(),
        });
        await repository.writeJson(
          referenceSidecarPath(image.repositoryRelativePath),
          updated,
          referenceImageSchema,
        );
      }),
    );
  }

  async deleteImage(folderId: string, imageId: string): Promise<void> {
    await this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folder = await this.#requireFolder(repository, folderId);
        const image = await this.#requireImage(repository, folder, imageId);
        await repository.removeRelative(referenceSidecarPath(image.repositoryRelativePath));
        await repository.removeRelative(image.repositoryRelativePath);
      }),
    );
  }

  async #findImageForRead(identifier: string): Promise<ReferenceImage | undefined> {
    if (uuidSchema.safeParse(identifier).success) return this.getImageById(identifier);
    return this.manager.withRepository((repository) =>
      this.#findUniqueImage(
        repository,
        (image) => image.repositoryRelativePath === identifier,
        'Duplicate reference image paths were found.',
      ),
    );
  }

  #loadFolders(repository: LocalImageRepository): Promise<ReferenceFolder[]> {
    return loadDirectoryManifests(repository, referenceFoldersCollection);
  }

  #findFolder(
    repository: LocalImageRepository,
    folderId: string,
  ): Promise<ReferenceFolder | undefined> {
    return findDirectoryManifest(repository, referenceFoldersCollection, folderId);
  }

  #requireFolder(repository: LocalImageRepository, folderId: string): Promise<ReferenceFolder> {
    return requireDirectoryManifest(
      repository,
      referenceFoldersCollection,
      folderId,
      () => new ReferenceLibraryError('Reference folder not found.', 404),
    );
  }

  async #loadImages(
    repository: LocalImageRepository,
    folder: ReferenceFolder,
  ): Promise<ReferenceImage[]> {
    const files = await repository.listFiles(folder.directory);
    const images: ReferenceImage[] = [];
    for (const fileName of files.filter((candidate) => candidate.endsWith('.image.json'))) {
      const image = await repository.readJson(
        `${folder.directory}/${fileName}`,
        referenceImageSchema,
      );
      assertImageBinding(image, folder);
      images.push(image);
    }
    return images;
  }

  async #findUniqueImage(
    repository: LocalImageRepository,
    matches: (image: ReferenceImage) => boolean,
    duplicateMessage: string,
  ): Promise<ReferenceImage | undefined> {
    const found: ReferenceImage[] = [];
    for (const folder of await this.#loadFolders(repository)) {
      found.push(...(await this.#loadImages(repository, folder)).filter(matches));
    }
    if (found.length > 1) throw new ReferenceLibraryError(duplicateMessage, 409);
    return found.at(0);
  }

  async #requireImage(
    repository: LocalImageRepository,
    folder: ReferenceFolder,
    imageId: string,
  ): Promise<ReferenceImage> {
    const image = (await this.#loadImages(repository, folder)).find(
      (candidate) => candidate.imageId === imageId,
    );
    if (!image) throw new ReferenceLibraryError('Reference image not found.', 404);
    return image;
  }
}
