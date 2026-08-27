import {
  createStyleGuideImageRequestSchema,
  folderParamsSchema,
  styleGuideFolderNameRequestSchema,
  styleGuideImageNameRequestSchema,
  styleGuideImageParamsSchema,
  styleGuideResponseSchema,
} from '@harness/contracts';
import type { FastifyInstance } from 'fastify';
import { ApiError, requireService } from '../app/api-error.js';
import { sendImmutableImage } from '../app/image-response.js';
import { styleGuideFolderDto, styleGuideImageDto } from './style-guide-dto.js';
import type { StyleGuideService } from './style-guide-service.js';

export function registerStyleGuideRoutes(
  app: FastifyInstance,
  styleGuideService: StyleGuideService | null,
): void {
  const service = () => requireService(styleGuideService, 'Style guide is not available.');

  app.get('/api/style-guide', async () => {
    const folders = await service().list();
    return styleGuideResponseSchema.parse({
      folders: folders.map(({ folder, images }) => styleGuideFolderDto(folder, images)),
    });
  });
  app.post('/api/style-guide/folders', async (request, reply) => {
    const { name } = styleGuideFolderNameRequestSchema.parse(request.body);
    return reply.code(201).send(styleGuideFolderDto(await service().createFolder(name)));
  });
  app.patch('/api/style-guide/folders/:folderId', async (request, reply) => {
    const { folderId } = folderParamsSchema.parse(request.params);
    const { name } = styleGuideFolderNameRequestSchema.parse(request.body);
    await service().renameFolder(folderId, name);
    return reply.code(204).send();
  });
  app.delete('/api/style-guide/folders/:folderId', async (request, reply) => {
    const { folderId } = folderParamsSchema.parse(request.params);
    await service().deleteFolder(folderId);
    return reply.code(204).send();
  });
  app.post('/api/style-guide/folders/:folderId/images', async (request, reply) => {
    const { folderId } = folderParamsSchema.parse(request.params);
    const body = createStyleGuideImageRequestSchema.parse(request.body);
    return reply.code(201).send(styleGuideImageDto(await service().createImage(folderId, body)));
  });
  app.patch('/api/style-guide/folders/:folderId/images/:imageId', async (request, reply) => {
    const { folderId, imageId } = styleGuideImageParamsSchema.parse(request.params);
    const { name } = styleGuideImageNameRequestSchema.parse(request.body);
    await service().renameImage(folderId, imageId, name);
    return reply.code(204).send();
  });
  app.delete('/api/style-guide/folders/:folderId/images/:imageId', async (request, reply) => {
    const { folderId, imageId } = styleGuideImageParamsSchema.parse(request.params);
    await service().deleteImage(folderId, imageId);
    return reply.code(204).send();
  });
  app.get('/api/style-guide/folders/:folderId/images/:imageId/content', async (request, reply) => {
    const { folderId, imageId } = styleGuideImageParamsSchema.parse(request.params);
    const image = await service().getImage(folderId, imageId);
    if (!image) throw new ApiError(404, 'Style guide image not found.');
    return sendImmutableImage(reply, image.mediaType, await service().readImage(image));
  });
}
