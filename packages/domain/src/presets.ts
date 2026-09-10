import {
  IMAGE_SIDECAR_SCHEMA_VERSION,
  SCHEMA_VERSION,
  presetDtoSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  timestampSchema,
  uuidSchema,
} from '@harness/contracts';
import { z } from 'zod';

export const presetSchema = presetDtoSchema.omit({ cover: true }).extend({
  schemaVersion: z.literal(SCHEMA_VERSION),
  directory: repositoryRelativePathSchema,
  coverImageId: uuidSchema.optional(),
});

export const presetCoverImageSchema = presetDtoSchema.shape.cover.unwrap().extend({
  schemaVersion: z.literal(IMAGE_SIDECAR_SCHEMA_VERSION),
  presetId: uuidSchema,
  repositoryRelativePath: repositoryRelativePathSchema,
  sha256: sha256Schema,
  createdAt: timestampSchema,
});

export type Preset = z.infer<typeof presetSchema>;
export type PresetCoverImage = z.infer<typeof presetCoverImageSchema>;
