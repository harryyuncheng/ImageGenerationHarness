import {
  MAX_GPT_IMAGE_INPUTS,
  MAX_IMAGE_BYTES,
  createRunRequestSchema,
  generationInputIndexSchema,
  generationSetupSchema,
  queuedRunResponseSchema,
  runParamsSchema,
  runsResponseSchema,
} from '@harness/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiError, requireService } from '../app/api-error.js';
import { sendImmutableImage } from '../app/image-response.js';
import { runSnapshotDto } from './run-dto.js';
import type { RunService } from './run-types.js';

export function registerRunRoutes(app: FastifyInstance, runService: RunService | null): void {
  const service = () => requireService(runService, 'Generation is not available.');

  app.post(
    '/api/runs',
    {
      // Sixteen base64 images, a mask, and escaped prompt/settings JSON.
      bodyLimit: Math.ceil(MAX_IMAGE_BYTES / 3) * 4 * (MAX_GPT_IMAGE_INPUTS + 1) + 512 * 1024,
    },
    async (request, reply) => {
      const submission = createRunRequestSchema.parse(request.body);
      const result = await service().submit(submission);
      return reply.code(202).send(queuedRunResponseSchema.parse(result));
    },
  );
  app.get('/api/runs', async (request) => {
    z.object({}).strict().parse(request.query);
    const { runs, failures } = await service().listRuns();
    return runsResponseSchema.parse({
      runs: runs.map(runSnapshotDto),
      failures,
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
    return runSnapshotDto(await service().cancel(runId));
  });
  app.get('/api/runs/:runId/setup', async (request) => {
    const { runId } = runParamsSchema.parse(request.params);
    return generationSetupSchema.parse(
      await service().getGenerationSetup({ kind: 'runs', id: runId }),
    );
  });
  app.get('/api/runs/:runId/inputs/:inputIndex/content', async (request, reply) => {
    const { runId, inputIndex } = runParamsSchema
      .extend({ inputIndex: generationInputIndexSchema })
      .strict()
      .parse(request.params);
    const input = await service().readGenerationInput({ kind: 'runs', id: runId, inputIndex });
    return sendImmutableImage(reply, input.mediaType, input.bytes);
  });
}
