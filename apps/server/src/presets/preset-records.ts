import {
  presetCoverImageSchema,
  presetSchema,
  type Preset,
  type PresetCoverImage,
} from '@harness/domain';
import { imageSidecarPath, outputFileForMediaType } from '@harness/image';
import { ZodError } from 'zod';
import { ApiError } from '../app/api-error.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import type { DirectoryManifestCollection } from '../repository/manifest-collection.js';
import { safeSlug } from '../repository/slug.js';

export const presetsCollection: DirectoryManifestCollection<Preset> = {
  root: 'presets',
  manifestName: 'preset.json',
  schema: presetSchema,
  validateBinding: (preset, directory, directoryName) => {
    const suffix = `--${preset.presetId}`;
    const slug = directoryName.slice(0, -suffix.length);
    if (
      preset.directory !== directory ||
      !directoryName.endsWith(suffix) ||
      safeSlug(slug) !== slug
    ) {
      throw new ApiError(409, 'A preset manifest has an invalid directory binding.');
    }
  },
};

export async function loadPresetCover(
  repository: LocalImageRepository,
  preset: Preset,
): Promise<PresetCoverImage | undefined> {
  const files = (await repository.listFiles(preset.directory)).filter(
    (file) => file.startsWith('cover--') || file.endsWith('.image.json'),
  );
  if (!preset.coverImageId) return undefined;

  const sidecarName = `cover--${preset.coverImageId}.image.json`;
  if (!files.includes(sidecarName)) {
    throw new ApiError(409, 'A preset cover is missing.');
  }
  const sidecarPath = `${preset.directory}/${sidecarName}`;
  let cover: PresetCoverImage;
  try {
    cover = await repository.readJson(sidecarPath, presetCoverImageSchema);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      throw new ApiError(409, 'A preset cover has invalid image metadata.');
    }
    throw error;
  }
  const extension = outputFileForMediaType(cover.mediaType).extension;
  const imageName = `cover--${preset.coverImageId}.${extension}`;
  if (
    cover.presetId !== preset.presetId ||
    cover.imageId !== preset.coverImageId ||
    cover.repositoryRelativePath !== `${preset.directory}/${imageName}` ||
    imageSidecarPath(cover.repositoryRelativePath) !== sidecarPath ||
    !files.includes(imageName)
  ) {
    throw new ApiError(409, 'A preset cover has an invalid preset or file binding.');
  }
  return cover;
}
