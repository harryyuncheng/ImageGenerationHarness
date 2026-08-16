import { queuedRunResponseSchema, runSnapshotSchema, runsResponseSchema } from '@harness/contracts';
import type { RunsResponse } from '@harness/contracts';
import { requestJson } from '../../shared/api/http.js';

export function getRuns(): Promise<RunsResponse> {
  return requestJson('/api/runs', runsResponseSchema, {}, 'Gallery history unavailable');
}

export function cancelRun(runId: string) {
  return requestJson(
    `/api/runs/${runId}/cancel`,
    runSnapshotSchema,
    { method: 'POST' },
    'Could not cancel the run.',
  );
}

export function retryRun(runId: string) {
  return requestJson(
    `/api/runs/${runId}/retry`,
    queuedRunResponseSchema,
    { method: 'POST' },
    'Could not retry the run.',
  );
}
