import { randomUUID } from 'node:crypto';
import { CAPABILITY_REGISTRY_VERSION, getCapability } from '@harness/capabilities';
import type { GenerationFailure } from '@harness/contracts';
import {
  localJobSchema,
  localRunSchema,
  SCHEMA_VERSION,
  type Destination,
  type GeneratedImageSidecar,
  type LocalJob,
} from '@harness/domain';
import { GeneratedImageStore } from '../images/generated-image-store.js';
import { StabilityBedrockAdapter, type BedrockInvoker } from '../providers/bedrock/adapter.js';
import { LocalProjectService, type ProjectService } from '../projects/project-service.js';
import {
  LocalReferenceLibraryService,
  type ReferenceLibraryService,
} from '../references/reference-library-service.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import type { LocalRepositoryManager } from '../repository/repository-manager.js';
import { GenerationQueue } from './generation-queue.js';
import { GenerationWorker } from './generation-worker.js';
import { hydrateInputs, InputStager } from './input-stager.js';
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
  readonly #failuresByRepository = new Map<string, PendingGenerationFailure[]>();

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
    const references =
      options.referenceLibraryService ?? new LocalReferenceLibraryService(options.manager);
    this.#inputs = new InputStager(references);
    this.#images = new GeneratedImageStore(options.manager);
    this.#runs = new RunStore(this.#images);
    const worker = new GenerationWorker({
      bedrock: options.bedrock ?? new StabilityBedrockAdapter(),
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

  async submit(input: RunSubmission): Promise<{ runId: string }> {
    const repository = this.#manager.getActiveRepository();
    const capability = getCapability(input.targetId);
    validateSeedPlan(input.seedPlan, capability.seedMaximum);
    const destinationDirectory = await this.#projects.resolveDestinationDirectory(
      input.destination,
    );
    this.#queue.assertCapacity(input.requestedJobCount);
    const validatedRequest = capability.requestSchema.parse(input.request) as Record<
      string,
      unknown
    >;
    const now = new Date().toISOString();
    const runId = randomUUID();
    const jobs: LocalJob[] = [];
    await repository.withMutation(async () => {
      const staged = await this.#inputs.stage(repository, validatedRequest);
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
    const files = (await repository.listFiles('.image-harness/runs')).filter((file) =>
      file.endsWith('.json'),
    );
    const snapshots: RunSnapshot[] = [];
    for (const file of files) {
      const run = await repository.readJson(`.image-harness/runs/${file}`, localRunSchema);
      if (destination && JSON.stringify(run.destination) !== JSON.stringify(destination)) continue;
      const snapshot = await this.#runs.getSnapshot(repository, run.runId);
      if (!snapshot) continue;
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

  getImage(imageId: string): Promise<GeneratedImageRecord | undefined> {
    return this.#images.getImage(imageId);
  }

  getImageMetadata(imageId: string): Promise<GeneratedImageSidecar | undefined> {
    return this.#images.getImageMetadata(imageId);
  }

  readImage(image: GeneratedImageRecord): Promise<Uint8Array> {
    return this.#images.readImage(image);
  }

  listImages(destination?: Destination): Promise<GalleryImage[]> {
    return this.#images.listImages(destination);
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
