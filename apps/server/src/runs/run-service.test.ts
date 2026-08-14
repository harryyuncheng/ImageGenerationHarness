import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { localJobSchema, localRunSchema, SCHEMA_VERSION } from '@harness/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BedrockInvocationResult, BedrockInvoker } from '../providers/bedrock/adapter.js';
import { LocalProjectService } from '../projects/project-service.js';
import { LocalReferenceLibraryService } from '../references/reference-library-service.js';
import { ONE_PIXEL_PNG, TemporaryDirectoryScope } from '../test/support.js';
import { LocalRunService } from './run-service.js';

const response: BedrockInvocationResult = {
  body: new TextEncoder().encode(
    JSON.stringify({ seeds: [123], finish_reasons: [null], images: [ONE_PIXEL_PNG] }),
  ),
  requestId: 'mock-request-id',
  metadata: { httpStatusCode: 200, attempts: 1 },
};

const temporaryDirectories = new TemporaryDirectoryScope();

async function setup(bedrock: BedrockInvoker, maxQueuedJobs?: number) {
  const { manager } = await temporaryDirectories.createSelectedRepository('image-harness-runs-');
  const projects = new LocalProjectService(manager);
  const references = new LocalReferenceLibraryService(manager);
  const service = new LocalRunService({
    manager,
    projectService: projects,
    referenceLibraryService: references,
    bedrock,
    ...(maxQueuedJobs === undefined ? {} : { maxQueuedJobs }),
  });
  return { manager, projects, references, repository: manager.getActiveRepository(), service };
}

async function waitForStatus(
  service: LocalRunService,
  runId: string,
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted',
) {
  await vi.waitFor(
    async () => {
      expect((await service.getSnapshot(runId))?.run.status).toBe(status);
    },
    { timeout: 5000 },
  );
}

async function waitForDiscarded(service: LocalRunService, runId: string) {
  await vi.waitFor(
    async () => {
      expect(await service.getSnapshot(runId)).toBeUndefined();
    },
    { timeout: 5000 },
  );
}

afterEach(async () => {
  await temporaryDirectories.cleanup();
});

describe('local generation pipeline', () => {
  it('invokes mocked Bedrock directly and places strict sidecars in every destination', async () => {
    const payloads: unknown[] = [];
    const invoke = vi.fn((modelId: string, payload: unknown) => {
      expect(modelId).toMatch(/^stability\./u);
      payloads.push(payload);
      return Promise.resolve(response);
    });
    const { projects, service } = await setup({ invoke });
    const project = await projects.createProject({
      name: 'Autumn campaign',
      description: 'Organization only; never a prompt.',
    });
    const asset = await projects.createProjectAsset(project.projectId, {
      name: 'Hero product',
      description: 'Nested organization only.',
    });
    const destinations = [
      { kind: 'main' as const },
      { kind: 'project' as const, projectId: project.projectId },
      {
        kind: 'project-asset' as const,
        projectId: project.projectId,
        projectAssetId: asset.assetId,
      },
    ];
    const prefixes = ['images/', `${project.directory}/images/`, `${asset.directory}/images/`];

    for (const [index, destination] of destinations.entries()) {
      const exactPrompt = `  exact prompt ${String(index)}  `;
      const { runId } = await service.submit({
        targetId: 'generation/core',
        request: { prompt: exactPrompt, aspect_ratio: '1:1', output_format: 'png', seed: 0 },
        requestedJobCount: 1,
        seedPlan: { strategy: 'fixed-repeat', seed: 42 },
        destination,
      });
      await waitForStatus(service, runId, 'completed');
      const snapshot = await service.getSnapshot(runId);
      const imageId = snapshot?.jobs[0]?.outputImageIds[0];
      if (!imageId) throw new Error('Missing generated image identifier');
      const metadata = await service.getImageMetadata(imageId);
      expect(metadata?.repositoryRelativePath.startsWith(prefixes[index] ?? '')).toBe(true);
      expect(metadata).toMatchObject({
        schemaVersion: 1,
        runId,
        imageId,
        prompt: exactPrompt,
        canonicalTargetId: 'generation/core',
        invocationId: 'stability.stable-image-core-v1:1',
        seed: { strategy: 'fixed-repeat', planned: 42, provider: 123 },
        output: {
          format: 'png',
          mediaType: 'image/png',
          width: 1,
          height: 1,
        },
        provider: { requestId: 'mock-request-id' },
      });
      expect(metadata?.output.sha256).toMatch(/^[a-f0-9]{64}$/u);
      const serialized = JSON.stringify(metadata);
      expect(serialized).not.toContain(ONE_PIXEL_PNG);
      expect(serialized).not.toContain(project.description);
      expect(serialized).not.toContain(asset.description);
      expect(serialized).not.toContain(parentAbsolutePathPattern());
      expect(payloads.at(-1)).toMatchObject({ prompt: exactPrompt });
    }
  });

  it('cancels only queued jobs while an active invocation finishes honestly', async () => {
    let finishInvocation: ((value: BedrockInvocationResult) => void) | undefined;
    const invoke = vi.fn(
      () =>
        new Promise<BedrockInvocationResult>((resolve) => {
          finishInvocation = resolve;
        }),
    );
    const { service } = await setup({ invoke });
    const { runId } = await service.submit({
      targetId: 'generation/core',
      request: { prompt: 'Two jobs', aspect_ratio: '1:1', output_format: 'png', seed: 0 },
      requestedJobCount: 2,
      seedPlan: { strategy: 'fixed-repeat', seed: 1 },
      destination: { kind: 'main' },
    });
    await waitForStatus(service, runId, 'running');
    const cancelled = await service.cancel(runId);
    expect(cancelled.jobs.map((job) => job.status).sort()).toEqual(['cancelled', 'running']);
    if (!finishInvocation) throw new Error('The mock invocation did not start');
    finishInvocation(response);
    await waitForStatus(service, runId, 'completed');
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('discards failed attempts and reports their error once without retaining staged inputs', async () => {
    const invoke = vi.fn(() => Promise.reject(new Error('Bedrock rejected this generation')));
    const { repository, service } = await setup({ invoke });
    const { runId } = await service.submit({
      targetId: 'generation/ultra',
      request: {
        mode: 'image-to-image',
        prompt: 'Keep this draft',
        image: ONE_PIXEL_PNG,
        strength: 0.5,
        output_format: 'png',
        seed: 0,
      },
      requestedJobCount: 1,
      seedPlan: { strategy: 'fixed-repeat', seed: 7 },
      destination: { kind: 'main' },
    });

    await waitForDiscarded(service, runId);
    await vi.waitFor(async () => {
      expect(await repository.listFiles('.image-harness/jobs')).toEqual([]);
      expect(await repository.listFiles('.image-harness/inputs')).toEqual([]);
    });

    expect(await service.listRuns()).toEqual([]);
    expect(await repository.listFiles('.image-harness/runs')).toEqual([]);
    expect(await repository.listFiles('.image-harness/jobs')).toEqual([]);
    expect(await repository.listFiles('.image-harness/inputs')).toEqual([]);
    expect(service.consumeFailures()).toEqual([
      { runId, error: 'Bedrock rejected this generation', discarded: true },
    ]);
    expect(service.consumeFailures()).toEqual([]);
  });

  it('snapshots local references before queueing so library deletion cannot break hydration', async () => {
    let finishFirst: ((value: BedrockInvocationResult) => void) | undefined;
    const payloads: unknown[] = [];
    const invoke = vi.fn((modelId: string, payload: unknown) => {
      expect(modelId).toMatch(/^stability\./u);
      payloads.push(payload);
      if (invoke.mock.calls.length === 1) {
        return new Promise<BedrockInvocationResult>((resolve) => {
          finishFirst = resolve;
        });
      }
      return Promise.resolve(response);
    });
    const { references, service } = await setup({ invoke });
    const blocking = await service.submit({
      targetId: 'generation/core',
      request: { prompt: 'Blocking', aspect_ratio: '1:1', output_format: 'png', seed: 0 },
      requestedJobCount: 1,
      seedPlan: { strategy: 'fixed-repeat', seed: 1 },
      destination: { kind: 'main' },
    });
    await waitForStatus(service, blocking.runId, 'running');

    const folder = await references.createFolder('Local inputs');
    const reference = await references.createImage(folder.folderId, {
      name: 'source.png',
      mediaType: 'image/png',
      data: ONE_PIXEL_PNG,
    });
    const queued = await service.submit({
      targetId: 'generation/ultra',
      request: {
        mode: 'image-to-image',
        prompt: 'Use local bytes',
        image: `repo-image://${reference.imageId}`,
        strength: 0.5,
        output_format: 'png',
        seed: 0,
      },
      requestedJobCount: 1,
      seedPlan: { strategy: 'fixed-repeat', seed: 2 },
      destination: { kind: 'main' },
    });
    await references.deleteImage(folder.folderId, reference.imageId);
    if (!finishFirst) throw new Error('The blocking invocation did not start');
    finishFirst(response);
    await waitForStatus(service, queued.runId, 'completed');

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(payloads[1]).toMatchObject({
      prompt: 'Use local bytes',
      image: ONE_PIXEL_PNG,
    });
    const snapshot = await service.getSnapshot(queued.runId);
    expect(snapshot?.jobs[0]?.inputs[0]?.repositoryRelativePath).toMatch(
      /^\.image-harness\/inputs\//u,
    );
  });

  it('marks a previously running attempt ambiguous on restart and bounds the local queue', async () => {
    let finishInvocation: ((value: BedrockInvocationResult) => void) | undefined;
    const invoke = vi.fn(
      () =>
        new Promise<BedrockInvocationResult>((resolve) => {
          finishInvocation = resolve;
        }),
    );
    const { repository, service } = await setup({ invoke }, 1);
    const first = await service.submit({
      targetId: 'generation/core',
      request: { prompt: 'Blocking', aspect_ratio: '1:1', output_format: 'png', seed: 0 },
      requestedJobCount: 1,
      seedPlan: { strategy: 'fixed-repeat', seed: 1 },
      destination: { kind: 'main' },
    });
    await waitForStatus(service, first.runId, 'running');
    await expect(
      service.submit({
        targetId: 'generation/core',
        request: { prompt: 'Overflow', aspect_ratio: '1:1', output_format: 'png', seed: 0 },
        requestedJobCount: 1,
        seedPlan: { strategy: 'fixed-repeat', seed: 2 },
        destination: { kind: 'main' },
      }),
    ).rejects.toThrow(/queue is full/iu);
    if (!finishInvocation) throw new Error('The mock invocation did not start');
    finishInvocation(response);
    await waitForStatus(service, first.runId, 'completed');

    const runId = randomUUID();
    const jobId = randomUUID();
    const attemptId = randomUUID();
    const now = new Date().toISOString();
    const run = localRunSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      runId,
      status: 'running',
      registryVersion: 'test',
      targetId: 'generation/core',
      destination: { kind: 'main' },
      requestedJobCount: 1,
      seedPlan: { strategy: 'fixed-repeat', seed: 3 },
      prompt: 'Interrupted',
      jobIds: [jobId],
      createdAt: now,
      updatedAt: now,
    });
    const job = localJobSchema.parse({
      schemaVersion: SCHEMA_VERSION,
      runId,
      jobId,
      status: 'running',
      targetId: 'generation/core',
      destination: { kind: 'main' },
      request: { prompt: 'Interrupted', aspect_ratio: '1:1', output_format: 'png', seed: 3 },
      inputs: [],
      plannedSeed: 3,
      providerSeed: null,
      outputImageIds: [],
      attempts: [{ attemptId, ordinal: 1, status: 'started', startedAt: now }],
      createdAt: now,
      updatedAt: now,
    });
    await repository.writeJson(`.image-harness/runs/${runId}.json`, run, localRunSchema);
    await repository.writeJson(`.image-harness/jobs/${jobId}.json`, job, localJobSchema);
    await service.recover();
    const recovered = await service.getSnapshot(runId);
    expect(recovered?.run.status).toBe('interrupted');
    expect(recovered?.jobs[0]).toMatchObject({
      status: 'interrupted',
      attempts: [{ status: 'ambiguous', errorCode: 'Interrupted' }],
    });
  });
});

function parentAbsolutePathPattern(): string {
  return `${tmpdir()}/image-harness-runs-`;
}
