import {
  MAX_IMAGE_BYTES,
  SCHEMA_VERSION,
  mediaTypeSchema,
  nonEmptyStringSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  timestampSchema,
  uuidSchema,
} from '@harness/contracts';
import { z } from 'zod';

export const styleGuideFolderSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    folderId: uuidSchema,
    name: nonEmptyStringSchema.max(80),
    directory: repositoryRelativePathSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const styleGuideImageSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    folderId: uuidSchema,
    imageId: uuidSchema,
    name: nonEmptyStringSchema.max(160),
    repositoryRelativePath: repositoryRelativePathSchema,
    sha256: sha256Schema,
    mediaType: mediaTypeSchema,
    byteLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export type StyleGuideFolder = z.infer<typeof styleGuideFolderSchema>;
export type StyleGuideImage = z.infer<typeof styleGuideImageSchema>;
