import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;
export const IMAGE_SIDECAR_SCHEMA_VERSION = 1 as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_REQUEST_IMAGES = 4;
export const UINT32_MAX = 4_294_967_295;
export const STABILITY_STANDARD_SEED_MAX = 4_294_967_294;

export const uuidSchema = z.uuid();
export const timestampSchema = z.iso.datetime({ offset: true });
export const nonEmptyStringSchema = z.string().trim().min(1);
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const repositoryRelativePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => !value.startsWith('/') && !value.startsWith('\\'), 'Path must be relative')
  .refine(
    (value) => !value.split(/[\\/]/u).some((part) => part === '' || part === '.' || part === '..'),
    'Path contains an unsafe segment',
  );

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const OUTPUT_FORMATS = ['jpeg', 'png', 'webp'] as const;
const ASPECT_RATIOS = ['16:9', '1:1', '21:9', '2:3', '3:2', '4:5', '5:4', '9:16', '9:21'] as const;
export const STYLE_PRESETS = [
  '3d-model',
  'analog-film',
  'anime',
  'cinematic',
  'comic-book',
  'digital-art',
  'enhance',
  'fantasy-art',
  'isometric',
  'line-art',
  'low-poly',
  'modeling-compound',
  'neon-punk',
  'origami',
  'photographic',
  'pixel-art',
  'tile-texture',
] as const;

export const mediaTypeSchema = z.enum(MEDIA_TYPES);
export const outputFormatSchema = z.enum(OUTPUT_FORMATS);
export const aspectRatioSchema = z.enum(ASPECT_RATIOS);
export const stylePresetSchema = z.enum(STYLE_PRESETS);

export type MediaType = z.infer<typeof mediaTypeSchema>;
export type OutputFormat = z.infer<typeof outputFormatSchema>;

export function isMediaType(value: string): value is MediaType {
  return MEDIA_TYPES.some((mediaType) => mediaType === value);
}

const seedStrategySchema = z.enum([
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

const REQUEST_PARAMETERS = [
  'prompt',
  'negative_prompt',
  'aspect_ratio',
  'mode',
  'image',
  'strength',
  'seed',
  'output_format',
  'style_preset',
  'control_strength',
  'fidelity',
  'init_image',
  'style_image',
  'composition_fidelity',
  'style_strength',
  'change_strength',
  'creativity',
  'mask',
  'grow_mask',
  'left',
  'right',
  'up',
  'down',
  'select_prompt',
  'search_prompt',
] as const;
const requestParameterSchema = z.enum(REQUEST_PARAMETERS);
const capabilityCategorySchema = z.enum(['generation', 'control', 'upscale', 'edit']);
const capabilityModeSchema = z.enum(['text-to-image', 'image-to-image', 'image-service']);
const capabilityInvocationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('foundation-model'),
      modelId: nonEmptyStringSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('geo-inference-profile'),
      profileId: nonEmptyStringSchema,
    })
    .strict(),
]);
const capabilityDescriptorSchema = z
  .object({
    canonicalId: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    category: capabilityCategorySchema,
    invocation: capabilityInvocationSchema,
    modes: z.array(capabilityModeSchema).min(1),
    parameters: z.array(requestParameterSchema),
    outputFormats: z.array(outputFormatSchema).min(1),
    seedMaximum: uint32Schema.optional(),
  })
  .strict();
export const capabilitiesResponseSchema = z
  .object({
    registryVersion: nonEmptyStringSchema,
    targets: z.array(capabilityDescriptorSchema).min(1),
  })
  .strict();

type ParsedCapabilityDescriptor = z.infer<typeof capabilityDescriptorSchema>;
export type RequestParameter = z.infer<typeof requestParameterSchema>;
export type CapabilityCategory = z.infer<typeof capabilityCategorySchema>;
type CapabilityMode = z.infer<typeof capabilityModeSchema>;
export type CapabilityDescriptor = Readonly<
  Omit<ParsedCapabilityDescriptor, 'modes' | 'parameters' | 'outputFormats'> & {
    modes: readonly CapabilityMode[];
    parameters: readonly RequestParameter[];
    outputFormats: readonly OutputFormat[];
  }
>;
export type CapabilitiesResponse = z.infer<typeof capabilitiesResponseSchema>;

const recentRepositorySchema = z
  .object({
    repositoryId: uuidSchema,
    name: nonEmptyStringSchema.max(120),
  })
  .strict();
export const repositoryStatusSchema = z
  .object({
    active: recentRepositorySchema.nullable(),
    recent: z.array(recentRepositorySchema).max(10),
  })
  .strict();

const projectDtoFields = {
  name: nonEmptyStringSchema.max(120),
  description: z.string().max(4000),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.optional(),
};
export const projectDtoSchema = z
  .object({
    projectId: uuidSchema,
    ...projectDtoFields,
  })
  .strict();
export const projectAssetDtoSchema = z
  .object({
    assetId: uuidSchema,
    projectId: uuidSchema,
    ...projectDtoFields,
  })
  .strict();
export const projectsResponseSchema = z.object({ projects: z.array(projectDtoSchema) }).strict();
export const projectDetailResponseSchema = z
  .object({
    project: projectDtoSchema,
    assets: z.array(projectAssetDtoSchema),
  })
  .strict();
export const projectAssetsResponseSchema = z
  .object({ assets: z.array(projectAssetDtoSchema) })
  .strict();

export const projectCreateRequestSchema = z
  .object({
    name: nonEmptyStringSchema.max(120),
    description: z.string().max(4000).optional(),
  })
  .strict();
export const projectUpdateRequestSchema = z
  .object({
    name: nonEmptyStringSchema.max(120).optional(),
    description: z.string().max(4000).optional(),
  })
  .strict()
  .refine((input) => input.name !== undefined || input.description !== undefined, {
    message: 'At least one project field must be updated.',
  });

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

export const repositoryParamsSchema = z.object({ repositoryId: uuidSchema }).strict();
export const projectParamsSchema = z.object({ projectId: uuidSchema }).strict();
export const projectAssetParamsSchema = z
  .object({ projectId: uuidSchema, assetId: uuidSchema })
  .strict();
export const runParamsSchema = z.object({ runId: uuidSchema }).strict();
export const imageParamsSchema = z.object({ imageId: uuidSchema }).strict();
export const folderParamsSchema = z.object({ folderId: uuidSchema }).strict();
export const referenceImageParamsSchema = z
  .object({ folderId: uuidSchema, imageId: uuidSchema })
  .strict();
export const includeArchivedQuerySchema = z
  .object({ includeArchived: z.enum(['true', 'false']).optional() })
  .strict();
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

export const apiErrorSchema = z
  .object({
    error: z.string(),
    issues: z
      .array(
        z
          .object({
            path: z.array(z.union([z.string(), z.number()])),
            message: z.string(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export type RepositoryStatus = z.infer<typeof repositoryStatusSchema>;
export type ProjectDto = z.infer<typeof projectDtoSchema>;
export type ProjectAssetDto = z.infer<typeof projectAssetDtoSchema>;
export type ProjectsResponse = z.infer<typeof projectsResponseSchema>;
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;
export type ProjectCreateRequest = z.infer<typeof projectCreateRequestSchema>;
export type ProjectUpdateRequest = z.infer<typeof projectUpdateRequestSchema>;
export type ReferenceImageDto = z.infer<typeof referenceImageDtoSchema>;
export type ReferenceFolderDto = z.infer<typeof referenceFolderDtoSchema>;
export type ReferenceLibraryResponse = z.infer<typeof referenceLibraryResponseSchema>;
export type CreateReferenceImageRequest = z.infer<typeof createReferenceImageRequestSchema>;
export type GeneratedImageInput = z.infer<typeof generatedImageInputSchema>;
export type GeneratedImageSidecar = z.infer<typeof generatedImageSidecarSchema>;
export type CreateRunRequest = z.infer<typeof createRunRequestSchema>;
export type GenerationFailure = z.infer<typeof generationFailureSchema>;
export type RunsResponse = z.infer<typeof runsResponseSchema>;
export type GalleryImageDto = z.infer<typeof galleryImageSchema>;
export type GalleryResponse = z.infer<typeof galleryResponseSchema>;
