import { randomUUID } from 'node:crypto';
import { CAPABILITY_REGISTRY_VERSION, getCapability, type Capability } from '@harness/capabilities';
import type {
  GenerationFailure,
  GenerationInputReference,
  GenerationSetupSource,
  ProviderId,
  QueuedRunResponse,
} from '@harness/contracts';
import { localJobSchema, localRunSchema, SCHEMA_VERSION, type LocalJob } from '@harness/domain';
import { GeneratedImageStore } from '../images/generated-image-store.js';
import { ApiError, publicErrorMessage } from '../app/api-error.js';
import { StabilityBedrockAdapter } from '../providers/bedrock/adapter.js';
import { AzureFoundryAdapter } from '../providers/foundry/adapter.js';
import type { ImageProviders } from '../providers/image-provider.js';
import {
  LocalStyleGuideService,
  type StyleGuideService,
} from '../style-guide/style-guide-service.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import type { LocalRepositoryManager } from '../repository/repository-manager.js';
import { GenerationQueue } from './generation-queue.js';
import { GenerationWorker } from './generation-worker.js';
import { GenerationSetupStore } from './generation-setup.js';
import { InputStager } from './input-stager.js';
import {
  jobRecordPath,
  plannedSeed,
  requestedOutputCount,
  runRecordPath,
  summarizeRunStatus,
  validateSeedPlan,
} from './run-helpers.js';
import { RunStore } from './run-store.js';
import type {
  GalleryImage,
  GeneratedImageRecord,
  RunService,
  RunSnapshot,
  RunSubmission,
} from './run-types.js';

export class LocalRunService implements RunService {
  readonly #manager: LocalRepositoryManager;
  readonly #inputs: InputStager;
  readonly #runs: RunStore;
  readonly #images: GeneratedImageStore;
  readonly #setups: GenerationSetupStore;
  readonly #queue: GenerationQueue;
  readonly #providers: ImageProviders;
  readonly #failuresByRepository = new Map<string, GenerationFailure[]>();
  readonly #recoveredRepositories = new Set<string>();
  readonly #pendingRecoveries = new Map<LocalImageRepository, string>();
  #refillingRecovery = false;

  constructor(options: {
    manager: LocalRepositoryManager;
    styleGuideService?: StyleGuideService;
    providers?: ImageProviders;
    concurrency?: number;
    maxQueuedJobs?: number;
  }) {
    this.#manager = options.manager;
    const styleGuide = options.styleGuideService ?? new LocalStyleGuideService(options.manager);
    this.#images = new GeneratedImageStore(options.manager);
    this.#runs = new RunStore(this.#images);
    this.#setups = new GenerationSetupStore(this.#images, this.#runs, styleGuide);
    this.#inputs = new InputStager(styleGuide, this.#images, this.#setups);
    this.#providers = options.providers ?? {
      bedrock: new StabilityBedrockAdapter(),
      'azure-foundry': new AzureFoundryAdapter(),
    };
    const worker = new GenerationWorker({
      providers: this.#providers,
      runStore: this.#runs,
      recordFailure: (repository, failure) => {
        this.#recordFailure(repository, failure);
      },
    });
    this.#queue = new GenerationQueue({
      ...(options.concurrency === undefined ? {} : { concurrency: options.concurrency }),
      ...(options.maxQueuedJobs === undefined ? {} : { maxQueuedJobs: options.maxQueuedJobs }),
      process: (item) => worker.process(item),
      onError: (item, error) => {
        this.#recordFailure(item.repository, {
          runId: item.runId,
          error: publicErrorMessage(error),
          discarded: false,
        });
      },
      onAvailable: () => {
        void this.#enqueueRecoveredJobs();
      },
    });
  }

  isProviderConfigured(providerId: ProviderId): boolean {
    return this.#providers[providerId].configured;
  }

  async submit(input: RunSubmission): Promise<QueuedRunResponse> {
    const repository = this.#manager
      .getRecentRepositories()
      .find((candidate) => candidate.descriptor.repositoryId === input.repositoryId);
    if (!repository) {
      throw new ApiError(
        409,
        'The originating image repository is no longer available. Select it again before generating.',
      );
    }
    let capability: Capability;
    try {
      capability = getCapability(input.targetId);
    } catch {
      throw new ApiError(400, 'Unknown image service target.');
    }
    if (!this.#providers[capability.providerId].configured) {
      throw new ApiError(
        503,
        `${capability.name} is unavailable because its provider is not configured.`,
      );
    }
    validateSeedPlan(input.seedPlan, capability.seedMaximum);
    // Targets that accept `n` return the whole run from one billed call, so they use one job.
    const batches = capability.parameters.includes('n');
    const jobCount = batches ? 1 : input.requestedJobCount;
    const validatedRequest = capability.requestSchema.parse(input.request) as Record<
      string,
      unknown
    >;
    const now = new Date().toISOString();
    const runId = randomUUID();
    const jobs: LocalJob[] = [];
    this.#queue.reserve(jobCount);
    try {
      await repository.withMutation(async () => {
        const staged = await this.#inputs.stage(repository, validatedRequest);
        const stagedRequest = batches
          ? { ...staged.request, n: input.requestedJobCount }
          : staged.request;
        try {
          jobs.push(
            ...Array.from({ length: jobCount }, (_, index) => {
              const seed = plannedSeed(input.seedPlan, index, capability.seedMaximum);
              const request = capability.requestSchema.parse(
                capability.seedMaximum === undefined
                  ? stagedRequest
                  : { ...stagedRequest, seed: seed ?? 0 },
              ) as Record<string, unknown>;
              return localJobSchema.parse({
                schemaVersion: SCHEMA_VERSION,
                runId,
                jobId: randomUUID(),
                status: 'queued',
                targetId: input.targetId,
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
            requestedJobCount: input.requestedJobCount,
            seedPlan: input.seedPlan,
            ...(input.settings === undefined ? {} : { settings: input.settings }),
            ...(typeof validatedRequest['prompt'] === 'string'
              ? { prompt: validatedRequest['prompt'] }
              : {}),
            jobIds: jobs.map((job) => job.jobId),
            createdAt: now,
            updatedAt: now,
          });
          for (const job of jobs) {
            await repository.writeJson(jobRecordPath(job.jobId), job, localJobSchema);
          }
          await repository.writeJson(runRecordPath(run.runId), run, localRunSchema);
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
    } finally {
      this.#queue.release(jobCount);
    }
    const response: QueuedRunResponse = {
      runId,
      status: 'queued',
      jobs: jobs.map((job) => ({
        jobId: job.jobId,
        requestedOutputCount: requestedOutputCount(job),
      })),
    };
    for (const job of jobs) {
      this.#queue.enqueue({
        runId,
        jobId: job.jobId,
        repository,
      });
    }
    this.#queue.drain();
    return response;
  }

  async getSnapshot(runId: string): Promise<RunSnapshot | undefined> {
    return this.#runs.getSnapshot(this.#manager.getActiveRepository(), runId);
  }

  async listRuns(): Promise<{ runs: RunSnapshot[]; failures: GenerationFailure[] }> {
    const repository = this.#manager.getActiveRepository();
    const snapshots: RunSnapshot[] = [];
    const durable = await this.#runs.listSnapshots(repository);
    for (const snapshot of durable) {
      const failedJobs = snapshot.jobs.filter((job) => job.status === 'failed');
      if (failedJobs.length > 0) {
        for (const job of failedJobs) {
          await this.#runs.discardFailedJob(repository, job);
        }
        const remaining = await this.#runs.getSnapshot(repository, snapshot.run.runId);
        if (remaining) snapshots.push(remaining);
        continue;
      }
      snapshots.push(snapshot);
    }
    const failures = this.#failuresByRepository.get(repository.canonicalRoot) ?? [];
    this.#failuresByRepository.delete(repository.canonicalRoot);
    return {
      runs: snapshots.sort((left, right) => right.run.createdAt.localeCompare(left.run.createdAt)),
      failures,
    };
  }

  async cancel(runId: string): Promise<RunSnapshot> {
    const repository = this.#manager.getActiveRepository();
    const cancelled = await repository.withMutation(async () => {
      const snapshot = await this.#runs.getSnapshot(repository, runId);
      if (!snapshot) throw new ApiError(404, 'Run not found.');
      const now = new Date().toISOString();
      const jobs: LocalJob[] = [];
      for (const job of snapshot.jobs) {
        if (job.status === 'queued') {
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
    });
    for (const job of cancelled.jobs) {
      if (job.status === 'cancelled') this.#queue.cancel(repository, job.runId, job.jobId);
    }
    return cancelled;
  }

  getImage(imageId: string): Promise<GeneratedImageRecord | undefined> {
    return this.#images.getImage(imageId);
  }

  readImage(image: GeneratedImageRecord): Promise<Uint8Array> {
    return this.#images.readImage(image);
  }

  listImages(): Promise<GalleryImage[]> {
    return this.#images.listImages();
  }

  getGenerationSetup(source: GenerationSetupSource) {
    return this.#setups.get(this.#manager.getActiveRepository(), source);
  }

  async readGenerationInput(reference: GenerationInputReference) {
    const { input, bytes } = await this.#setups.readInput(
      this.#manager.getActiveRepository(),
      reference,
    );
    return { mediaType: input.mediaType, bytes };
  }

  async recover(): Promise<void> {
    for (const repository of this.#manager.getRecentRepositories()) {
      await repository.withMutation(async () => {
        if (this.#recoveredRepositories.has(repository.canonicalRoot)) return;
        for (const job of await this.#runs.listJobs(repository)) {
          if (this.#queue.has({ repository, runId: job.runId, jobId: job.jobId })) continue;
          const snapshot = await this.#runs.getSnapshot(repository, job.runId);
          if (!snapshot?.jobs.some((candidate) => candidate.jobId === job.jobId)) continue;
          if (job.status === 'failed') {
            await this.#runs.discardFailedJob(repository, job);
          } else if (job.status === 'queued') {
            this.#pendingRecoveries.set(repository, job.runId);
          } else if (job.status === 'running') {
            await this.#runs.interruptJob(repository, job.jobId);
          }
        }
        this.#recoveredRepositories.add(repository.canonicalRoot);
      });
    }
    await this.#enqueueRecoveredJobs();
  }

  async #enqueueRecoveredJobs(): Promise<void> {
    if (this.#refillingRecovery) return;
    this.#refillingRecovery = true;
    try {
      for (const [repository, runId] of this.#pendingRecoveries) {
        if (this.#queue.availableCapacity === 0) break;
        try {
          const complete = await repository.withMutation(() =>
            this.#runs.forEachJob(repository, async (job) => {
              if (job.status !== 'queued') return true;
              const snapshot = await this.#runs.getSnapshot(repository, job.runId);
              if (!snapshot?.jobs.some((candidate) => candidate.jobId === job.jobId)) return true;
              return this.#queue.enqueue({ repository, runId: job.runId, jobId: job.jobId });
            }),
          );
          if (complete) this.#pendingRecoveries.delete(repository);
        } catch (error) {
          this.#pendingRecoveries.delete(repository);
          this.#recoveredRepositories.delete(repository.canonicalRoot);
          this.#recordFailure(repository, {
            runId,
            error: `Queued job recovery could not continue. ${publicErrorMessage(error)}`.slice(
              0,
              2000,
            ),
            discarded: false,
          });
        }
      }
    } finally {
      this.#refillingRecovery = false;
      this.#queue.drain();
      if (this.#pendingRecoveries.size > 0 && this.#queue.availableCapacity > 0) {
        queueMicrotask(() => {
          void this.#enqueueRecoveredJobs();
        });
      }
    }
  }

  #recordFailure(repository: LocalImageRepository, failure: GenerationFailure): void {
    const pending = this.#failuresByRepository.get(repository.canonicalRoot) ?? [];
    const next = [
      ...pending.filter((candidate) => candidate.runId !== failure.runId),
      failure,
    ].slice(-64);
    this.#failuresByRepository.set(repository.canonicalRoot, next);
  }
}
