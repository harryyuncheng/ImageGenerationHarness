import { z } from 'zod';

import {
  MAX_REQUEST_IMAGES,
  SCHEMA_VERSION,
  UINT32_MAX,
  nonEmptyStringSchema,
  timestampSchema,
  uuidSchema,
} from './common.js';

export const seedStrategySchema = z.enum([
  'provider-random',
  'harness-random',
  'fixed-repeat',
  'sequential',
  'explicit-list',
]);
export const uint32Schema = z.number().int().min(0).max(UINT32_MAX);
export const seedPlanSchema = z.discriminatedUnion('strategy', [
  z.object({ strategy: z.literal('provider-random') }).strict(),
  z.object({ strategy: z.literal('harness-random') }).strict(),
  z.object({ strategy: z.literal('fixed-repeat'), seed: uint32Schema }).strict(),
  z.object({ strategy: z.literal('sequential'), start: uint32Schema }).strict(),
  z
    .object({
      strategy: z.literal('explicit-list'),
      seeds: z.array(uint32Schema).min(1),
    })
    .strict(),
]);

export const destinationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('main') }).strict(),
  z.object({ kind: z.literal('project'), projectId: uuidSchema }).strict(),
  z
    .object({
      kind: z.literal('project-asset'),
      projectId: uuidSchema,
      projectAssetId: uuidSchema,
    })
    .strict(),
]);

const executionStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]);
export const runStatusSchema = executionStatusSchema;
export const jobStatusSchema = executionStatusSchema;
export const attemptStatusSchema = z.enum([
  'started',
  'succeeded',
  'failed',
  'filtered',
  'ambiguous',
]);

export type SeedPlan = z.infer<typeof seedPlanSchema>;
export type Destination = z.infer<typeof destinationSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;

export const createRunRequestSchema = z
  .object({
    targetId: nonEmptyStringSchema,
    request: z.record(z.string(), z.unknown()),
    requestedJobCount: z.number().int().min(1).max(MAX_REQUEST_IMAGES),
    seedPlan: seedPlanSchema,
    destination: destinationSchema.default({ kind: 'main' }),
  })
  .strict();

export const runDtoSchema = z
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

const attemptDtoSchema = z
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

export const jobDtoSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    runId: uuidSchema,
    jobId: uuidSchema,
    status: jobStatusSchema,
    targetId: nonEmptyStringSchema,
    destination: destinationSchema,
    plannedSeed: uint32Schema.nullable(),
    providerSeed: uint32Schema.nullable(),
    outputImageIds: z.array(uuidSchema),
    attempts: z.array(attemptDtoSchema),
    errorCode: nonEmptyStringSchema.max(120).optional(),
    errorMessage: nonEmptyStringSchema.max(2000).optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const runSnapshotSchema = z
  .object({ run: runDtoSchema, jobs: z.array(jobDtoSchema) })
  .strict();
export const generationFailureSchema = z
  .object({
    runId: uuidSchema,
    error: nonEmptyStringSchema.max(2000),
    discarded: z.boolean(),
  })
  .strict();
export const runsResponseSchema = z
  .object({
    runs: z.array(runSnapshotSchema),
    failures: z.array(generationFailureSchema).default([]),
  })
  .strict();
export const queuedRunResponseSchema = z
  .object({ runId: uuidSchema, status: z.literal('queued') })
  .strict();

export const runParamsSchema = z.object({ runId: uuidSchema }).strict();
export const destinationQuerySchema = z.union([
  z.object({}).strict(),
  z.object({ destination: z.literal('main') }).strict(),
  z.object({ destination: z.literal('project'), projectId: uuidSchema }).strict(),
  z
    .object({
      destination: z.literal('project-asset'),
      projectId: uuidSchema,
      projectAssetId: uuidSchema,
    })
    .strict(),
]);

export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;
export type GenerationFailure = z.infer<typeof generationFailureSchema>;
export type RunsResponse = z.infer<typeof runsResponseSchema>;
