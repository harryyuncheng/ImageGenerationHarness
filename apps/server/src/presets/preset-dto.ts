import { presetDtoSchema } from '@harness/contracts';
import type { Preset, PresetCoverImage } from '@harness/domain';

export function presetDto(preset: Preset, cover?: PresetCoverImage) {
  return presetDtoSchema.parse({
    presetId: preset.presetId,
    name: preset.name,
    prompt: preset.prompt,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt,
    cover: cover
      ? {
          imageId: cover.imageId,
          mediaType: cover.mediaType,
          byteLength: cover.byteLength,
          width: cover.width,
          height: cover.height,
        }
      : undefined,
  });
}
