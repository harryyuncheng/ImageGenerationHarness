import { randomUUID } from 'node:crypto';
import { CAPABILITY_REGISTRY_VERSION, getCapability } from '@harness/capabilities';
import { outputFormatSchema } from '@harness/contracts';
import { generatedImageSidecarSchema, localJobSchema } from '@harness/domain';
import { characterizeImageData, imageSidecarPath, mediaTypeForOutputFormat } from '@harness/image';
import type { ImageProviders } from '../providers/image-provider.js';
import { hydrateInputs } from './input-stager.js';
import { jobRecordPath, promptSlug } from './run-helpers.js';
import type { RunStore } from './run-store.js';
import type { PendingGenerationFailure, PublishedOutput, RunQueueItem } from './run-types.js';

export class GenerationWorker {
  readonly #providers: ImageProviders;
  readonly #runs: RunStore;
  readonly #recordFailure: (
    repository: RunQueueItem['repository'],
    failure: PendingGenerationFailure,
  ) => void;

  constructor(options: {
    providers: ImageProviders;
    runStore: RunStore;
    recordFailure: (
      repository: RunQueueItem['repository'],
      failure: PendingGenerationFailure,
    ) => void;
  }) {
    this.#providers = options.providers;
    this.#runs = options.runStore;
    this.#recordFailure = options.recordFailure;
  }

  async process(item: RunQueueItem): Promise<void> {
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
    await this.#runs.refreshRun(repository, job.runId);
    const publishedOutputs: PublishedOutput[] = [];

    try {
      const capability = getCapability(job.targetId);
      const payload = await hydrateInputs(repository, job.request, job.inputs);
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
        const requestedMediaType = mediaTypeForOutputFormat(
          outputFormatSchema.parse(job.request['output_format']),
        );
        if (imageData.mediaType !== requestedMediaType) {
          throw new Error('Provider output format did not match the request');
        }
        const imageId = randomUUID();
        const imagePath = `${item.destinationDirectory}/${new Date().toISOString().slice(0, 10)}--${promptSlug(job.request)}--${imageId}.${imageData.extension}`;
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
          invocationId: result.invocationId,
          ...(typeof job.request['prompt'] === 'string' ? { prompt: job.request['prompt'] } : {}),
          ...(typeof job.request['negative_prompt'] === 'string'
            ? { negativePrompt: job.request['negative_prompt'] }
            : {}),
          normalizedRequest: job.request,
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
        publishedOutputs.push({ imagePath, sidecarPath });
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
    } catch (error) {
      const errorMessage = (
        error instanceof Error ? error.message : 'Unknown generation failure'
      ).slice(0, 2000);
      const discarded = await this.#runs.discardFailedJob(repository, job, publishedOutputs);
      this.#recordFailure(repository, {
        runId: job.runId,
        error: errorMessage,
        discarded,
        destination: job.destination,
      });
      return;
    }
    await repository.writeJson(jobPath, job, localJobSchema);
    await this.#runs.refreshRun(repository, job.runId);
  }
}
