import { describe, expect, it, vi } from 'vitest';
import {
  createInjectedServices,
  HEADERS,
  RUN_ID,
  RETRY_RUN_ID,
  PROJECT_ID,
  ASSET_ID,
  JOB_ID,
  IMAGE_ID,
  referenceImage,
  run,
  snapshot,
  RepositoryUnavailableError,
  openApp,
} from './app-test-support.js';

describe('local run API', () => {
  it('defaults destination, filters durable history, and returns path-free polling DTOs', async () => {
    const services = createInjectedServices();
    const submit = vi.fn(() => Promise.resolve({ runId: RUN_ID }));
    const listRuns = vi.fn(() => Promise.resolve([snapshot]));
    services.runService.submit = submit;
    services.runService.getSnapshot = vi.fn(() => Promise.resolve(snapshot));
    services.runService.listRuns = listRuns;
    services.runService.cancel = vi.fn(() => Promise.resolve(snapshot));
    services.runService.retry = vi.fn(() => Promise.resolve({ runId: RETRY_RUN_ID }));
    const app = await openApp(services);

    const submitted = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: HEADERS,
      payload: {
        targetId: 'generation/core',
        request: { prompt: 'A small blue house', aspect_ratio: '1:1' },
        requestedJobCount: 1,
        seedPlan: { strategy: 'harness-random' },
      },
    });
    const history = await app.inject({
      method: 'GET',
      url: `/api/runs?destination=project-asset&projectId=${PROJECT_ID}&projectAssetId=${ASSET_ID}`,
      headers: HEADERS,
    });
    const polled = await app.inject({
      method: 'GET',
      url: `/api/runs/${RUN_ID}`,
      headers: HEADERS,
    });
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/runs/${RUN_ID}/cancel`,
      headers: HEADERS,
    });
    const retried = await app.inject({
      method: 'POST',
      url: `/api/runs/${RUN_ID}/retry`,
      headers: HEADERS,
    });

    expect(submitted.statusCode).toBe(202);
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ destination: { kind: 'main' } }));
    expect(history.statusCode).toBe(200);
    expect(listRuns).toHaveBeenCalledWith({
      kind: 'project-asset',
      projectId: PROJECT_ID,
      projectAssetId: ASSET_ID,
    });
    const pollingDto = polled.json<{ jobs: Record<string, unknown>[] }>();
    expect(pollingDto).toMatchObject({
      run: { runId: RUN_ID, destination: run.destination },
      jobs: [
        {
          jobId: JOB_ID,
          outputImageIds: [IMAGE_ID],
        },
      ],
    });
    expect(pollingDto.jobs[0]).not.toHaveProperty('request');
    expect(pollingDto.jobs[0]).not.toHaveProperty('inputs');
    expect(polled.body).not.toContain('/Users/private');
    expect(polled.body).not.toContain(referenceImage.repositoryRelativePath);
    expect(cancelled.statusCode).toBe(200);
    expect(retried.statusCode).toBe(202);
    expect(retried.json()).toEqual({ runId: RETRY_RUN_ID, status: 'queued' });
  });

  it('returns 503 when no repository is active and rejects unknown body fields', async () => {
    const services = createInjectedServices();
    services.runService.submit = vi.fn(() => Promise.reject(new RepositoryUnavailableError()));
    const app = await openApp(services);

    const unavailable = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: HEADERS,
      payload: {
        targetId: 'generation/core',
        request: { prompt: 'A small blue house' },
        requestedJobCount: 1,
        seedPlan: { strategy: 'harness-random' },
      },
    });
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: HEADERS,
      payload: {
        targetId: 'generation/core',
        request: { prompt: 'A small blue house' },
        requestedJobCount: 1,
        seedPlan: { strategy: 'harness-random' },
        localPath: '/tmp/output',
      },
    });

    expect(unavailable.statusCode).toBe(503);
    expect(invalid.statusCode).toBe(400);
  });

  it('delivers a discarded generation error without adding a failed history record', async () => {
    const services = createInjectedServices();
    const consumeFailures = vi.fn(() => [
      { runId: RUN_ID, error: 'Bedrock rejected this generation', discarded: true },
    ]);
    services.runService.consumeFailures = consumeFailures;
    const app = await openApp(services);

    const response = await app.inject({
      method: 'GET',
      url: '/api/runs',
      headers: HEADERS,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      runs: [],
      failures: [{ runId: RUN_ID, error: 'Bedrock rejected this generation', discarded: true }],
    });
    expect(consumeFailures).toHaveBeenCalledWith(undefined);
  });
});
