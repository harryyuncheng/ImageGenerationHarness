import {
  includeArchivedQuerySchema,
  projectAssetParamsSchema,
  projectAssetsResponseSchema,
  projectCreateRequestSchema,
  projectDetailResponseSchema,
  projectParamsSchema,
  projectUpdateRequestSchema,
  projectsResponseSchema,
} from '@harness/contracts';
import type { FastifyInstance } from 'fastify';
import { ApiError, requireService } from '../app/api-error.js';
import { projectAssetDto, projectDto } from './project-dto.js';
import type { ProjectService } from './project-service.js';

export function registerProjectRoutes(
  app: FastifyInstance,
  projectService: ProjectService | null,
): void {
  const service = () => requireService(projectService, 'Projects are not available.');

  app.get('/api/projects', async (request) => {
    const query = includeArchivedQuerySchema.parse(request.query);
    const projects = await service().listProjects({
      includeArchived: query.includeArchived === 'true',
    });
    return projectsResponseSchema.parse({ projects: projects.map(projectDto) });
  });
  app.post('/api/projects', async (request, reply) => {
    const body = projectCreateRequestSchema.parse(request.body);
    const project = await service().createProject({
      name: body.name,
      ...(body.description === undefined ? {} : { description: body.description }),
    });
    return reply.code(201).send(projectDto(project));
  });
  app.get('/api/projects/:projectId', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const project = await service().getProject(projectId);
    if (!project) throw new ApiError(404, 'Project not found.');
    const assets = await service().listProjectAssets(projectId, { includeArchived: true });
    return projectDetailResponseSchema.parse({
      project: projectDto(project),
      assets: assets.map(projectAssetDto),
    });
  });
  app.patch('/api/projects/:projectId', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const body = projectUpdateRequestSchema.parse(request.body);
    return projectDto(
      await service().updateProject(projectId, {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.description === undefined ? {} : { description: body.description }),
      }),
    );
  });
  app.delete('/api/projects/:projectId', async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    await service().deleteProject(projectId);
    return reply.code(204).send();
  });
  app.post('/api/projects/:projectId/archive', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    return projectDto(await service().archiveProject(projectId));
  });
  app.post('/api/projects/:projectId/unarchive', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    return projectDto(await service().unarchiveProject(projectId));
  });

  app.get('/api/projects/:projectId/assets', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const query = includeArchivedQuerySchema.parse(request.query);
    const assets = await service().listProjectAssets(projectId, {
      includeArchived: query.includeArchived === 'true',
    });
    return projectAssetsResponseSchema.parse({ assets: assets.map(projectAssetDto) });
  });
  app.post('/api/projects/:projectId/assets', async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const body = projectCreateRequestSchema.parse(request.body);
    const asset = await service().createProjectAsset(projectId, {
      name: body.name,
      ...(body.description === undefined ? {} : { description: body.description }),
    });
    return reply.code(201).send(projectAssetDto(asset));
  });
  app.get('/api/projects/:projectId/assets/:assetId', async (request) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    const asset = await service().getProjectAsset(projectId, assetId);
    if (!asset) throw new ApiError(404, 'Project asset not found.');
    return projectAssetDto(asset);
  });
  app.patch('/api/projects/:projectId/assets/:assetId', async (request) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    const body = projectUpdateRequestSchema.parse(request.body);
    const asset = await service().updateProjectAsset(projectId, assetId, {
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.description === undefined ? {} : { description: body.description }),
    });
    return projectAssetDto(asset);
  });
  app.delete('/api/projects/:projectId/assets/:assetId', async (request, reply) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    await service().deleteProjectAsset(projectId, assetId);
    return reply.code(204).send();
  });
  app.post('/api/projects/:projectId/assets/:assetId/archive', async (request) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    return projectAssetDto(await service().archiveProjectAsset(projectId, assetId));
  });
  app.post('/api/projects/:projectId/assets/:assetId/unarchive', async (request) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    return projectAssetDto(await service().unarchiveProjectAsset(projectId, assetId));
  });
}
