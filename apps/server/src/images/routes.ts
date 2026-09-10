import { galleryResponseSchema, imageParamsSchema } from '@harness/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApiError, requireService } from '../app/api-error.js';
import { sendImmutableImage } from '../app/image-response.js';
import type { GeneratedImageRecord, RunService } from '../runs/run-types.js';

async function sendGeneratedImage(
  reply: FastifyReply,
  service: RunService,
  image: GeneratedImageRecord,
) {
  return sendImmutableImage(reply, image.mediaType, await service.readImage(image));
}

export function registerImageRoutes(app: FastifyInstance, runService: RunService | null): void {
  const service = () => requireService(runService, 'Generation is not available.');

  app.get('/api/images', async (request) => {
    z.object({}).strict().parse(request.query);
    const images = await service().listImages();
    return galleryResponseSchema.parse({ images });
  });
  app.get('/api/images/:imageId/content', async (request, reply) => {
    const { imageId } = imageParamsSchema.parse(request.params);
    const image = await service().getImage(imageId);
    if (!image) throw new ApiError(404, 'Image not found.');
    return sendGeneratedImage(reply, service(), image);
  });
}
