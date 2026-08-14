import { randomUUID } from 'node:crypto';
import { CAPABILITY_REGISTRY_VERSION, getCapability } from '@harness/capabilities';
import { outputFormatSchema } from '@harness/contracts';
import { generatedImageSidecarSchema, localJobSchema } from '@harness/domain';
import {
  decodeCanonicalBase64,
  imageSidecarPath,
  inspectImage,
  mediaTypeForOutputFormat,
  mediaTypeFromImageFormat,
  outputFileForMediaType,
  sha256Hex,
} from '@harness/image';
import type { BedrockInvoker } from '../providers/bedrock/adapter.js';
import { hydrateInputs } from './input-stager.js';
import { jobRecordPath, promptSlug } from './run-helpers.js';
import type { RunStore } from './run-store.js';
import type { PendingGenerationFailure, PublishedOutput, RunQueueItem } from './run-types.js';

export class GenerationWorker {
  readonly #bedrock: BedrockInvoker;
  readonly #runs: RunStore;
  readonly #recordFailure: (
    repository: RunQueueItem['repository'],
    failure: PendingGenerationFailure,
  ) => void;

  constructor(options: {
    bedrock: BedrockInvoker;
    runStore: RunStore;
    recordFailure: (
      repository: RunQueueItem['repository'],
      failure: PendingGenerationFailure,
    ) => void;
  }) {
    this.#bedrock = options.bedrock;
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
      const validatedPayload = capability.requestSchema.parse(payload);
      const invocationId =
        capability.invocation.kind === 'foundation-model'
          ? capability.invocation.modelId
          : capability.invocation.profileId;
      const result = await this.#bedrock.invoke(invocationId, validatedPayload);
      const response = capability.responseSchema.parse(
        JSON.parse(new TextDecoder().decode(result.body)),
      );
      const outputImageIds: string[] = [];
      const finishReasons = response.finish_reasons;
      const images = response.images ?? [];
      if (finishReasons.some((reason) => reason !== null)) {
        throw new Error(
          finishReasons.find((reason) => reason !== null) ?? 'Provider filtered output',
        );
      }
      if (images.length === 0) throw new Error('Provider response contained no image output');
      const snapshot = await this.#runs.getSnapshot(repository, job.runId);
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
        const imagePath = `${item.destinationDirectory}/${new Date().toISOString().slice(0, 10)}--${promptSlug(job.request)}--${imageId}.${extension}`;
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
