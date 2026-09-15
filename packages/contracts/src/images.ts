import { z } from 'zod';

import {
  IMAGE_SIDECAR_SCHEMA_VERSION,
  nonEmptyStringSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  timestampSchema,
  uuidSchema,
} from './common.js';
import { generationSettingsSchema, generationStyleGuideSchema } from './generation.js';
import { mediaTypeSchema, outputFormatSchema } from './media.js';
import { seedStrategySchema, uint32Schema } from './runs.js';

export const generatedImageInputSchema = z
  .object({
    role: nonEmptyStringSchema.max(80),
    imageId: uuidSchema,
    repositoryRelativePath: repositoryRelativePathSchema,
    sha256: sha256Schema,
    mediaType: mediaTypeSchema,
    name: nonEmptyStringSchema.max(160).optional(),
    styleGuide: generationStyleGuideSchema.optional(),
  })
  .strict();
export const generatedImageSidecarSchema = z
  .object({
    schemaVersion: z.literal(IMAGE_SIDECAR_SCHEMA_VERSION),
    imageId: uuidSchema,
    repositoryRelativePath: repositoryRelativePathSchema,
    createdAt: timestampSchema,
    runId: uuidSchema,
    jobId: uuidSchema,
    attemptId: uuidSchema,
    capabilityRegistryVersion: nonEmptyStringSchema,
    canonicalTargetId: nonEmptyStringSchema,
    invocationId: nonEmptyStringSchema,
    prompt: z.string().max(10_000).optional(),
    negativePrompt: z.string().max(10_000).optional(),
    normalizedRequest: z.record(z.string(), z.unknown()),
    settings: generationSettingsSchema.optional(),
    seed: z
      .object({
        strategy: seedStrategySchema,
        planned: uint32Schema.nullable(),
        provider: uint32Schema.nullable(),
      })
      .strict(),
    output: z
      .object({
        format: outputFormatSchema,
        mediaType: mediaTypeSchema,
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        byteLength: z.number().int().positive(),
        sha256: sha256Schema,
      })
      .strict(),
    inputs: z.array(generatedImageInputSchema),
    provider: z
      .object({
        finishReason: z.string().max(500).nullable(),
        requestId: nonEmptyStringSchema.max(500).optional(),
        metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      })
      .strict(),
  })
  .strict();

const galleryImageSchema = z
  .object({
    imageId: uuidSchema,
    runId: uuidSchema,
    jobId: uuidSchema,
    aspectRatio: z.number().positive(),
    mediaType: mediaTypeSchema,
    byteLength: z.number().int().positive(),
    createdAt: timestampSchema,
    prompt: z.string().max(10_000).optional(),
    targetId: nonEmptyStringSchema,
  })
  .strict();
export const galleryResponseSchema = z.object({ images: z.array(galleryImageSchema) }).strict();

export const imageParamsSchema = z.object({ imageId: uuidSchema }).strict();

export type GeneratedImageInput = z.infer<typeof generatedImageInputSchema>;
export type GeneratedImageSidecar = z.infer<typeof generatedImageSidecarSchema>;
export type GalleryImageDto = z.infer<typeof galleryImageSchema>;
export type GalleryResponse = z.infer<typeof galleryResponseSchema>;
