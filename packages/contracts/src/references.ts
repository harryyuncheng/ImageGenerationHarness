import { z } from 'zod';

import { MAX_IMAGE_BYTES, nonEmptyStringSchema, timestampSchema, uuidSchema } from './common.js';
import { mediaTypeSchema } from './media.js';

export const referenceImageDtoSchema = z
  .object({
    folderId: uuidSchema,
    imageId: uuidSchema,
    name: nonEmptyStringSchema.max(160),
    mediaType: mediaTypeSchema,
    byteLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();
export const referenceFolderDtoSchema = z
  .object({
    folderId: uuidSchema,
    name: nonEmptyStringSchema.max(80),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    images: z.array(referenceImageDtoSchema),
  })
  .strict();
export const referenceLibraryResponseSchema = z
  .object({ folders: z.array(referenceFolderDtoSchema) })
  .strict();
export const referenceFolderNameRequestSchema = z
  .object({ name: nonEmptyStringSchema.max(80) })
  .strict();
export const referenceImageNameRequestSchema = z
  .object({ name: nonEmptyStringSchema.max(160) })
  .strict();
export const createReferenceImageRequestSchema = z
  .object({
    name: nonEmptyStringSchema.max(160),
    mediaType: mediaTypeSchema,
    data: z
      .string()
      .min(1)
      .max(Math.ceil(MAX_IMAGE_BYTES / 3) * 4),
  })
  .strict();

export const folderParamsSchema = z.object({ folderId: uuidSchema }).strict();
export const referenceImageParamsSchema = z
  .object({ folderId: uuidSchema, imageId: uuidSchema })
  .strict();

export type ReferenceImageDto = z.infer<typeof referenceImageDtoSchema>;
export type ReferenceFolderDto = z.infer<typeof referenceFolderDtoSchema>;
export type ReferenceLibraryResponse = z.infer<typeof referenceLibraryResponseSchema>;
export type CreateReferenceImageRequest = z.infer<typeof createReferenceImageRequestSchema>;
