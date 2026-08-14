import {
  createReferenceImageRequestSchema,
  folderParamsSchema,
  referenceFolderNameRequestSchema,
  referenceImageNameRequestSchema,
  referenceImageParamsSchema,
  referenceLibraryResponseSchema,
} from '@harness/contracts';
import type { FastifyInstance } from 'fastify';
import { ApiError, requireService } from '../app/api-error.js';
import { sendImmutableImage } from '../app/image-response.js';
import { referenceFolderDto, referenceImageDto } from './reference-dto.js';
import type { ReferenceLibraryService } from './reference-library-service.js';

export function registerReferenceRoutes(
  app: FastifyInstance,
  referenceLibraryService: ReferenceLibraryService | null,
): void {
  const service = () =>
    requireService(referenceLibraryService, 'Reference library is not available.');

  app.get('/api/reference-library', async () => {
    const folders = await service().list();
    return referenceLibraryResponseSchema.parse({
      folders: folders.map(({ folder, images }) => referenceFolderDto(folder, images)),
    });
  });
  app.post('/api/reference-folders', async (request, reply) => {
    const { name } = referenceFolderNameRequestSchema.parse(request.body);
    return reply.code(201).send(referenceFolderDto(await service().createFolder(name)));
  });
  app.patch('/api/reference-folders/:folderId', async (request, reply) => {
    const { folderId } = folderParamsSchema.parse(request.params);
    const { name } = referenceFolderNameRequestSchema.parse(request.body);
    await service().renameFolder(folderId, name);
    return reply.code(204).send();
  });
  app.delete('/api/reference-folders/:folderId', async (request, reply) => {
    const { folderId } = folderParamsSchema.parse(request.params);
    await service().deleteFolder(folderId);
    return reply.code(204).send();
  });
  app.post('/api/reference-folders/:folderId/images', async (request, reply) => {
    const { folderId } = folderParamsSchema.parse(request.params);
    const body = createReferenceImageRequestSchema.parse(request.body);
    return reply.code(201).send(referenceImageDto(await service().createImage(folderId, body)));
  });
  app.patch('/api/reference-folders/:folderId/images/:imageId', async (request, reply) => {
    const { folderId, imageId } = referenceImageParamsSchema.parse(request.params);
    const { name } = referenceImageNameRequestSchema.parse(request.body);
    await service().renameImage(folderId, imageId, name);
    return reply.code(204).send();
  });
  app.delete('/api/reference-folders/:folderId/images/:imageId', async (request, reply) => {
    const { folderId, imageId } = referenceImageParamsSchema.parse(request.params);
    await service().deleteImage(folderId, imageId);
    return reply.code(204).send();
  });
  app.get('/api/reference-folders/:folderId/images/:imageId/content', async (request, reply) => {
    const { folderId, imageId } = referenceImageParamsSchema.parse(request.params);
    const image = await service().getImage(folderId, imageId);
    if (!image) throw new ApiError(404, 'Reference image not found.');
    return sendImmutableImage(reply, image.mediaType, await service().readImage(image));
  });
}
