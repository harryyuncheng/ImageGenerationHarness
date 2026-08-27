import { randomUUID } from 'node:crypto';
import {
  createStyleGuideImageRequestSchema,
  styleGuideFolderNameRequestSchema,
  styleGuideImageNameRequestSchema,
  uuidSchema,
  type CreateStyleGuideImageRequest,
} from '@harness/contracts';
import {
  styleGuideFolderSchema,
  styleGuideImageSchema,
  SCHEMA_VERSION,
  type StyleGuideFolder,
  type StyleGuideImage,
} from '@harness/domain';
import { characterizeImageData, imageBytesMatch, type CharacterizedImage } from '@harness/image';
import {
  findDirectoryManifest,
  hasActiveNameConflict,
  loadDirectoryManifests,
  requireDirectoryManifest,
} from '../repository/manifest-collection.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import type { LocalRepositoryManager } from '../repository/repository-manager.js';
import { safeSlug } from '../repository/slug.js';
import {
  assertImageBinding,
  imageSlug,
  styleGuideFoldersCollection,
  StyleGuideError,
  styleGuideSidecarPath,
} from './style-guide-records.js';

interface StyleGuideFolderWithImages {
  folder: StyleGuideFolder;
  images: StyleGuideImage[];
}

export interface StyleGuideService {
  list(): Promise<StyleGuideFolderWithImages[]>;
  createFolder(name: string): Promise<StyleGuideFolder>;
  renameFolder(folderId: string, name: string): Promise<void>;
  deleteFolder(folderId: string): Promise<void>;
  createImage(folderId: string, input: CreateStyleGuideImageRequest): Promise<StyleGuideImage>;
  getImage(folderId: string, imageId: string): Promise<StyleGuideImage | undefined>;
  getImageById(imageId: string): Promise<StyleGuideImage | undefined>;
  readImage(imageOrRelativePath: StyleGuideImage | string): Promise<Uint8Array>;
  renameImage(folderId: string, imageId: string, name: string): Promise<void>;
  deleteImage(folderId: string, imageId: string): Promise<void>;
}

export class LocalStyleGuideService implements StyleGuideService {
  constructor(private readonly manager: LocalRepositoryManager) {}

  async list(): Promise<StyleGuideFolderWithImages[]> {
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

  async createFolder(name: string): Promise<StyleGuideFolder> {
    let validatedName: string;
    try {
      validatedName = styleGuideFolderNameRequestSchema.parse({ name }).name;
    } catch {
      throw new StyleGuideError('Invalid style guide name.', 400);
    }
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folders = await this.#loadFolders(repository);
        if (hasActiveNameConflict(folders, validatedName)) {
          throw new StyleGuideError('A style guide already has that name.', 409);
        }
        const folderId = randomUUID();
        const now = new Date().toISOString();
        const directory = `style-guide/${safeSlug(validatedName)}--${folderId}`;
        const folder = styleGuideFolderSchema.parse({
          schemaVersion: SCHEMA_VERSION,
          folderId,
          name: validatedName,
          directory,
          createdAt: now,
          updatedAt: now,
        });
        await repository.ensureDirectory(directory);
        await repository.writeJson(`${directory}/folder.json`, folder, styleGuideFolderSchema);
        return folder;
      }),
    );
  }

  async renameFolder(folderId: string, name: string): Promise<void> {
    let validatedName: string;
    try {
      validatedName = styleGuideFolderNameRequestSchema.parse({ name }).name;
    } catch {
      throw new StyleGuideError('Invalid style guide name.', 400);
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
          throw new StyleGuideError('A style guide already has that name.', 409);
        }
        const updated = styleGuideFolderSchema.parse({
          ...folder,
          name: validatedName,
          updatedAt: new Date().toISOString(),
        });
        await repository.writeJson(
          `${folder.directory}/folder.json`,
          updated,
          styleGuideFolderSchema,
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

  async createImage(
    folderId: string,
    input: CreateStyleGuideImageRequest,
  ): Promise<StyleGuideImage> {
    let validated: CreateStyleGuideImageRequest;
    try {
      validated = createStyleGuideImageRequestSchema.parse(input);
    } catch {
      throw new StyleGuideError('Invalid style guide image.', 400);
    }
    let imageData: CharacterizedImage;
    try {
      imageData = await characterizeImageData(validated.data, { label: 'Style guide image data' });
    } catch {
      throw new StyleGuideError('The uploaded file is not a valid PNG, JPEG, or WebP image.', 400);
    }
    if (imageData.mediaType !== validated.mediaType) {
      throw new StyleGuideError('The image content does not match its declared media type.', 400);
    }

    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folder = await this.#requireFolder(repository, folderId);
        const imageId = randomUUID();
        const now = new Date().toISOString();
        const repositoryRelativePath = `${folder.directory}/${imageSlug(validated.name)}--${imageId}.${imageData.extension}`;
        const image = styleGuideImageSchema.parse({
          schemaVersion: SCHEMA_VERSION,
          folderId,
          imageId,
          name: validated.name,
          repositoryRelativePath,
          sha256: imageData.sha256,
          mediaType: imageData.mediaType,
          byteLength: imageData.byteLength,
          width: imageData.width,
          height: imageData.height,
          createdAt: now,
          updatedAt: now,
        });
        await repository.publishImmutableWithSidecar(
          repositoryRelativePath,
          imageData.bytes,
          styleGuideSidecarPath(repositoryRelativePath),
          image,
          styleGuideImageSchema,
        );
        return image;
      }),
    );
  }

  async getImage(folderId: string, imageId: string): Promise<StyleGuideImage | undefined> {
    return this.manager.withRepository(async (repository) => {
      const folder = await this.#findFolder(repository, folderId);
      if (!folder) return undefined;
      return (await this.#loadImages(repository, folder)).find(
        (image) => image.imageId === imageId,
      );
    });
  }

  async getImageById(imageId: string): Promise<StyleGuideImage | undefined> {
    return this.manager.withRepository((repository) =>
      this.#findUniqueImage(
        repository,
        (image) => image.imageId === imageId,
        'Duplicate style guide image identifiers were found.',
      ),
    );
  }

  async readImage(imageOrRelativePath: StyleGuideImage | string): Promise<Uint8Array> {
    const image =
      typeof imageOrRelativePath === 'string'
        ? await this.#findImageForRead(imageOrRelativePath)
        : await this.getImage(imageOrRelativePath.folderId, imageOrRelativePath.imageId);
    if (!image) throw new StyleGuideError('Style guide image not found.', 404);
    if (
      typeof imageOrRelativePath !== 'string' &&
      image.repositoryRelativePath !== imageOrRelativePath.repositoryRelativePath
    ) {
      throw new StyleGuideError('Style guide image record does not match the repository.', 409);
    }
    return this.manager.withRepository(async (repository) => {
      const bytes = await repository.readBytes(image.repositoryRelativePath);
      if (!imageBytesMatch(bytes, image.sha256, image.byteLength)) {
        throw new StyleGuideError('Style guide image integrity verification failed.', 409);
      }
      return bytes;
    });
  }

  async renameImage(folderId: string, imageId: string, name: string): Promise<void> {
    let validatedName: string;
    try {
      validatedName = styleGuideImageNameRequestSchema.parse({ name }).name;
    } catch {
      throw new StyleGuideError('Invalid style guide image name.', 400);
    }
    await this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folder = await this.#requireFolder(repository, folderId);
        const image = await this.#requireImage(repository, folder, imageId);
        const updated = styleGuideImageSchema.parse({
          ...image,
          name: validatedName,
          updatedAt: new Date().toISOString(),
        });
        await repository.writeJson(
          styleGuideSidecarPath(image.repositoryRelativePath),
          updated,
          styleGuideImageSchema,
        );
      }),
    );
  }

  async deleteImage(folderId: string, imageId: string): Promise<void> {
    await this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folder = await this.#requireFolder(repository, folderId);
        const image = await this.#requireImage(repository, folder, imageId);
        await repository.removeRelative(styleGuideSidecarPath(image.repositoryRelativePath));
        await repository.removeRelative(image.repositoryRelativePath);
      }),
    );
  }

  async #findImageForRead(identifier: string): Promise<StyleGuideImage | undefined> {
    if (uuidSchema.safeParse(identifier).success) return this.getImageById(identifier);
    return this.manager.withRepository((repository) =>
      this.#findUniqueImage(
        repository,
        (image) => image.repositoryRelativePath === identifier,
        'Duplicate style guide image paths were found.',
      ),
    );
  }

  #loadFolders(repository: LocalImageRepository): Promise<StyleGuideFolder[]> {
    return loadDirectoryManifests(repository, styleGuideFoldersCollection);
  }

  #findFolder(
    repository: LocalImageRepository,
    folderId: string,
  ): Promise<StyleGuideFolder | undefined> {
    return findDirectoryManifest(repository, styleGuideFoldersCollection, folderId);
  }

  #requireFolder(repository: LocalImageRepository, folderId: string): Promise<StyleGuideFolder> {
    return requireDirectoryManifest(
      repository,
      styleGuideFoldersCollection,
      folderId,
      () => new StyleGuideError('Style guide not found.', 404),
    );
  }

  async #loadImages(
    repository: LocalImageRepository,
    folder: StyleGuideFolder,
  ): Promise<StyleGuideImage[]> {
    const files = await repository.listFiles(folder.directory);
    const images: StyleGuideImage[] = [];
    for (const fileName of files.filter((candidate) => candidate.endsWith('.image.json'))) {
      const image = await repository.readJson(
        `${folder.directory}/${fileName}`,
        styleGuideImageSchema,
      );
      assertImageBinding(image, folder);
      images.push(image);
    }
    return images;
  }

  async #findUniqueImage(
    repository: LocalImageRepository,
    matches: (image: StyleGuideImage) => boolean,
    duplicateMessage: string,
  ): Promise<StyleGuideImage | undefined> {
    const found: StyleGuideImage[] = [];
    for (const folder of await this.#loadFolders(repository)) {
      found.push(...(await this.#loadImages(repository, folder)).filter(matches));
    }
    if (found.length > 1) throw new StyleGuideError(duplicateMessage, 409);
    return found.at(0);
  }

  async #requireImage(
    repository: LocalImageRepository,
    folder: StyleGuideFolder,
    imageId: string,
  ): Promise<StyleGuideImage> {
    const image = (await this.#loadImages(repository, folder)).find(
      (candidate) => candidate.imageId === imageId,
    );
    if (!image) throw new StyleGuideError('Style guide image not found.', 404);
    return image;
  }
}
