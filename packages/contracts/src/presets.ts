import { z } from 'zod';
import { MAX_IMAGE_BYTES, nonEmptyStringSchema, timestampSchema, uuidSchema } from './common.js';
import { mediaTypeSchema } from './media.js';
import { createStyleGuideImageRequestSchema } from './style-guide.js';

export const presetDtoSchema = z
  .object({
    presetId: uuidSchema,
    name: nonEmptyStringSchema.max(80),
    prompt: nonEmptyStringSchema.max(10_000),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    cover: z
      .object({
        imageId: uuidSchema,
        mediaType: mediaTypeSchema,
        byteLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const presetsResponseSchema = z.object({ presets: z.array(presetDtoSchema) }).strict();

export const presetCoverRequestSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('gallery'), imageId: uuidSchema }).strict(),
  createStyleGuideImageRequestSchema.extend({ source: z.literal('upload') }),
]);

export const createPresetRequestSchema = presetDtoSchema.pick({ name: true, prompt: true }).extend({
  cover: presetCoverRequestSchema.optional(),
});

export const updatePresetRequestSchema = createPresetRequestSchema.extend({
  cover: presetCoverRequestSchema.nullable().optional(),
});

export type PresetDto = z.infer<typeof presetDtoSchema>;
export type PresetsResponse = z.infer<typeof presetsResponseSchema>;
export type PresetCoverRequest = z.infer<typeof presetCoverRequestSchema>;
export type CreatePresetRequest = z.infer<typeof createPresetRequestSchema>;
export type UpdatePresetRequest = z.infer<typeof updatePresetRequestSchema>;
