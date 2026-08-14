import {
  createRunRequestSchema,
  queuedRunResponseSchema,
  runParamsSchema,
  runsResponseSchema,
} from '@harness/contracts';
import type { FastifyInstance } from 'fastify';
import { ApiError, requireService } from '../app/api-error.js';
import { parseDestinationQuery } from './destination-query.js';
import { runSnapshotDto } from './run-dto.js';
import type { RunService } from './run-types.js';

export function registerRunRoutes(app: FastifyInstance, runService: RunService | null): void {
  const service = () => requireService(runService, 'Generation is not available.');

  app.post('/api/runs', async (request, reply) => {
    const submission = createRunRequestSchema.parse(request.body);
    const result = await service().submit(submission);
    return reply.code(202).send(queuedRunResponseSchema.parse({ ...result, status: 'queued' }));
  });
  app.get('/api/runs', async (request) => {
    const destination = parseDestinationQuery(request.query);
    return runsResponseSchema.parse({
      runs: (await service().listRuns(destination)).map(runSnapshotDto),
      failures: service().consumeFailures(destination),
    });
  });
  app.get('/api/runs/:runId', async (request) => {
    const { runId } = runParamsSchema.parse(request.params);
    const snapshot = await service().getSnapshot(runId);
    if (!snapshot) throw new ApiError(404, 'Run not found.');
    return runSnapshotDto(snapshot);
  });
  app.post('/api/runs/:runId/cancel', async (request) => {
    const { runId } = runParamsSchema.parse(request.params);
    if (!(await service().getSnapshot(runId))) throw new ApiError(404, 'Run not found.');
    return runSnapshotDto(await service().cancel(runId));
  });
  app.post('/api/runs/:runId/retry', async (request, reply) => {
    const { runId } = runParamsSchema.parse(request.params);
    if (!(await service().getSnapshot(runId))) throw new ApiError(404, 'Run not found.');
    const result = await service().retry(runId);
    return reply.code(202).send(queuedRunResponseSchema.parse({ ...result, status: 'queued' }));
  });
}
