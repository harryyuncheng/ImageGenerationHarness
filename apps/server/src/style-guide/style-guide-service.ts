import { randomUUID } from 'node:crypto';
import {
  createStyleGuideImageRequestSchema,
  styleGuideFolderNameRequestSchema,
  styleGuideImageNameRequestSchema,
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
import { hasNameConflict, loadDirectoryManifests } from '../repository/manifest-collection.js';
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

type StyleGuideImageWithFolder = StyleGuideImage & { folderName: string };

export interface StyleGuideService {
  list(): Promise<StyleGuideFolderWithImages[]>;
  createFolder(name: string): Promise<StyleGuideFolder>;
  renameFolder(folderId: string, name: string): Promise<void>;
  deleteFolder(folderId: string): Promise<void>;
  createImage(folderId: string, input: CreateStyleGuideImageRequest): Promise<StyleGuideImage>;
  getImageById(
    repository: LocalImageRepository,
    imageId: string,
  ): Promise<StyleGuideImageWithFolder | undefined>;
  readImage(
    folderId: string,
    imageId: string,
  ): Promise<{ image: StyleGuideImage; bytes: Uint8Array }>;
  renameImage(folderId: string, imageId: string, name: string): Promise<void>;
  deleteImage(folderId: string, imageId: string): Promise<void>;
}

export class LocalStyleGuideService implements StyleGuideService {
  constructor(private readonly manager: LocalRepositoryManager) {}

  async list(): Promise<StyleGuideFolderWithImages[]> {
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
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
      }),
    );
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
        if (hasNameConflict(folders, validatedName)) {
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
          hasNameConflict(folders, validatedName, (candidate) => candidate.folderId === folderId)
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
    const repository = this.manager.getActiveRepository();
    let imageData: CharacterizedImage;
    try {
      imageData = await characterizeImageData(validated.data, { label: 'Style guide image data' });
    } catch {
      throw new StyleGuideError('The uploaded file is not a valid PNG, JPEG, or WebP image.', 400);
    }
    if (imageData.mediaType !== validated.mediaType) {
      throw new StyleGuideError('The image content does not match its declared media type.', 400);
    }

    return repository.withMutation(async () => {
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
    });
  }

  async getImageById(
    repository: LocalImageRepository,
    imageId: string,
  ): Promise<StyleGuideImageWithFolder | undefined> {
    return repository.withMutation(async () => {
      const found: StyleGuideImageWithFolder[] = [];
      for (const folder of await this.#loadFolders(repository)) {
        found.push(
          ...(await this.#loadImages(repository, folder))
            .filter((image) => image.imageId === imageId)
            .map((image) => ({ ...image, folderName: folder.name })),
        );
      }
      if (found.length > 1) {
        throw new StyleGuideError('Duplicate style guide image identifiers were found.', 409);
      }
      return found.at(0);
    });
  }

  async readImage(
    folderId: string,
    imageId: string,
  ): Promise<{ image: StyleGuideImage; bytes: Uint8Array }> {
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const folder = await this.#requireFolder(repository, folderId);
        const image = await this.#requireImage(repository, folder, imageId);
        const bytes = await repository.readBytes(image.repositoryRelativePath);
        if (!imageBytesMatch(bytes, image.sha256, image.byteLength)) {
          throw new StyleGuideError('Style guide image integrity verification failed.', 409);
        }
        return { image, bytes };
      }),
    );
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

  async #loadFolders(repository: LocalImageRepository): Promise<StyleGuideFolder[]> {
    const folders = await loadDirectoryManifests(repository, styleGuideFoldersCollection);
    if (new Set(folders.map((folder) => folder.folderId)).size !== folders.length) {
      throw new StyleGuideError('Duplicate style guide identifiers were found.', 409);
    }
    return folders;
  }

  async #requireFolder(
    repository: LocalImageRepository,
    folderId: string,
  ): Promise<StyleGuideFolder> {
    const folder = (await this.#loadFolders(repository)).find(
      (candidate) => candidate.folderId === folderId,
    );
    if (!folder) throw new StyleGuideError('Style guide not found.', 404);
    return folder;
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
      if (
        styleGuideSidecarPath(image.repositoryRelativePath) !== `${folder.directory}/${fileName}` ||
        !files.includes(image.repositoryRelativePath.slice(folder.directory.length + 1)) ||
        images.some((candidate) => candidate.imageId === image.imageId)
      ) {
        throw new StyleGuideError('A style guide image has an invalid sidecar binding.', 409);
      }
      images.push(image);
    }
    return images;
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
