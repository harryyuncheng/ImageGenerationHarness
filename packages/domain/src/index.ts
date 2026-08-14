import {
  MAX_IMAGE_BYTES,
  MAX_REQUEST_IMAGES,
  SCHEMA_VERSION,
  attemptStatusSchema,
  destinationSchema,
  generatedImageInputSchema,
  jobStatusSchema,
  mediaTypeSchema,
  nonEmptyStringSchema,
  repositoryRelativePathSchema,
  runStatusSchema,
  seedPlanSchema,
  sha256Schema,
  timestampSchema,
  uint32Schema,
  uuidSchema,
} from '@harness/contracts';
import { z } from 'zod';

export {
  IMAGE_SIDECAR_SCHEMA_VERSION,
  MAX_IMAGE_BYTES,
  MAX_REQUEST_IMAGES,
  SCHEMA_VERSION,
  attemptStatusSchema,
  destinationSchema,
  generatedImageInputSchema,
  generatedImageSidecarSchema,
  jobStatusSchema,
  mediaTypeSchema,
  repositoryStatusSchema,
  runStatusSchema,
  seedPlanSchema,
} from '@harness/contracts';
export type {
  Destination,
  GeneratedImageInput,
  GeneratedImageSidecar,
  RepositoryStatus,
  SeedPlan,
} from '@harness/contracts';

export const REPOSITORY_SCHEMA_VERSION = 1 as const;

export const repositoryDescriptorSchema = z
  .object({
    schemaVersion: z.literal(REPOSITORY_SCHEMA_VERSION),
    repositoryId: uuidSchema,
    name: nonEmptyStringSchema.max(120),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

const organizationalRecordFields = {
  schemaVersion: z.literal(SCHEMA_VERSION),
  name: nonEmptyStringSchema.max(120),
  description: z.string().max(4000),
  directory: repositoryRelativePathSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.optional(),
};

export const projectSchema = z
  .object({
    projectId: uuidSchema,
    ...organizationalRecordFields,
  })
  .strict();

export const projectAssetSchema = z
  .object({
    assetId: uuidSchema,
    projectId: uuidSchema,
    ...organizationalRecordFields,
  })
  .strict();

export const referenceFolderSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    folderId: uuidSchema,
    name: nonEmptyStringSchema.max(80),
    directory: repositoryRelativePathSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const referenceImageSchema = z
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

export type RepositoryDescriptor = z.infer<typeof repositoryDescriptorSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectAsset = z.infer<typeof projectAssetSchema>;
export type ReferenceFolder = z.infer<typeof referenceFolderSchema>;
export type ReferenceImage = z.infer<typeof referenceImageSchema>;
export type LocalRun = z.infer<typeof localRunSchema>;
export type LocalJob = z.infer<typeof localJobSchema>;
export type LocalInputReference = z.infer<typeof localInputReferenceSchema>;

export function assertSafeRepositoryRelativePath(value: string): string {
  return repositoryRelativePathSchema.parse(value);
}
