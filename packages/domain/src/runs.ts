import {
  MAX_REQUEST_IMAGES,
  SCHEMA_VERSION,
  attemptStatusSchema,
  destinationSchema,
  generatedImageInputSchema,
  jobStatusSchema,
  nonEmptyStringSchema,
  runStatusSchema,
  seedPlanSchema,
  timestampSchema,
  uint32Schema,
  uuidSchema,
} from '@harness/contracts';
import { z } from 'zod';

export const localRunSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    runId: uuidSchema,
    status: runStatusSchema,
    registryVersion: nonEmptyStringSchema,
    targetId: nonEmptyStringSchema,
    destination: destinationSchema,
    requestedJobCount: z.number().int().min(1).max(MAX_REQUEST_IMAGES),
    seedPlan: seedPlanSchema,
    prompt: z.string().max(10_000).optional(),
    jobIds: z.array(uuidSchema).min(1).max(MAX_REQUEST_IMAGES),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const localAttemptSchema = z
  .object({
    attemptId: uuidSchema,
    ordinal: z.number().int().positive(),
    status: attemptStatusSchema,
    startedAt: timestampSchema,
    finishedAt: timestampSchema.optional(),
    providerRequestId: nonEmptyStringSchema.optional(),
    errorCode: nonEmptyStringSchema.max(120).optional(),
    errorMessage: nonEmptyStringSchema.max(2000).optional(),
  })
  .strict();

const localInputReferenceSchema = generatedImageInputSchema
  .extend({ field: nonEmptyStringSchema })
  .strict();

export const localJobSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    runId: uuidSchema,
    jobId: uuidSchema,
    status: jobStatusSchema,
    targetId: nonEmptyStringSchema,
    destination: destinationSchema,
    request: z.record(z.string(), z.unknown()),
    inputs: z.array(localInputReferenceSchema),
    plannedSeed: uint32Schema.nullable(),
    providerSeed: uint32Schema.nullable(),
    outputImageIds: z.array(uuidSchema),
    attempts: z.array(localAttemptSchema),
    errorCode: nonEmptyStringSchema.max(120).optional(),
    errorMessage: nonEmptyStringSchema.max(2000).optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export type LocalRun = z.infer<typeof localRunSchema>;
export type LocalJob = z.infer<typeof localJobSchema>;
export type LocalInputReference = z.infer<typeof localInputReferenceSchema>;
