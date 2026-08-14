import helmet from '@fastify/helmet';
import { CAPABILITY_REGISTRY_VERSION, capabilityCatalog } from '@harness/capabilities/catalog';
import {
  capabilitiesResponseSchema,
  createReferenceImageRequestSchema,
  createRunRequestSchema,
  destinationQuerySchema,
  folderParamsSchema,
  galleryResponseSchema,
  generatedImageSidecarSchema,
  imageParamsSchema,
  includeArchivedQuerySchema,
  jobDtoSchema,
  projectAssetDtoSchema,
  projectAssetsResponseSchema,
  projectAssetParamsSchema,
  projectCreateRequestSchema,
  projectDetailResponseSchema,
  projectDtoSchema,
  projectParamsSchema,
  projectUpdateRequestSchema,
  projectsResponseSchema,
  queuedRunResponseSchema,
  referenceFolderDtoSchema,
  referenceFolderNameRequestSchema,
  referenceImageDtoSchema,
  referenceImageNameRequestSchema,
  referenceImageParamsSchema,
  referenceLibraryResponseSchema,
  repositoryParamsSchema,
  repositoryStatusSchema,
  runDtoSchema,
  runParamsSchema,
  runSnapshotSchema,
  runsResponseSchema,
  type MediaType,
} from '@harness/contracts';
import {
  type LocalJob,
  type LocalRun,
  type Project,
  type ProjectAsset,
  type ReferenceFolder,
  type ReferenceImage,
  type RepositoryStatus,
} from '@harness/domain';
import fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  getDefaultLocalRepositoryManager,
  type LocalRepositoryManager,
  RepositoryUnavailableError,
} from './local-repository.js';
import {
  LocalProjectService,
  ProjectServiceError,
  type ProjectService,
} from './project-service.js';
import {
  LocalReferenceLibraryService,
  ReferenceLibraryError,
  type ReferenceLibraryService,
} from './reference-library-service.js';
import type { GeneratedImageRecord, RunService, RunSnapshot } from './run-service.js';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export interface RepositoryManagerLike {
  initialize(): Promise<RepositoryStatus>;
  getStatus(): RepositoryStatus;
  choose(): Promise<RepositoryStatus>;
  activateRepository(repositoryId: string): Promise<RepositoryStatus>;
}

export interface AppOptions {
  repositoryManager?: RepositoryManagerLike;
  projectService?: ProjectService | null;
  referenceLibraryService?: ReferenceLibraryService | null;
  runService?: RunService | null;
}

class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function trustedHost(header: string | undefined): boolean {
  if (!header) return false;
  try {
    const parsed = new URL(`http://${header}`);
    return (
      LOOPBACK_HOSTS.has(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === '/' &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

function trustedOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      LOOPBACK_HOSTS.has(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === '/' &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

function repositoryStatusDto(status: RepositoryStatus) {
  return repositoryStatusSchema.parse({
    active: status.active
      ? { repositoryId: status.active.repositoryId, name: status.active.name }
      : null,
    recent: status.recent.map((repository) => ({
      repositoryId: repository.repositoryId,
      name: repository.name,
    })),
  });
}

function organizationalDto(record: Project | ProjectAsset) {
  return {
    name: record.name,
    description: record.description,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.archivedAt === undefined ? {} : { archivedAt: record.archivedAt }),
  };
}

function projectDto(project: Project) {
  return projectDtoSchema.parse({
    projectId: project.projectId,
    ...organizationalDto(project),
  });
}

function projectAssetDto(asset: ProjectAsset) {
  return projectAssetDtoSchema.parse({
    assetId: asset.assetId,
    projectId: asset.projectId,
    ...organizationalDto(asset),
  });
}

function referenceFolderDto(folder: ReferenceFolder, images: ReferenceImage[] = []) {
  return referenceFolderDtoSchema.parse({
    folderId: folder.folderId,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    images: images.map(referenceImageDto),
  });
}

function referenceImageDto(image: ReferenceImage) {
  return referenceImageDtoSchema.parse({
    folderId: image.folderId,
    imageId: image.imageId,
    name: image.name,
    mediaType: image.mediaType,
    byteLength: image.byteLength,
    width: image.width,
    height: image.height,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
  });
}

function localRunDto(run: LocalRun) {
  return runDtoSchema.parse({
    schemaVersion: run.schemaVersion,
    runId: run.runId,
    status: run.status,
    registryVersion: run.registryVersion,
    targetId: run.targetId,
    destination: run.destination,
    requestedJobCount: run.requestedJobCount,
    seedPlan: run.seedPlan,
    ...(run.prompt === undefined ? {} : { prompt: run.prompt }),
    jobIds: run.jobIds,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  });
}

function localJobDto(job: LocalJob) {
  return jobDtoSchema.parse({
    schemaVersion: job.schemaVersion,
    runId: job.runId,
    jobId: job.jobId,
    status: job.status,
    targetId: job.targetId,
    destination: job.destination,
    plannedSeed: job.plannedSeed,
    providerSeed: job.providerSeed,
    outputImageIds: job.outputImageIds,
    attempts: job.attempts.map((attempt) => ({
      attemptId: attempt.attemptId,
      ordinal: attempt.ordinal,
      status: attempt.status,
      startedAt: attempt.startedAt,
      ...(attempt.finishedAt === undefined ? {} : { finishedAt: attempt.finishedAt }),
      ...(attempt.providerRequestId === undefined
        ? {}
        : { providerRequestId: attempt.providerRequestId }),
      ...(attempt.errorCode === undefined ? {} : { errorCode: attempt.errorCode }),
      ...(attempt.errorMessage === undefined ? {} : { errorMessage: attempt.errorMessage }),
    })),
    ...(job.errorCode === undefined ? {} : { errorCode: job.errorCode }),
    ...(job.errorMessage === undefined ? {} : { errorMessage: job.errorMessage }),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}

function runSnapshotDto(snapshot: RunSnapshot) {
  return runSnapshotSchema.parse({
    run: localRunDto(snapshot.run),
    jobs: snapshot.jobs.map(localJobDto),
  });
}

function parseDestinationQuery(query: unknown) {
  const parsed = destinationQuerySchema.parse(query);
  if (!('destination' in parsed)) return undefined;
  if (parsed.destination === 'main') return { kind: 'main' as const };
  if (parsed.destination === 'project') {
    return { kind: 'project' as const, projectId: parsed.projectId };
  }
  return {
    kind: 'project-asset' as const,
    projectId: parsed.projectId,
    projectAssetId: parsed.projectAssetId,
  };
}

function requireService<T>(service: T | null, message: string): T {
  if (!service) throw new ApiError(503, message);
  return service;
}

function sendImmutableImage(reply: FastifyReply, mediaType: MediaType, bytes: Uint8Array) {
  return reply
    .header('content-type', mediaType)
    .header('content-length', String(bytes.byteLength))
    .header('cache-control', 'private, max-age=31536000, immutable')
    .send(Buffer.from(bytes));
}

async function sendGeneratedImage(
  reply: FastifyReply,
  service: RunService,
  image: GeneratedImageRecord,
) {
  return sendImmutableImage(reply, image.mediaType, await service.readImage(image));
}

function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof RepositoryUnavailableError) {
      return reply.code(503).send({ error: error.message });
    }
    if (error instanceof ProjectServiceError || error instanceof ReferenceLibraryError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({
        error: 'Invalid request.',
        issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      });
    }
    request.log.error({ err: error }, 'request failed');
    return reply.code(500).send({ error: 'The request could not be completed.' });
  });
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const repositoryManager = options.repositoryManager ?? getDefaultLocalRepositoryManager();
  const initialRepositoryStatus = await repositoryManager.initialize();
  const localManager = repositoryManager as LocalRepositoryManager;
  const projectService =
    options.projectService === undefined
      ? new LocalProjectService(localManager)
      : options.projectService;
  const referenceLibraryService =
    options.referenceLibraryService === undefined
      ? new LocalReferenceLibraryService(localManager)
      : options.referenceLibraryService;
  const ownsRunService = options.runService === undefined;
  let runService: RunService | null;
  if (options.runService === undefined) {
    const { LocalRunService } = await import('./run-service.js');
    runService = new LocalRunService({
      manager: localManager,
      ...(projectService ? { projectService } : {}),
      ...(referenceLibraryService ? { referenceLibraryService } : {}),
    });
  } else {
    runService = options.runService;
  }

  if (ownsRunService && runService && initialRepositoryStatus.active) {
    await runService.recover();
  }

  const app = fastify({
    logger: { redact: ['req.headers.authorization', 'req.headers.cookie'] },
    bodyLimit: 64 * 1024 * 1024,
  });
  registerErrorHandler(app);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'blob:', 'data:'],
        connectSrc: ["'self'"],
      },
    },
  });

  app.addHook('onRequest', async (request, reply) => {
    if (!trustedHost(request.headers.host)) {
      return reply.code(403).send({ error: 'Untrusted Host header' });
    }
    const origin = request.headers.origin;
    if (origin && !trustedOrigin(origin)) {
      return reply.code(403).send({ error: 'Untrusted Origin header' });
    }
  });

  app.get('/api/health', () => ({ ok: true, registryVersion: CAPABILITY_REGISTRY_VERSION }));
  app.get('/api/capabilities', () =>
    capabilitiesResponseSchema.parse({
      registryVersion: CAPABILITY_REGISTRY_VERSION,
      targets: capabilityCatalog,
    }),
  );

  const recoverSelectedRepository = async (status: RepositoryStatus): Promise<void> => {
    if (ownsRunService && runService && status.active) await runService.recover();
  };
  const chooseRepository = async () => {
    const status = await repositoryManager.choose();
    await recoverSelectedRepository(status);
    return repositoryStatusDto(status);
  };

  app.get('/api/repository', () => repositoryStatusDto(repositoryManager.getStatus()));
  app.post('/api/repository/choose', chooseRepository);
  app.post('/api/repository/activate/:repositoryId', async (request) => {
    const { repositoryId } = repositoryParamsSchema.parse(request.params);
    let status: RepositoryStatus;
    try {
      status = await repositoryManager.activateRepository(repositoryId);
    } catch (error) {
      if (error instanceof RepositoryUnavailableError) {
        throw new ApiError(404, 'Repository not found.');
      }
      throw error;
    }
    await recoverSelectedRepository(status);
    return repositoryStatusDto(status);
  });

  app.get('/api/projects', async (request) => {
    const query = includeArchivedQuerySchema.parse(request.query);
    const projects = await requireService(
      projectService,
      'Projects are not available.',
    ).listProjects({
      includeArchived: query.includeArchived === 'true',
    });
    return projectsResponseSchema.parse({ projects: projects.map(projectDto) });
  });
  app.post('/api/projects', async (request, reply) => {
    const body = projectCreateRequestSchema.parse(request.body);
    const project = await requireService(
      projectService,
      'Projects are not available.',
    ).createProject({
      name: body.name,
      ...(body.description === undefined ? {} : { description: body.description }),
    });
    return reply.code(201).send(projectDto(project));
  });
  app.get('/api/projects/:projectId', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const service = requireService(projectService, 'Projects are not available.');
    const project = await service.getProject(projectId);
    if (!project) throw new ApiError(404, 'Project not found.');
    const assets = await service.listProjectAssets(projectId, { includeArchived: true });
    return projectDetailResponseSchema.parse({
      project: projectDto(project),
      assets: assets.map(projectAssetDto),
    });
  });
  app.patch('/api/projects/:projectId', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const body = projectUpdateRequestSchema.parse(request.body);
    return projectDto(
      await requireService(projectService, 'Projects are not available.').updateProject(projectId, {
        ...(body.name === undefined ? {} : { name: body.name }),
        ...(body.description === undefined ? {} : { description: body.description }),
      }),
    );
  });
  app.delete('/api/projects/:projectId', async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    await requireService(projectService, 'Projects are not available.').deleteProject(projectId);
    return reply.code(204).send();
  });
  app.post('/api/projects/:projectId/archive', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    return projectDto(
      await requireService(projectService, 'Projects are not available.').archiveProject(projectId),
    );
  });
  app.post('/api/projects/:projectId/unarchive', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    return projectDto(
      await requireService(projectService, 'Projects are not available.').unarchiveProject(
        projectId,
      ),
    );
  });

  app.get('/api/projects/:projectId/assets', async (request) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const query = includeArchivedQuerySchema.parse(request.query);
    const assets = await requireService(
      projectService,
      'Projects are not available.',
    ).listProjectAssets(projectId, { includeArchived: query.includeArchived === 'true' });
    return projectAssetsResponseSchema.parse({ assets: assets.map(projectAssetDto) });
  });
  app.post('/api/projects/:projectId/assets', async (request, reply) => {
    const { projectId } = projectParamsSchema.parse(request.params);
    const body = projectCreateRequestSchema.parse(request.body);
    const asset = await requireService(
      projectService,
      'Projects are not available.',
    ).createProjectAsset(projectId, {
      name: body.name,
      ...(body.description === undefined ? {} : { description: body.description }),
    });
    return reply.code(201).send(projectAssetDto(asset));
  });
  app.get('/api/projects/:projectId/assets/:assetId', async (request) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    const asset = await requireService(
      projectService,
      'Projects are not available.',
    ).getProjectAsset(projectId, assetId);
    if (!asset) throw new ApiError(404, 'Project asset not found.');
    return projectAssetDto(asset);
  });
  app.patch('/api/projects/:projectId/assets/:assetId', async (request) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    const body = projectUpdateRequestSchema.parse(request.body);
    const asset = await requireService(
      projectService,
      'Projects are not available.',
    ).updateProjectAsset(projectId, assetId, {
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.description === undefined ? {} : { description: body.description }),
    });
    return projectAssetDto(asset);
  });
  app.delete('/api/projects/:projectId/assets/:assetId', async (request, reply) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    await requireService(projectService, 'Projects are not available.').deleteProjectAsset(
      projectId,
      assetId,
    );
    return reply.code(204).send();
  });
  app.post('/api/projects/:projectId/assets/:assetId/archive', async (request) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    return projectAssetDto(
      await requireService(projectService, 'Projects are not available.').archiveProjectAsset(
        projectId,
        assetId,
      ),
    );
  });
  app.post('/api/projects/:projectId/assets/:assetId/unarchive', async (request) => {
    const { projectId, assetId } = projectAssetParamsSchema.parse(request.params);
    return projectAssetDto(
      await requireService(projectService, 'Projects are not available.').unarchiveProjectAsset(
        projectId,
        assetId,
      ),
    );
  });

  app.get('/api/reference-library', async () => {
    const folders = await requireService(
      referenceLibraryService,
      'Reference library is not available.',
    ).list();
    return referenceLibraryResponseSchema.parse({
      folders: folders.map(({ folder, images }) => referenceFolderDto(folder, images)),
    });
  });
  app.post('/api/reference-folders', async (request, reply) => {
    const { name } = referenceFolderNameRequestSchema.parse(request.body);
    const folder = await requireService(
      referenceLibraryService,
      'Reference library is not available.',
    ).createFolder(name);
    return reply.code(201).send(referenceFolderDto(folder));
  });
  app.patch('/api/reference-folders/:folderId', async (request, reply) => {
    const { folderId } = folderParamsSchema.parse(request.params);
    const { name } = referenceFolderNameRequestSchema.parse(request.body);
    await requireService(
      referenceLibraryService,
      'Reference library is not available.',
    ).renameFolder(folderId, name);
    return reply.code(204).send();
  });
  app.delete('/api/reference-folders/:folderId', async (request, reply) => {
    const { folderId } = folderParamsSchema.parse(request.params);
    await requireService(
      referenceLibraryService,
      'Reference library is not available.',
    ).deleteFolder(folderId);
    return reply.code(204).send();
  });
  app.post('/api/reference-folders/:folderId/images', async (request, reply) => {
    const { folderId } = folderParamsSchema.parse(request.params);
    const body = createReferenceImageRequestSchema.parse(request.body);
    const image = await requireService(
      referenceLibraryService,
      'Reference library is not available.',
    ).createImage(folderId, body);
    return reply.code(201).send(referenceImageDto(image));
  });
  app.patch('/api/reference-folders/:folderId/images/:imageId', async (request, reply) => {
    const { folderId, imageId } = referenceImageParamsSchema.parse(request.params);
    const { name } = referenceImageNameRequestSchema.parse(request.body);
    await requireService(
      referenceLibraryService,
      'Reference library is not available.',
    ).renameImage(folderId, imageId, name);
    return reply.code(204).send();
  });
  app.delete('/api/reference-folders/:folderId/images/:imageId', async (request, reply) => {
    const { folderId, imageId } = referenceImageParamsSchema.parse(request.params);
    await requireService(
      referenceLibraryService,
      'Reference library is not available.',
    ).deleteImage(folderId, imageId);
    return reply.code(204).send();
  });
  app.get('/api/reference-folders/:folderId/images/:imageId/content', async (request, reply) => {
    const { folderId, imageId } = referenceImageParamsSchema.parse(request.params);
    const service = requireService(referenceLibraryService, 'Reference library is not available.');
    const image = await service.getImage(folderId, imageId);
    if (!image) throw new ApiError(404, 'Reference image not found.');
    const bytes = await service.readImage(image);
    return sendImmutableImage(reply, image.mediaType, bytes);
  });

  app.post('/api/runs', async (request, reply) => {
    const submission = createRunRequestSchema.parse(request.body);
    const result = await requireService(runService, 'Generation is not available.').submit(
      submission,
    );
    return reply.code(202).send(queuedRunResponseSchema.parse({ ...result, status: 'queued' }));
  });
  app.get('/api/runs', async (request) => {
    const destination = parseDestinationQuery(request.query);
    const service = requireService(runService, 'Generation is not available.');
    const snapshots = await service.listRuns(destination);
    return runsResponseSchema.parse({
      runs: snapshots.map(runSnapshotDto),
      failures: service.consumeFailures(destination),
    });
  });
  app.get('/api/runs/:runId', async (request) => {
    const { runId } = runParamsSchema.parse(request.params);
    const snapshot = await requireService(runService, 'Generation is not available.').getSnapshot(
      runId,
    );
    if (!snapshot) throw new ApiError(404, 'Run not found.');
    return runSnapshotDto(snapshot);
  });
  app.post('/api/runs/:runId/cancel', async (request) => {
    const { runId } = runParamsSchema.parse(request.params);
    const service = requireService(runService, 'Generation is not available.');
    if (!(await service.getSnapshot(runId))) throw new ApiError(404, 'Run not found.');
    return runSnapshotDto(await service.cancel(runId));
  });
  app.post('/api/runs/:runId/retry', async (request, reply) => {
    const { runId } = runParamsSchema.parse(request.params);
    const service = requireService(runService, 'Generation is not available.');
    if (!(await service.getSnapshot(runId))) throw new ApiError(404, 'Run not found.');
    const result = await service.retry(runId);
    return reply.code(202).send(queuedRunResponseSchema.parse({ ...result, status: 'queued' }));
  });

  app.get('/api/images', async (request) => {
    const destination = parseDestinationQuery(request.query);
    const images = await requireService(runService, 'Generation is not available.').listImages(
      destination,
    );
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
    const service = requireService(runService, 'Generation is not available.');
    const image = await service.getImage(imageId);
    if (!image) throw new ApiError(404, 'Image not found.');
    return sendGeneratedImage(reply, service, image);
  });
  app.get('/api/images/:imageId/metadata', async (request) => {
    const { imageId } = imageParamsSchema.parse(request.params);
    const metadata = await requireService(
      runService,
      'Generation is not available.',
    ).getImageMetadata(imageId);
    if (!metadata) throw new ApiError(404, 'Image metadata not found.');
    const parsed = generatedImageSidecarSchema.safeParse(metadata);
    if (!parsed.success) throw new Error('Generated image metadata is invalid.');
    return parsed.data;
  });
  return app;
}
