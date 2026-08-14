import { randomInt, randomUUID } from 'node:crypto';
import { getCapability, CAPABILITY_REGISTRY_VERSION } from '@harness/capabilities';
import {
  outputFormatSchema,
  type CreateRunRequest,
  type GalleryImageDto,
  type GenerationFailure,
} from '@harness/contracts';
import {
  generatedImageSidecarSchema,
  localJobSchema,
  localRunSchema,
  SCHEMA_VERSION,
  type Destination,
  type GeneratedImageSidecar,
  type LocalInputReference,
  type LocalJob,
  type LocalRun,
  type ReferenceImage,
  type SeedPlan,
} from '@harness/domain';
import {
  decodeCanonicalBase64,
  imageSidecarPath,
  inspectImage,
  mediaTypeForOutputFormat,
  mediaTypeFromImageFormat,
  outputFileForMediaType,
  sha256Hex,
} from '@harness/image';
import { z } from 'zod';
import { StabilityBedrockAdapter, type BedrockInvoker } from './bedrock.js';
import {
  type LocalImageRepository,
  type LocalRepositoryManager,
  safeSlug,
} from './local-repository.js';
import { LocalProjectService, type ProjectService } from './project-service.js';
import {
  LocalReferenceLibraryService,
  type ReferenceLibraryService,
} from './reference-library-service.js';

type RunSubmission = CreateRunRequest;

export interface RunSnapshot {
  run: LocalRun;
  jobs: LocalJob[];
}

export interface GeneratedImageRecord {
  imageId: string;
  runId: string;
  repositoryRelativePath: string;
  mediaType: GeneratedImageSidecar['output']['mediaType'];
  byteLength: number;
}

export type GalleryImage = GalleryImageDto;

export interface RunService {
  submit(input: RunSubmission): Promise<{ runId: string }>;
  getSnapshot(runId: string): Promise<RunSnapshot | undefined>;
  listRuns(destination?: Destination): Promise<RunSnapshot[]>;
  consumeFailures(destination?: Destination): GenerationFailure[];
  cancel(runId: string): Promise<RunSnapshot>;
  retry(runId: string): Promise<{ runId: string }>;
  getImage(imageId: string): Promise<GeneratedImageRecord | undefined>;
  getImageMetadata(imageId: string): Promise<GeneratedImageSidecar | undefined>;
  readImage(image: GeneratedImageRecord): Promise<Uint8Array>;
  listImages(destination?: Destination): Promise<GalleryImage[]>;
  recover(): Promise<void>;
}

interface QueueItem {
  runId: string;
  jobId: string;
  repository: LocalImageRepository;
  destinationDirectory: string;
}

interface StagedRequest {
  request: Record<string, unknown>;
  inputs: LocalInputReference[];
  createdInputPaths: string[];
}

interface PendingGenerationFailure extends GenerationFailure {
  destination: Destination;
}

interface PublishedOutput {
  imagePath: string;
  sidecarPath: string;
}

const imageFields = new Set(['image', 'init_image', 'style_image', 'mask']);
const referencePattern = /^repo-image:\/\/([0-9a-f-]{36})$/iu;

function validateSeedPlan(seedPlan: SeedPlan, seedMaximum: number | undefined): void {
  if (seedMaximum === undefined) {
    z.literal('provider-random', {
      error: 'This image service does not accept a seed parameter',
    }).parse(seedPlan.strategy);
    return;
  }
  const seedSchema = z.number().int().min(0).max(seedMaximum);
  if (seedPlan.strategy === 'fixed-repeat') seedSchema.parse(seedPlan.seed);
  if (seedPlan.strategy === 'sequential') seedSchema.parse(seedPlan.start);
  if (seedPlan.strategy === 'explicit-list')
    seedPlan.seeds.forEach((seed) => seedSchema.parse(seed));
}

function plannedSeed(
  seedPlan: SeedPlan,
  index: number,
  seedMaximum: number | undefined,
): number | null {
  if (seedMaximum === undefined) return null;
  switch (seedPlan.strategy) {
    case 'provider-random':
      return null;
    case 'harness-random':
      return randomInt(0, seedMaximum + 1);
    case 'fixed-repeat':
      return seedPlan.seed;
    case 'sequential':
      return (seedPlan.start + index) % (seedMaximum + 1);
    case 'explicit-list':
      return seedPlan.seeds[index % seedPlan.seeds.length] ?? null;
  }
}

function runRecordPath(runId: string): string {
  return `.image-harness/runs/${runId}.json`;
}

function jobRecordPath(jobId: string): string {
  return `.image-harness/jobs/${jobId}.json`;
}

async function hydrateInputs(
  repository: LocalImageRepository,
  request: Record<string, unknown>,
  inputs: readonly LocalInputReference[],
): Promise<Record<string, unknown>> {
  const hydrated = { ...request };
  for (const input of inputs) {
    const bytes = await repository.readBytes(input.repositoryRelativePath);
    if (sha256Hex(bytes) !== input.sha256) {
      throw new Error('Input image integrity verification failed');
    }
    hydrated[input.field] = Buffer.from(bytes).toString('base64');
  }
  return hydrated;
}

function promptSlug(request: Record<string, unknown>): string {
  const prompt = typeof request['prompt'] === 'string' ? request['prompt'] : 'generated-image';
  return safeSlug(prompt).slice(0, 48);
}

function summarizeRunStatus(jobs: LocalJob[]): LocalRun['status'] {
  if (jobs.some((job) => job.status === 'running')) return 'running';
  if (jobs.some((job) => job.status === 'queued')) return 'queued';
  if (jobs.some((job) => job.status === 'interrupted')) return 'interrupted';
  if (jobs.every((job) => job.status === 'cancelled')) return 'cancelled';
  if (jobs.some((job) => job.status === 'failed')) return 'failed';
  return 'completed';
}

function destinationMatches(
  record: { projectId?: string | undefined; projectAssetId?: string | undefined },
  destination: Destination,
): boolean {
  if (destination.kind === 'main') return !record.projectId && !record.projectAssetId;
  if (destination.kind === 'project') {
    return record.projectId === destination.projectId && !record.projectAssetId;
  }
  return (
    record.projectId === destination.projectId &&
    record.projectAssetId === destination.projectAssetId
  );
}

function sameDestination(left: Destination, right: Destination): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'main' || right.kind === 'main') return true;
  if (left.projectId !== right.projectId) return false;
  return (
    left.kind !== 'project-asset' ||
    right.kind !== 'project-asset' ||
    left.projectAssetId === right.projectAssetId
  );
}

export class LocalRunService implements RunService {
  readonly #manager: LocalRepositoryManager;
  readonly #projects: ProjectService;
  readonly #references: ReferenceLibraryService;
  readonly #bedrock: BedrockInvoker;
  readonly #concurrency: number;
  readonly #maxQueuedJobs: number;
  readonly #queue: QueueItem[] = [];
  readonly #queuedKeys = new Set<string>();
  readonly #failuresByRepository = new Map<string, PendingGenerationFailure[]>();
  #active = 0;
  #draining = false;

  constructor(options: {
    manager: LocalRepositoryManager;
    projectService?: ProjectService;
    referenceLibraryService?: ReferenceLibraryService;
    bedrock?: BedrockInvoker;
    concurrency?: number;
    maxQueuedJobs?: number;
  }) {
    this.#manager = options.manager;
    this.#projects = options.projectService ?? new LocalProjectService(options.manager);
    this.#references =
      options.referenceLibraryService ?? new LocalReferenceLibraryService(options.manager);
    this.#bedrock = options.bedrock ?? new StabilityBedrockAdapter();
    this.#concurrency = Math.max(1, Math.min(4, options.concurrency ?? 1));
    this.#maxQueuedJobs = Math.max(1, options.maxQueuedJobs ?? 64);
  }

  async submit(input: RunSubmission): Promise<{ runId: string }> {
    const repository = this.#manager.getActiveRepository();
    const capability = getCapability(input.targetId);
    validateSeedPlan(input.seedPlan, capability.seedMaximum);
    const destinationDirectory = await this.#projects.resolveDestinationDirectory(
      input.destination,
    );
    if (this.#queue.length + this.#active + input.requestedJobCount > this.#maxQueuedJobs) {
      throw new Error('The local generation queue is full. Wait for a queued run to finish.');
    }
    const validatedRequest = capability.requestSchema.parse(input.request) as Record<
      string,
      unknown
    >;
    const now = new Date().toISOString();
    const runId = randomUUID();
    const jobs: LocalJob[] = [];
    await repository.withMutation(async () => {
      const staged = await this.#stageImages(repository, validatedRequest);
      try {
        jobs.push(
          ...Array.from({ length: input.requestedJobCount }, (_, index) => {
            const seed = plannedSeed(input.seedPlan, index, capability.seedMaximum);
            const request = capability.requestSchema.parse(
              seed === null ? staged.request : { ...staged.request, seed },
            ) as Record<string, unknown>;
            return localJobSchema.parse({
              schemaVersion: SCHEMA_VERSION,
              runId,
              jobId: randomUUID(),
              status: 'queued',
              targetId: input.targetId,
              destination: input.destination,
              request,
              inputs: staged.inputs,
              plannedSeed: seed,
              providerSeed: null,
              outputImageIds: [],
              attempts: [],
              createdAt: now,
              updatedAt: now,
            });
          }),
        );
        const run = localRunSchema.parse({
          schemaVersion: SCHEMA_VERSION,
          runId,
          status: 'queued',
          registryVersion: CAPABILITY_REGISTRY_VERSION,
          targetId: input.targetId,
          destination: input.destination,
          requestedJobCount: input.requestedJobCount,
          seedPlan: input.seedPlan,
          ...(typeof validatedRequest['prompt'] === 'string'
            ? { prompt: validatedRequest['prompt'] }
            : {}),
          jobIds: jobs.map((job) => job.jobId),
          createdAt: now,
          updatedAt: now,
        });
        await repository.writeJson(runRecordPath(run.runId), run, localRunSchema);
        for (const job of jobs) {
          await repository.writeJson(jobRecordPath(job.jobId), job, localJobSchema);
        }
      } catch (error) {
        for (const job of jobs) {
          await repository.removeRelative(jobRecordPath(job.jobId), { missingOk: true });
        }
        await repository.removeRelative(runRecordPath(runId), { missingOk: true });
        for (const path of [...staged.createdInputPaths].reverse()) {
          await repository.removeRelative(path, { missingOk: true });
        }
        throw error;
      }
    });
    for (const job of jobs) {
      this.#enqueue({ runId, jobId: job.jobId, repository, destinationDirectory });
    }
    this.#drain();
    return { runId };
  }

  async getSnapshot(runId: string): Promise<RunSnapshot | undefined> {
    return this.#getSnapshot(this.#manager.getActiveRepository(), runId);
  }

  async listRuns(destination?: Destination): Promise<RunSnapshot[]> {
    const repository = this.#manager.getActiveRepository();
    const files = (await repository.listFiles('.image-harness/runs')).filter((file) =>
      file.endsWith('.json'),
    );
    const snapshots: RunSnapshot[] = [];
    for (const file of files) {
      const run = await repository.readJson(`.image-harness/runs/${file}`, localRunSchema);
      if (destination && JSON.stringify(run.destination) !== JSON.stringify(destination)) continue;
      const snapshot = await this.#getSnapshot(repository, run.runId);
      if (!snapshot) continue;
      if (snapshot.run.status === 'failed') {
        for (const job of snapshot.jobs.filter((candidate) => candidate.status === 'failed')) {
          await this.#discardFailedJob(repository, job);
        }
        continue;
      }
      snapshots.push(snapshot);
    }
    return snapshots.sort((left, right) => right.run.createdAt.localeCompare(left.run.createdAt));
  }

  consumeFailures(destination?: Destination): GenerationFailure[] {
    const repositoryId = this.#manager.getActiveRepository().descriptor.repositoryId;
    const pending = this.#failuresByRepository.get(repositoryId) ?? [];
    const consumed = destination
      ? pending.filter((failure) => sameDestination(failure.destination, destination))
      : pending;
    const remaining = destination
      ? pending.filter((failure) => !sameDestination(failure.destination, destination))
      : [];
    if (remaining.length > 0) this.#failuresByRepository.set(repositoryId, remaining);
    else this.#failuresByRepository.delete(repositoryId);
    return consumed.map(({ runId, error, discarded }) => ({ runId, error, discarded }));
  }

  async cancel(runId: string): Promise<RunSnapshot> {
    const snapshot = await this.getSnapshot(runId);
    if (!snapshot) throw new Error('Run not found');
    const repository = this.#manager.getActiveRepository();
    const now = new Date().toISOString();
    const jobs: LocalJob[] = [];
    for (const job of snapshot.jobs) {
      if (job.status === 'queued') {
        this.#queuedKeys.delete(this.#queueKey(repository, job.runId, job.jobId));
        const cancelled = localJobSchema.parse({ ...job, status: 'cancelled', updatedAt: now });
        await repository.writeJson(jobRecordPath(job.jobId), cancelled, localJobSchema);
        jobs.push(cancelled);
      } else {
        jobs.push(job);
      }
    }
    const run = localRunSchema.parse({
      ...snapshot.run,
      status: summarizeRunStatus(jobs),
      updatedAt: now,
    });
    await repository.writeJson(runRecordPath(run.runId), run, localRunSchema);
    return { run, jobs };
  }

  async retry(runId: string): Promise<{ runId: string }> {
    const snapshot = await this.getSnapshot(runId);
    if (!snapshot) throw new Error('Run not found');
    const firstJob = snapshot.jobs[0];
    if (!firstJob) throw new Error('Run has no jobs');
    const repository = this.#manager.getActiveRepository();
    const hydrated = await hydrateInputs(repository, firstJob.request, firstJob.inputs);
    return this.submit({
      targetId: snapshot.run.targetId,
      request: hydrated,
      requestedJobCount: snapshot.run.requestedJobCount,
      seedPlan: snapshot.run.seedPlan,
      destination: snapshot.run.destination,
    });
  }

  async getImage(imageId: string): Promise<GeneratedImageRecord | undefined> {
    const sidecar = await this.getImageMetadata(imageId);
    if (!sidecar) return undefined;
    return {
      imageId,
      runId: sidecar.runId,
      repositoryRelativePath: sidecar.repositoryRelativePath,
      mediaType: sidecar.output.mediaType,
      byteLength: sidecar.output.byteLength,
    };
  }

  async getImageMetadata(imageId: string): Promise<GeneratedImageSidecar | undefined> {
    const matches: GeneratedImageSidecar[] = [];
    await this.#walkGeneratedSidecars(this.#manager.getActiveRepository(), (sidecar) => {
      if (sidecar.imageId === imageId) matches.push(sidecar);
    });
    if (matches.length > 1) throw new Error('Duplicate generated image identifiers');
    return matches[0];
  }

  async readImage(image: GeneratedImageRecord): Promise<Uint8Array> {
    const current = await this.getImageMetadata(image.imageId);
    if (current?.repositoryRelativePath !== image.repositoryRelativePath) {
      throw new Error('Generated image record is no longer valid');
    }
    const bytes = await this.#manager
      .getActiveRepository()
      .readBytes(current.repositoryRelativePath);
    if (
      bytes.byteLength !== current.output.byteLength ||
      sha256Hex(bytes) !== current.output.sha256
    ) {
      throw new Error('Generated image integrity verification failed');
    }
    return bytes;
  }

  async listImages(destination?: Destination): Promise<GalleryImage[]> {
    const images: GalleryImage[] = [];
    await this.#walkGeneratedSidecars(this.#manager.getActiveRepository(), (sidecar) => {
      if (destination && !destinationMatches(sidecar, destination)) return;
      images.push({
        imageId: sidecar.imageId,
        runId: sidecar.runId,
        mediaType: sidecar.output.mediaType,
        byteLength: sidecar.output.byteLength,
        createdAt: sidecar.createdAt,
        ...(sidecar.prompt === undefined ? {} : { prompt: sidecar.prompt }),
        targetId: sidecar.canonicalTargetId,
        ...(sidecar.projectId === undefined ? {} : { projectId: sidecar.projectId }),
        ...(sidecar.projectAssetId === undefined ? {} : { projectAssetId: sidecar.projectAssetId }),
      });
    });
    return images.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async recover(): Promise<void> {
    const repository = this.#manager.getActiveRepository();
    const files = (await repository.listFiles('.image-harness/jobs')).filter((file) =>
      file.endsWith('.json'),
    );
    const affectedRuns = new Set<string>();
    for (const file of files) {
      const path = `.image-harness/jobs/${file}`;
      const job = await repository.readJson(path, localJobSchema);
      if (job.status === 'failed') {
        await this.#discardFailedJob(repository, job);
      } else if (job.status === 'queued') {
        const destinationDirectory = await this.#projects.resolveDestinationDirectory(
          job.destination,
        );
        this.#enqueue({
          runId: job.runId,
          jobId: job.jobId,
          repository,
          destinationDirectory,
        });
      } else if (job.status === 'running') {
        const now = new Date().toISOString();
        const attempts = job.attempts.map((attempt, index) =>
          index === job.attempts.length - 1 && attempt.status === 'started'
            ? {
                ...attempt,
                status: 'ambiguous' as const,
                finishedAt: now,
                errorCode: 'Interrupted',
                errorMessage:
                  'The server stopped during an active Bedrock invocation. The outcome and billing are ambiguous.',
              }
            : attempt,
        );
        const interrupted = localJobSchema.parse({
          ...job,
          status: 'interrupted',
          attempts,
          errorCode: 'Interrupted',
          errorMessage: 'The server stopped during an active Bedrock invocation. Retry explicitly.',
          updatedAt: now,
        });
        await repository.writeJson(path, interrupted, localJobSchema);
        affectedRuns.add(job.runId);
      }
    }
    for (const runId of affectedRuns) await this.#refreshRun(repository, runId);
    this.#drain();
  }

  async #stageImages(
    repository: LocalImageRepository,
    request: Record<string, unknown>,
  ): Promise<StagedRequest> {
    const staged = { ...request };
    const inputs: LocalInputReference[] = [];
    const createdPaths: string[] = [];
    try {
      for (const [field, value] of Object.entries(request)) {
        if (!imageFields.has(field) || typeof value !== 'string') continue;
        const reference = referencePattern.exec(value);
        let image: ReferenceImage | undefined;
        if (reference?.[1]) image = await this.#references.getImageById(reference[1]);
        if (reference && !image) throw new Error('Reference image not found');
        if (image) {
          const bytes = await repository.readBytes(image.repositoryRelativePath);
          if (bytes.byteLength !== image.byteLength || sha256Hex(bytes) !== image.sha256) {
            throw new Error('Reference image integrity verification failed');
          }
          const extension = outputFileForMediaType(image.mediaType).extension;
          const snapshotPath = `.image-harness/inputs/${image.sha256}--${image.imageId}.${extension}`;
          await repository.withMutation(async () => {
            if (await repository.exists(snapshotPath)) {
              const existing = await repository.readBytes(snapshotPath);
              if (sha256Hex(existing) !== image.sha256) {
                throw new Error('Staged reference image integrity verification failed');
              }
            } else {
              await repository.writeImmutable(snapshotPath, bytes);
              createdPaths.push(snapshotPath);
            }
          });
          staged[field] = `repo-image://${image.imageId}`;
          inputs.push({
            field,
            role: field,
            imageId: image.imageId,
            repositoryRelativePath: snapshotPath,
            sha256: image.sha256,
            mediaType: image.mediaType,
          });
          continue;
        }
        if (value.startsWith('repo-image://')) {
          throw new Error('Invalid reference image identifier');
        }
        const bytes = decodeCanonicalBase64(value, { label: 'Input image data' });
        const inspected = await inspectImage(bytes);
        const mediaType = mediaTypeFromImageFormat(inspected.format);
        if (!mediaType) throw new Error('Only PNG, JPEG, and WebP inputs are supported');
        const imageId = randomUUID();
        const digest = sha256Hex(bytes);
        const extension = outputFileForMediaType(mediaType).extension;
        const path = `.image-harness/inputs/${digest}--${imageId}.${extension}`;
        await repository.writeImmutable(path, bytes);
        createdPaths.push(path);
        staged[field] = `repo-image://${imageId}`;
        inputs.push({
          field,
          role: field,
          imageId,
          repositoryRelativePath: path,
          sha256: digest,
          mediaType,
        });
      }
      return { request: staged, inputs, createdInputPaths: createdPaths };
    } catch (error) {
      for (const path of createdPaths.reverse()) {
        await repository.removeRelative(path, { missingOk: true });
      }
      throw error;
    }
  }

  #enqueue(item: QueueItem): void {
    const key = this.#queueKey(item.repository, item.runId, item.jobId);
    if (this.#queuedKeys.has(key)) return;
    this.#queuedKeys.add(key);
    this.#queue.push(item);
  }

  #drain(): void {
    if (this.#draining) return;
    this.#draining = true;
    queueMicrotask(() => {
      this.#draining = false;
      while (this.#active < this.#concurrency) {
        const item = this.#queue.shift();
        if (!item) break;
        const key = this.#queueKey(item.repository, item.runId, item.jobId);
        if (!this.#queuedKeys.delete(key)) continue;
        this.#active += 1;
        void this.#process(item).finally(() => {
          this.#active -= 1;
          this.#drain();
        });
      }
    });
  }

  #queueKey(repository: LocalImageRepository, runId: string, jobId: string): string {
    return `${repository.descriptor.repositoryId}:${runId}:${jobId}`;
  }

  async #process(item: QueueItem): Promise<void> {
    const repository = item.repository;
    const jobPath = jobRecordPath(item.jobId);
    let job = await repository.readJson(jobPath, localJobSchema);
    if (job.runId !== item.runId || job.status !== 'queued') return;
    const attemptId = randomUUID();
    const startedAt = new Date().toISOString();
    job = localJobSchema.parse({
      ...job,
      status: 'running',
      attempts: [
        ...job.attempts,
        {
          attemptId,
          ordinal: job.attempts.length + 1,
          status: 'started',
          startedAt,
        },
      ],
      updatedAt: startedAt,
    });
    await repository.writeJson(jobPath, job, localJobSchema);
    await this.#refreshRun(repository, job.runId);
    const publishedOutputs: PublishedOutput[] = [];

    try {
      const capability = getCapability(job.targetId);
      const payload = await hydrateInputs(repository, job.request, job.inputs);
      const validatedPayload = capability.requestSchema.parse(payload);
      const invocationId =
        capability.invocation.kind === 'foundation-model'
          ? capability.invocation.modelId
          : capability.invocation.profileId;
      const result = await this.#bedrock.invoke(invocationId, validatedPayload);
      const response = capability.responseSchema.parse(
        JSON.parse(new TextDecoder().decode(result.body)),
      );
      const destinationDirectory = item.destinationDirectory;
      const outputImageIds: string[] = [];
      const finishReasons = response.finish_reasons;
      const images = response.images ?? [];
      if (finishReasons.some((reason) => reason !== null)) {
        throw new Error(
          finishReasons.find((reason) => reason !== null) ?? 'Provider filtered output',
        );
      }
      if (images.length === 0) throw new Error('Provider response contained no image output');
      const snapshot = await this.#getSnapshot(repository, job.runId);
      if (!snapshot) throw new Error('Run disappeared while processing');
      for (const [index, encoded] of images.entries()) {
        const bytes = decodeCanonicalBase64(encoded, { label: 'Provider image data' });
        const inspected = await inspectImage(bytes);
        const mediaType = mediaTypeFromImageFormat(inspected.format);
        if (!mediaType) throw new Error('Provider returned an unsupported image format');
        const requestedMediaType = mediaTypeForOutputFormat(
          outputFormatSchema.parse(job.request['output_format']),
        );
        if (mediaType !== requestedMediaType) {
          throw new Error('Provider output format did not match the request');
        }
        const imageId = randomUUID();
        const { format, extension } = outputFileForMediaType(mediaType);
        const imagePath = `${destinationDirectory}/${new Date().toISOString().slice(0, 10)}--${promptSlug(job.request)}--${imageId}.${extension}`;
        const providerSeed = response.seeds?.[index] ?? response.seeds?.[0] ?? null;
        const sidecar = generatedImageSidecarSchema.parse({
          schemaVersion: 1,
          imageId,
          repositoryRelativePath: imagePath,
          ...(job.destination.kind === 'main' ? {} : { projectId: job.destination.projectId }),
          ...(job.destination.kind === 'project-asset'
            ? { projectAssetId: job.destination.projectAssetId }
            : {}),
          createdAt: new Date().toISOString(),
          runId: job.runId,
          jobId: job.jobId,
          attemptId,
          capabilityRegistryVersion: CAPABILITY_REGISTRY_VERSION,
          canonicalTargetId: job.targetId,
          invocationId,
          ...(typeof job.request['prompt'] === 'string' ? { prompt: job.request['prompt'] } : {}),
          ...(typeof job.request['negative_prompt'] === 'string'
            ? { negativePrompt: job.request['negative_prompt'] }
            : {}),
          normalizedRequest: job.request,
          seed: {
            strategy: snapshot.run.seedPlan.strategy,
            planned: job.plannedSeed,
            provider: providerSeed,
          },
          output: {
            format,
            mediaType,
            width: inspected.width,
            height: inspected.height,
            byteLength: bytes.byteLength,
            sha256: sha256Hex(bytes),
          },
          inputs: job.inputs.map((input) => ({
            role: input.role,
            imageId: input.imageId,
            repositoryRelativePath: input.repositoryRelativePath,
            sha256: input.sha256,
            mediaType: input.mediaType,
          })),
          provider: {
            finishReason: finishReasons[index] ?? null,
            ...(result.requestId ? { requestId: result.requestId } : {}),
            metadata: result.metadata,
          },
        });
        const sidecarPath = imageSidecarPath(imagePath);
        await repository.publishImmutableWithSidecar(
          imagePath,
          bytes,
          sidecarPath,
          sidecar,
          generatedImageSidecarSchema,
        );
        publishedOutputs.push({ imagePath, sidecarPath });
        outputImageIds.push(imageId);
      }
      const finishedAt = new Date().toISOString();
      job = localJobSchema.parse({
        ...job,
        status: 'completed',
        providerSeed: response.seeds?.[0] ?? null,
        outputImageIds,
        attempts: job.attempts.map((attempt) =>
          attempt.attemptId === attemptId
            ? {
                ...attempt,
                status: 'succeeded',
                finishedAt,
                ...(result.requestId ? { providerRequestId: result.requestId } : {}),
              }
            : attempt,
        ),
        updatedAt: finishedAt,
      });
    } catch (error) {
      const errorMessage = (
        error instanceof Error ? error.message : 'Unknown generation failure'
      ).slice(0, 2000);
      const discarded = await this.#discardFailedJob(repository, job, publishedOutputs);
      this.#recordFailure(repository, {
        runId: job.runId,
        error: errorMessage,
        discarded,
        destination: job.destination,
      });
      return;
    }
    await repository.writeJson(jobPath, job, localJobSchema);
    await this.#refreshRun(repository, job.runId);
  }

  #recordFailure(repository: LocalImageRepository, failure: PendingGenerationFailure): void {
    const repositoryId = repository.descriptor.repositoryId;
    const pending = this.#failuresByRepository.get(repositoryId) ?? [];
    const next = [
      ...pending.filter((candidate) => candidate.runId !== failure.runId),
      failure,
    ].slice(-64);
    this.#failuresByRepository.set(repositoryId, next);
  }

  async #discardFailedJob(
    repository: LocalImageRepository,
    job: LocalJob,
    publishedOutputs: readonly PublishedOutput[] = [],
  ): Promise<boolean> {
    const inputPaths = new Set(job.inputs.map((input) => input.repositoryRelativePath));
    let discarded = true;
    await repository.withMutation(async () => {
      const outputs = new Map(
        publishedOutputs.map((output) => [output.imagePath, output] as const),
      );
      await this.#walkGeneratedSidecars(repository, (sidecar) => {
        if (sidecar.jobId !== job.jobId) return;
        outputs.set(sidecar.repositoryRelativePath, {
          imagePath: sidecar.repositoryRelativePath,
          sidecarPath: imageSidecarPath(sidecar.repositoryRelativePath),
        });
      });
      for (const output of [...outputs.values()].reverse()) {
        await repository.removeRelative(output.sidecarPath, { missingOk: true });
        await repository.removeRelative(output.imagePath, { missingOk: true });
      }

      const runPath = runRecordPath(job.runId);
      if (await repository.exists(runPath)) {
        const run = await repository.readJson(runPath, localRunSchema);
        const remainingJobs: LocalJob[] = [];
        for (const jobId of run.jobIds.filter((candidate) => candidate !== job.jobId)) {
          const path = jobRecordPath(jobId);
          if (await repository.exists(path)) {
            remainingJobs.push(await repository.readJson(path, localJobSchema));
          }
        }
        if (remainingJobs.length === 0) {
          await repository.removeRelative(runPath, { missingOk: true });
        } else {
          discarded = false;
          const updated = localRunSchema.parse({
            ...run,
            status: summarizeRunStatus(remainingJobs),
            requestedJobCount: remainingJobs.length,
            jobIds: remainingJobs.map((candidate) => candidate.jobId),
            updatedAt: new Date().toISOString(),
          });
          await repository.writeJson(runPath, updated, localRunSchema);
        }
      }
      await repository.removeRelative(jobRecordPath(job.jobId), { missingOk: true });
      await this.#removeUnreferencedInputs(repository, inputPaths);
    });
    return discarded;
  }

  async #removeUnreferencedInputs(
    repository: LocalImageRepository,
    candidates: Set<string>,
  ): Promise<void> {
    if (candidates.size === 0) return;
    for (const file of await repository.listFiles('.image-harness/jobs')) {
      if (!file.endsWith('.json')) continue;
      const job = await repository.readJson(`.image-harness/jobs/${file}`, localJobSchema);
      for (const input of job.inputs) candidates.delete(input.repositoryRelativePath);
      if (candidates.size === 0) return;
    }
    await this.#walkGeneratedSidecars(repository, (sidecar) => {
      for (const input of sidecar.inputs) candidates.delete(input.repositoryRelativePath);
    });
    for (const path of candidates) {
      await repository.removeRelative(path, { missingOk: true });
    }
  }

  async #getSnapshot(
    repository: LocalImageRepository,
    runId: string,
  ): Promise<RunSnapshot | undefined> {
    const path = runRecordPath(runId);
    if (!(await repository.exists(path))) return undefined;
    const run = await repository.readJson(path, localRunSchema);
    const jobs: LocalJob[] = [];
    for (const jobId of run.jobIds) {
      const path = jobRecordPath(jobId);
      if (!(await repository.exists(path))) return undefined;
      jobs.push(await repository.readJson(path, localJobSchema));
    }
    return { run, jobs };
  }

  async #refreshRun(repository: LocalImageRepository, runId: string): Promise<void> {
    const snapshot = await this.#getSnapshot(repository, runId);
    if (!snapshot) return;
    const updated = localRunSchema.parse({
      ...snapshot.run,
      status: summarizeRunStatus(snapshot.jobs),
      updatedAt: new Date().toISOString(),
    });
    await repository.writeJson(runRecordPath(runId), updated, localRunSchema);
  }

  async #walkGeneratedSidecars(
    repository: LocalImageRepository,
    visit: (sidecar: GeneratedImageSidecar) => void | Promise<void>,
  ): Promise<void> {
    const walk = async (directory: string): Promise<void> => {
      for (const file of await repository.listFiles(directory)) {
        if (!file.endsWith('.image.json')) continue;
        const path = `${directory}/${file}`;
        try {
          await visit(await repository.readJson(path, generatedImageSidecarSchema));
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new Error(`Malformed generated image metadata: ${path}`);
          }
          throw error;
        }
      }
      for (const child of await repository.listDirectories(directory)) {
        await walk(`${directory}/${child}`);
      }
    };
    await walk('images');
    await walk('projects');
  }
}
