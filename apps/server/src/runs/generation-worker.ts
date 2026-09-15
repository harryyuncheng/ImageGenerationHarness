import { randomUUID } from 'node:crypto';
import { CAPABILITY_REGISTRY_VERSION, getCapability } from '@harness/capabilities';
import { outputFormatSchema, type GenerationFailure } from '@harness/contracts';
import { generatedImageSidecarSchema, localJobSchema, type LocalJob } from '@harness/domain';
import { characterizeImageData, imageSidecarPath, mediaTypeForOutputFormat } from '@harness/image';
import { publicErrorMessage } from '../app/api-error.js';
import type { ImageProviders } from '../providers/image-provider.js';
import { hydrateInputs } from './input-stager.js';
import { jobRecordPath, promptSlug } from './run-helpers.js';
import type { RunStore } from './run-store.js';
import type { RunQueueItem } from './run-types.js';

export class GenerationWorker {
  readonly #providers: ImageProviders;
  readonly #runs: RunStore;
  readonly #recordFailure: (
    repository: RunQueueItem['repository'],
    failure: GenerationFailure,
  ) => void;

  constructor(options: {
    providers: ImageProviders;
    runStore: RunStore;
    recordFailure: (repository: RunQueueItem['repository'], failure: GenerationFailure) => void;
  }) {
    this.#providers = options.providers;
    this.#runs = options.runStore;
    this.#recordFailure = options.recordFailure;
  }

  async process(item: RunQueueItem): Promise<void> {
    const repository = item.repository;
    const jobPath = jobRecordPath(item.jobId);
    let job: LocalJob | undefined;
    const attemptId = randomUUID();
    let savingCompletion = false;
    try {
      await repository.withMutation(async () => {
        const snapshot = await this.#runs.getSnapshot(repository, item.runId);
        const queued = snapshot?.jobs.find((candidate) => candidate.jobId === item.jobId);
        if (queued?.status !== 'queued') return;
        const startedAt = new Date().toISOString();
        job = localJobSchema.parse({
          ...queued,
          status: 'running',
          attempts: [
            ...queued.attempts,
            {
              attemptId,
              ordinal: queued.attempts.length + 1,
              status: 'started',
              startedAt,
            },
          ],
          updatedAt: startedAt,
        });
        await repository.writeJson(jobPath, job, localJobSchema);
        await this.#runs.refreshRun(repository, job.runId);
      });
      if (!job) return;
      const capability = getCapability(job.targetId);
      const request = capability.requestSchema.parse(job.request) as Record<string, unknown>;
      const requestedMediaType = mediaTypeForOutputFormat(
        outputFormatSchema.parse(request['output_format']),
      );
      const payload = await hydrateInputs(repository, request, job.inputs);
      const validatedPayload = capability.requestSchema.parse(payload) as Record<string, unknown>;
      const result = await this.#providers[capability.providerId].invoke(
        capability,
        validatedPayload,
      );
      const outputImageIds: string[] = [];
      const snapshot = await this.#runs.getSnapshot(repository, job.runId);
      if (!snapshot) throw new Error('Run disappeared while processing');
      for (const output of result.images) {
        const imageData = await characterizeImageData(output.base64, {
          label: 'Provider image data',
        });
        if (imageData.mediaType !== requestedMediaType) {
          throw new Error('Provider output format did not match the request');
        }
        const imageId = randomUUID();
        const imagePath = `images/${new Date().toISOString().slice(0, 10)}--${promptSlug(job.request)}--${imageId}.${imageData.extension}`;
        const sidecar = generatedImageSidecarSchema.parse({
          schemaVersion: 1,
          imageId,
          repositoryRelativePath: imagePath,
          createdAt: new Date().toISOString(),
          runId: job.runId,
          jobId: job.jobId,
          attemptId,
          capabilityRegistryVersion: CAPABILITY_REGISTRY_VERSION,
          canonicalTargetId: job.targetId,
          invocationId: result.invocationId,
          ...(typeof job.request['prompt'] === 'string' ? { prompt: job.request['prompt'] } : {}),
          ...(typeof job.request['negative_prompt'] === 'string'
            ? { negativePrompt: job.request['negative_prompt'] }
            : {}),
          normalizedRequest: request,
          ...(snapshot.run.settings === undefined ? {} : { settings: snapshot.run.settings }),
          seed: {
            strategy: snapshot.run.seedPlan.strategy,
            planned: job.plannedSeed,
            provider: output.seed,
          },
          output: {
            format: imageData.format,
            mediaType: imageData.mediaType,
            width: imageData.width,
            height: imageData.height,
            byteLength: imageData.byteLength,
            sha256: imageData.sha256,
          },
          inputs: job.inputs.map((input) => ({
            role: input.role,
            imageId: input.imageId,
            repositoryRelativePath: input.repositoryRelativePath,
            sha256: input.sha256,
            mediaType: input.mediaType,
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.styleGuide === undefined ? {} : { styleGuide: input.styleGuide }),
          })),
          provider: {
            finishReason: output.finishReason,
            ...(result.requestId ? { requestId: result.requestId } : {}),
            metadata: result.metadata,
          },
        });
        const sidecarPath = imageSidecarPath(imagePath);
        await repository.publishImmutableWithSidecar(
          imagePath,
          imageData.bytes,
          sidecarPath,
          sidecar,
          generatedImageSidecarSchema,
        );
        outputImageIds.push(imageId);
      }
      const finishedAt = new Date().toISOString();
      job = localJobSchema.parse({
        ...job,
        status: 'completed',
        providerSeed: result.images[0]?.seed ?? null,
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
      savingCompletion = true;
      const completed = job;
      await repository.withMutation(async () => {
        await repository.writeJson(jobPath, completed, localJobSchema);
        await this.#runs.refreshRun(repository, completed.runId);
      });
    } catch (error) {
      let errorMessage = publicErrorMessage(error);
      let discarded = false;
      let needsRecovery = !job || savingCompletion;
      if (job && !savingCompletion) {
        try {
          discarded = await this.#runs.discardFailedJob(repository, job);
        } catch (cleanupError) {
          needsRecovery = true;
          errorMessage =
            `Cleanup also failed: ${publicErrorMessage(cleanupError)}\n${errorMessage}`.slice(
              0,
              2000,
            );
        }
      }
      if (needsRecovery) {
        try {
          await this.#runs.interruptJob(repository, item.jobId);
        } catch (recoveryError) {
          errorMessage =
            `The interrupted state could not be saved: ${publicErrorMessage(recoveryError)}\n${errorMessage}`.slice(
              0,
              2000,
            );
        }
      }
      this.#recordFailure(repository, {
        runId: item.runId,
        error: errorMessage,
        discarded,
      });
    }
  }
}
