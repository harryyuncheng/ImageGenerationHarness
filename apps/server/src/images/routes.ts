import {
  galleryResponseSchema,
  generatedImageSidecarSchema,
  imageParamsSchema,
} from '@harness/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { ApiError, requireService } from '../app/api-error.js';
import { sendImmutableImage } from '../app/image-response.js';
import { parseDestinationQuery } from '../runs/destination-query.js';
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
    const destination = parseDestinationQuery(request.query);
    const images = await service().listImages(destination);
    return galleryResponseSchema.parse({
      images: images.map((image) => ({
        imageId: image.imageId,
        runId: image.runId,
        mediaType: image.mediaType,
        byteLength: image.byteLength,
        createdAt: image.createdAt,
        ...(image.prompt === undefined ? {} : { prompt: image.prompt }),
        targetId: image.targetId,
        ...(image.projectId === undefined ? {} : { projectId: image.projectId }),
        ...(image.projectAssetId === undefined ? {} : { projectAssetId: image.projectAssetId }),
      })),
    });
  });
  app.get('/api/images/:imageId/content', async (request, reply) => {
    const { imageId } = imageParamsSchema.parse(request.params);
    const image = await service().getImage(imageId);
    if (!image) throw new ApiError(404, 'Image not found.');
    return sendGeneratedImage(reply, service(), image);
  });
  app.get('/api/images/:imageId/metadata', async (request) => {
    const { imageId } = imageParamsSchema.parse(request.params);
    const metadata = await service().getImageMetadata(imageId);
    if (!metadata) throw new ApiError(404, 'Image metadata not found.');
    const parsed = generatedImageSidecarSchema.safeParse(metadata);
    if (!parsed.success) throw new Error('Generated image metadata is invalid.');
    return parsed.data;
  });
}
