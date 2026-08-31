import { randomUUID } from 'node:crypto';
import { CAPABILITY_REGISTRY_VERSION, getCapability } from '@harness/capabilities';
import type { GenerationFailure, ProviderId } from '@harness/contracts';
import {
  localJobSchema,
  localRunSchema,
  SCHEMA_VERSION,
  type Destination,
  type LocalJob,
} from '@harness/domain';
import { GeneratedImageStore } from '../images/generated-image-store.js';
import { StabilityBedrockAdapter } from '../providers/bedrock/adapter.js';
import { AzureFoundryAdapter } from '../providers/foundry/adapter.js';
import type { ImageProviders } from '../providers/image-provider.js';
import { LocalProjectService, type ProjectService } from '../projects/project-service.js';
import {
  LocalStyleGuideService,
  type StyleGuideService,
} from '../style-guide/style-guide-service.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import type { LocalRepositoryManager } from '../repository/repository-manager.js';
import { GenerationQueue } from './generation-queue.js';
import { GenerationWorker } from './generation-worker.js';
import { InputStager } from './input-stager.js';
import {
  jobRecordPath,
  plannedSeed,
  runRecordPath,
  sameDestination,
  summarizeRunStatus,
  validateSeedPlan,
} from './run-helpers.js';
import { RunStore } from './run-store.js';
import type {
  GalleryImage,
  GeneratedImageRecord,
  PendingGenerationFailure,
  RunService,
  RunSnapshot,
  RunSubmission,
} from './run-types.js';

export class LocalRunService implements RunService {
  readonly #manager: LocalRepositoryManager;
  readonly #projects: ProjectService;
  readonly #inputs: InputStager;
  readonly #runs: RunStore;
  readonly #images: GeneratedImageStore;
  readonly #queue: GenerationQueue;
  readonly #providers: ImageProviders;
  readonly #failuresByRepository = new Map<string, PendingGenerationFailure[]>();

  constructor(options: {
    manager: LocalRepositoryManager;
    projectService?: ProjectService;
    styleGuideService?: StyleGuideService;
    providers?: ImageProviders;
    concurrency?: number;
    maxQueuedJobs?: number;
  }) {
    this.#manager = options.manager;
    this.#projects = options.projectService ?? new LocalProjectService(options.manager);
    const styleGuide = options.styleGuideService ?? new LocalStyleGuideService(options.manager);
    this.#inputs = new InputStager(styleGuide);
    this.#images = new GeneratedImageStore(options.manager);
    this.#runs = new RunStore(this.#images);
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
    });
  }

  isProviderConfigured(providerId: ProviderId): boolean {
    return this.#providers[providerId].configured;
  }

  async submit(input: RunSubmission): Promise<{ runId: string }> {
    const repository = this.#manager.getActiveRepository();
    const capability = getCapability(input.targetId);
    if (!this.#providers[capability.providerId].configured) {
      throw new Error(`${capability.name} is unavailable because its provider is not configured.`);
    }
    validateSeedPlan(input.seedPlan, capability.seedMaximum);
    const destinationDirectory = await this.#projects.resolveDestinationDirectory(
      input.destination,
    );
    // Targets that accept `n` return the whole run from one billed call, so they use one job.
    const batches = capability.parameters.includes('n');
    const jobCount = batches ? 1 : input.requestedJobCount;
    this.#queue.assertCapacity(jobCount);
    const validatedRequest = capability.requestSchema.parse(input.request) as Record<
      string,
      unknown
    >;
    const now = new Date().toISOString();
    const runId = randomUUID();
    const jobs: LocalJob[] = [];
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
              seed === null ? stagedRequest : { ...stagedRequest, seed },
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
      this.#queue.enqueue({
        runId,
        jobId: job.jobId,
        repository,
        destinationDirectory,
      });
    }
    this.#queue.drain();
    return { runId };
  }

  async getSnapshot(runId: string): Promise<RunSnapshot | undefined> {
    return this.#runs.getSnapshot(this.#manager.getActiveRepository(), runId);
  }

  async listRuns(destination?: Destination): Promise<RunSnapshot[]> {
    const repository = this.#manager.getActiveRepository();
    const snapshots: RunSnapshot[] = [];
    const durable = await this.#runs.listSnapshots(
      repository,
      (run) => !destination || sameDestination(run.destination, destination),
    );
    for (const snapshot of durable) {
      if (snapshot.run.status === 'failed') {
        for (const job of snapshot.jobs.filter((candidate) => candidate.status === 'failed')) {
          await this.#runs.discardFailedJob(repository, job);
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
        this.#queue.cancel(repository, job.runId, job.jobId);
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

  getImage(imageId: string): Promise<GeneratedImageRecord | undefined> {
    return this.#images.getImage(imageId);
  }

  readImage(image: GeneratedImageRecord): Promise<Uint8Array> {
    return this.#images.readImage(image);
  }

  listImages(destination?: Destination): Promise<GalleryImage[]> {
    return this.#images.listImages(destination);
  }

  async recover(): Promise<void> {
    const repository = this.#manager.getActiveRepository();
    const affectedRuns = new Set<string>();
    for (const job of await this.#runs.listJobs(repository)) {
      const path = jobRecordPath(job.jobId);
      if (job.status === 'failed') {
        await this.#runs.discardFailedJob(repository, job);
      } else if (job.status === 'queued') {
        const destinationDirectory = await this.#projects.resolveDestinationDirectory(
          job.destination,
        );
        this.#queue.enqueue({
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
                  'The server stopped during an active provider invocation. The outcome and billing are ambiguous.',
              }
            : attempt,
        );
        const interrupted = localJobSchema.parse({
          ...job,
          status: 'interrupted',
          attempts,
          errorCode: 'Interrupted',
          errorMessage:
            'The server stopped during an active provider invocation. Retry explicitly.',
          updatedAt: now,
        });
        await repository.writeJson(path, interrupted, localJobSchema);
        affectedRuns.add(job.runId);
      }
    }
    for (const runId of affectedRuns) await this.#runs.refreshRun(repository, runId);
    this.#queue.drain();
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
}
