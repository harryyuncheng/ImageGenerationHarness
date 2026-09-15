import { randomUUID } from 'node:crypto';
import {
  createPresetRequestSchema,
  MAX_IMAGE_BYTES,
  updatePresetRequestSchema,
  type CreatePresetRequest,
  type PresetCoverRequest,
  type UpdatePresetRequest,
} from '@harness/contracts';
import {
  IMAGE_SIDECAR_SCHEMA_VERSION,
  presetCoverImageSchema,
  presetSchema,
  SCHEMA_VERSION,
  type Preset,
  type PresetCoverImage,
} from '@harness/domain';
import {
  characterizeImageData,
  imageBytesMatch,
  imageSidecarPath,
  type CharacterizedImage,
} from '@harness/image';
import { ZodError } from 'zod';
import { ApiError } from '../app/api-error.js';
import { GeneratedImageStore } from '../images/generated-image-store.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import { loadDirectoryManifests } from '../repository/manifest-collection.js';
import type { LocalRepositoryManager } from '../repository/repository-manager.js';
import { safeSlug } from '../repository/slug.js';
import { loadPresetCover, presetsCollection } from './preset-records.js';

interface PresetWithCover {
  preset: Preset;
  cover: PresetCoverImage | undefined;
}

export interface PresetService {
  list(): Promise<PresetWithCover[]>;
  create(input: CreatePresetRequest): Promise<PresetWithCover>;
  update(presetId: string, input: UpdatePresetRequest): Promise<PresetWithCover>;
  delete(presetId: string): Promise<void>;
  readCover(
    presetId: string,
    imageId?: string,
  ): Promise<{ cover: PresetCoverImage; bytes: Uint8Array }>;
}

export class LocalPresetService implements PresetService {
  readonly #images: GeneratedImageStore;

  constructor(private readonly manager: LocalRepositoryManager) {
    this.#images = new GeneratedImageStore(manager);
  }

  async list(): Promise<PresetWithCover[]> {
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () =>
        Promise.all(
          (await this.#loadPresets(repository))
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .map(async (preset) => ({
              preset,
              cover: await loadPresetCover(repository, preset),
            })),
        ),
      ),
    );
  }

  async create(input: CreatePresetRequest): Promise<PresetWithCover> {
    const validated = createPresetRequestSchema.parse(input);
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        await this.#loadPresets(repository);
        const imageData = validated.cover
          ? await this.#readCoverData(repository, validated.cover)
          : undefined;
        const presetId = randomUUID();
        const now = new Date().toISOString();
        let preset = presetSchema.parse({
          schemaVersion: SCHEMA_VERSION,
          presetId,
          name: validated.name,
          prompt: validated.prompt,
          directory: `presets/${safeSlug(validated.name)}--${presetId}`,
          createdAt: now,
          updatedAt: now,
        });
        let cover: PresetCoverImage | undefined;
        try {
          await repository.writeJson(`${preset.directory}/preset.json`, preset, presetSchema);
          if (imageData) {
            cover = await this.#publishCover(repository, preset, imageData);
            preset = presetSchema.parse({ ...preset, coverImageId: cover.imageId });
            await repository.writeJson(`${preset.directory}/preset.json`, preset, presetSchema);
          }
        } catch (error) {
          await repository.removeRelative(preset.directory, { recursive: true, missingOk: true });
          throw error;
        }
        return { preset, cover };
      }),
    );
  }

  async update(presetId: string, input: UpdatePresetRequest): Promise<PresetWithCover> {
    const validated = updatePresetRequestSchema.parse(input);
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const previous = await this.#requirePreset(repository, presetId);
        let cover = previous.cover;
        if (validated.cover === null) {
          cover = undefined;
        } else if (validated.cover) {
          const imageData = await this.#readCoverData(repository, validated.cover);
          cover = await this.#publishCover(repository, previous.preset, imageData);
        }
        const preset = presetSchema.parse({
          ...previous.preset,
          name: validated.name,
          prompt: validated.prompt,
          coverImageId: cover?.imageId,
          updatedAt: new Date().toISOString(),
        });
        const manifestPath = `${preset.directory}/preset.json`;
        let committed = false;
        try {
          await repository.writeJson(manifestPath, preset, presetSchema);
          committed = true;
        } finally {
          // A failed directory sync can still leave the new manifest committed.
          if (!committed) {
            const current = await repository.readJson(manifestPath, presetSchema);
            committed = JSON.stringify(current) === JSON.stringify(preset);
          }
          const discarded = committed ? previous.cover : cover;
          const retained = committed ? cover : previous.cover;
          if (discarded && discarded.imageId !== retained?.imageId) {
            await this.#removeCover(repository, discarded);
          }
        }
        return { preset, cover };
      }),
    );
  }

  async delete(presetId: string): Promise<void> {
    await this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const { preset } = await this.#requirePreset(repository, presetId);
        await repository.removeRelative(preset.directory, { recursive: true });
      }),
    );
  }

  async readCover(
    presetId: string,
    imageId?: string,
  ): Promise<{ cover: PresetCoverImage; bytes: Uint8Array }> {
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const { cover } = await this.#requirePreset(repository, presetId);
        if (!cover || (imageId !== undefined && cover.imageId !== imageId)) {
          throw new ApiError(404, 'Preset cover not found.');
        }
        const bytes = await repository.readBytes(cover.repositoryRelativePath);
        if (!imageBytesMatch(bytes, cover.sha256, cover.byteLength)) {
          throw new ApiError(409, 'Preset cover integrity verification failed.');
        }
        return { cover, bytes };
      }),
    );
  }

  async #loadPresets(repository: LocalImageRepository): Promise<Preset[]> {
    let presets: Preset[];
    try {
      presets = await loadDirectoryManifests(repository, presetsCollection);
    } catch (error) {
      if (error instanceof ZodError || error instanceof SyntaxError) {
        throw new ApiError(409, 'The preset library contains an invalid preset manifest.');
      }
      throw error;
    }
    if (new Set(presets.map((preset) => preset.presetId)).size !== presets.length) {
      throw new ApiError(409, 'The preset library contains duplicate preset manifests.');
    }
    for (const name of await repository.listDirectories('presets')) {
      const directory = `presets/${name}`;
      if (presets.some((preset) => preset.directory === directory)) continue;
      if (
        (await repository.listFiles(directory)).length > 0 ||
        (await repository.listDirectories(directory)).length > 0
      ) {
        throw new ApiError(409, 'The preset library contains a missing preset manifest.');
      }
    }
    return presets;
  }

  async #requirePreset(
    repository: LocalImageRepository,
    presetId: string,
  ): Promise<PresetWithCover> {
    const preset = (await this.#loadPresets(repository)).find(
      (candidate) => candidate.presetId === presetId,
    );
    if (!preset) throw new ApiError(404, 'Preset not found.');
    return { preset, cover: await loadPresetCover(repository, preset) };
  }

  async #readCoverData(
    repository: LocalImageRepository,
    input: PresetCoverRequest,
  ): Promise<CharacterizedImage> {
    let data: string;
    let mediaType;
    if (input.source === 'gallery') {
      const image = await this.#images.getImage(input.imageId, repository);
      if (!image) throw new ApiError(404, 'Gallery image not found.');
      if (image.byteLength > MAX_IMAGE_BYTES) {
        throw new ApiError(400, 'Preset covers must be no larger than 10 MB.');
      }
      data = Buffer.from(await this.#images.readImage(image)).toString('base64');
      mediaType = image.mediaType;
    } else {
      data = input.data;
      mediaType = input.mediaType;
    }
    let imageData: CharacterizedImage;
    try {
      imageData = await characterizeImageData(data, { label: 'Preset cover image data' });
    } catch {
      throw new ApiError(400, 'Preset covers must be valid PNG, JPEG, or WebP images up to 10 MB.');
    }
    if (imageData.mediaType !== mediaType) {
      throw new ApiError(400, 'The cover image content does not match its declared media type.');
    }
    return imageData;
  }

  async #publishCover(
    repository: LocalImageRepository,
    preset: Preset,
    imageData: CharacterizedImage,
  ): Promise<PresetCoverImage> {
    const imageId = randomUUID();
    const cover = presetCoverImageSchema.parse({
      schemaVersion: IMAGE_SIDECAR_SCHEMA_VERSION,
      presetId: preset.presetId,
      imageId,
      repositoryRelativePath: `${preset.directory}/cover--${imageId}.${imageData.extension}`,
      sha256: imageData.sha256,
      mediaType: imageData.mediaType,
      byteLength: imageData.byteLength,
      width: imageData.width,
      height: imageData.height,
      createdAt: new Date().toISOString(),
    });
    try {
      await repository.publishImmutableWithSidecar(
        cover.repositoryRelativePath,
        imageData.bytes,
        imageSidecarPath(cover.repositoryRelativePath),
        cover,
        presetCoverImageSchema,
      );
    } catch (error) {
      await this.#removeCover(repository, cover);
      throw error;
    }
    return cover;
  }

  async #removeCover(repository: LocalImageRepository, cover: PresetCoverImage): Promise<void> {
    await Promise.all(
      [imageSidecarPath(cover.repositoryRelativePath), cover.repositoryRelativePath].map((path) =>
        repository.removeRelative(path, { missingOk: true }),
      ),
    );
  }
}
