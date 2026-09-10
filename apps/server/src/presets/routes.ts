import {
  createPresetRequestSchema,
  presetsResponseSchema,
  updatePresetRequestSchema,
  uuidSchema,
} from '@harness/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireService } from '../app/api-error.js';
import { sendImmutableImage } from '../app/image-response.js';
import { presetDto } from './preset-dto.js';
import type { PresetService } from './preset-service.js';

const presetParamsSchema = z.object({ presetId: uuidSchema }).strict();
const coverQuerySchema = z.object({ imageId: uuidSchema.optional() }).strict();

export function registerPresetRoutes(
  app: FastifyInstance,
  presetService: PresetService | null,
): void {
  const service = () => requireService(presetService, 'Presets are not available.');

  app.get('/api/presets', async () => {
    const presets = await service().list();
    return presetsResponseSchema.parse({
      presets: presets.map(({ preset, cover }) => presetDto(preset, cover)),
    });
  });
  app.post('/api/presets', async (request, reply) => {
    const input = createPresetRequestSchema.parse(request.body);
    const { preset, cover } = await service().create(input);
    return reply.code(201).send(presetDto(preset, cover));
  });
  app.patch('/api/presets/:presetId', async (request) => {
    const { presetId } = presetParamsSchema.parse(request.params);
    const input = updatePresetRequestSchema.parse(request.body);
    const { preset, cover } = await service().update(presetId, input);
    return presetDto(preset, cover);
  });
  app.delete('/api/presets/:presetId', async (request, reply) => {
    const { presetId } = presetParamsSchema.parse(request.params);
    await service().delete(presetId);
    return reply.code(204).send();
  });
  app.get('/api/presets/:presetId/cover', async (request, reply) => {
    const { presetId } = presetParamsSchema.parse(request.params);
    const { imageId } = coverQuerySchema.parse(request.query);
    const { cover, bytes } = await service().readCover(presetId, imageId);
    return sendImmutableImage(reply, cover.mediaType, bytes);
  });
}
