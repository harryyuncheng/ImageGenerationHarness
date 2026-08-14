import { z } from 'zod';

import {
  IMAGE_SIDECAR_SCHEMA_VERSION,
  nonEmptyStringSchema,
  repositoryRelativePathSchema,
  sha256Schema,
  timestampSchema,
  uuidSchema,
} from './common.js';
import { mediaTypeSchema, outputFormatSchema } from './media.js';
import { seedStrategySchema, uint32Schema } from './runs.js';

export const generatedImageInputSchema = z
  .object({
    role: nonEmptyStringSchema.max(80),
    imageId: uuidSchema,
    repositoryRelativePath: repositoryRelativePathSchema,
    sha256: sha256Schema,
    mediaType: mediaTypeSchema,
  })
  .strict();
export const generatedImageSidecarSchema = z
  .object({
    schemaVersion: z.literal(IMAGE_SIDECAR_SCHEMA_VERSION),
    imageId: uuidSchema,
    repositoryRelativePath: repositoryRelativePathSchema,
    projectId: uuidSchema.optional(),
    projectAssetId: uuidSchema.optional(),
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
  .strict()
  .superRefine((value, context) => {
    if (value.projectAssetId && !value.projectId) {
      context.addIssue({ code: 'custom', message: 'A project asset image requires a project' });
    }
  });

const galleryImageSchema = z
  .object({
    imageId: uuidSchema,
    runId: uuidSchema,
    mediaType: mediaTypeSchema,
    byteLength: z.number().int().positive(),
    createdAt: timestampSchema,
    prompt: z.string().max(10_000).optional(),
    targetId: nonEmptyStringSchema,
    projectId: uuidSchema.optional(),
    projectAssetId: uuidSchema.optional(),
  })
  .strict();
export const galleryResponseSchema = z.object({ images: z.array(galleryImageSchema) }).strict();

export const imageParamsSchema = z.object({ imageId: uuidSchema }).strict();

export type GeneratedImageInput = z.infer<typeof generatedImageInputSchema>;
export type GeneratedImageSidecar = z.infer<typeof generatedImageSidecarSchema>;
export type GalleryImageDto = z.infer<typeof galleryImageSchema>;
export type GalleryResponse = z.infer<typeof galleryResponseSchema>;
