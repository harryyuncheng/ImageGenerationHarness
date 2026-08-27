import { z } from 'zod';

import { MAX_IMAGE_BYTES, nonEmptyStringSchema, timestampSchema, uuidSchema } from './common.js';
import { mediaTypeSchema } from './media.js';

export const styleGuideImageDtoSchema = z
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
export const styleGuideFolderDtoSchema = z
  .object({
    folderId: uuidSchema,
    name: nonEmptyStringSchema.max(80),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    images: z.array(styleGuideImageDtoSchema),
  })
  .strict();
export const styleGuideResponseSchema = z
  .object({ folders: z.array(styleGuideFolderDtoSchema) })
  .strict();
export const styleGuideFolderNameRequestSchema = z
  .object({ name: nonEmptyStringSchema.max(80) })
  .strict();
export const styleGuideImageNameRequestSchema = z
  .object({ name: nonEmptyStringSchema.max(160) })
  .strict();
export const createStyleGuideImageRequestSchema = z
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
export const styleGuideImageParamsSchema = z
  .object({ folderId: uuidSchema, imageId: uuidSchema })
  .strict();

export type StyleGuideImageDto = z.infer<typeof styleGuideImageDtoSchema>;
export type StyleGuideFolderDto = z.infer<typeof styleGuideFolderDtoSchema>;
export type StyleGuideResponse = z.infer<typeof styleGuideResponseSchema>;
export type CreateStyleGuideImageRequest = z.infer<typeof createStyleGuideImageRequestSchema>;
