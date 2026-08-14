/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import type { FastifyInstance } from 'fastify';
import {
  type GeneratedImageSidecar,
  type LocalJob,
  type LocalRun,
  type Project,
  type ProjectAsset,
  type ReferenceFolder,
  type ReferenceImage,
  type RepositoryStatus,
} from '@harness/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp, type AppOptions, type RepositoryManagerLike } from './app.js';
import { RepositoryUnavailableError } from './local-repository.js';
import { ProjectServiceError, type ProjectService } from './project-service.js';
import type { ReferenceLibraryService } from './reference-library-service.js';

type RunService = NonNullable<AppOptions['runService']>;
type RunSnapshot = NonNullable<Awaited<ReturnType<RunService['getSnapshot']>>>;

const HEADERS = { host: '127.0.0.1:4173' };
const NOW = '2026-08-07T12:00:00.000Z';
const REPOSITORY_ID = '99999999-9999-4999-8999-999999999999';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '22222222-2222-4222-8222-222222222222';
const RUN_ID = '33333333-3333-4333-8333-333333333333';
const RETRY_RUN_ID = '33333333-3333-4333-8333-333333333334';
const JOB_ID = '44444444-4444-4444-8444-444444444444';
const IMAGE_ID = '55555555-5555-4555-8555-555555555555';
const FOLDER_ID = '66666666-6666-4666-8666-666666666666';
const REFERENCE_IMAGE_ID = '77777777-7777-4777-8777-777777777777';
const ATTEMPT_ID = '88888888-8888-4888-8888-888888888888';

const project: Project = {
  schemaVersion: 1,
  projectId: PROJECT_ID,
  name: 'Autumn campaign',
  description: 'Organizational notes only',
  directory: `projects/private--${PROJECT_ID}`,
  createdAt: NOW,
  updatedAt: NOW,
};
const projectAsset: ProjectAsset = {
  schemaVersion: 1,
  assetId: ASSET_ID,
  projectId: PROJECT_ID,
  name: 'Hero product',
  description: 'Nested notes',
  directory: `${project.directory}/assets/private--${ASSET_ID}`,
  createdAt: NOW,
  updatedAt: NOW,
};
const referenceFolder: ReferenceFolder = {
  schemaVersion: 1,
  folderId: FOLDER_ID,
  name: 'Lighting',
  directory: `references/private--${FOLDER_ID}`,
  createdAt: NOW,
  updatedAt: NOW,
};
const referenceImage: ReferenceImage = {
  schemaVersion: 1,
  folderId: FOLDER_ID,
  imageId: REFERENCE_IMAGE_ID,
  name: 'softbox.jpg',
  repositoryRelativePath: `${referenceFolder.directory}/private--${REFERENCE_IMAGE_ID}.jpg`,
  sha256: 'a'.repeat(64),
  mediaType: 'image/jpeg',
  byteLength: 3,
  width: 10,
  height: 10,
  createdAt: NOW,
  updatedAt: NOW,
};
const run: LocalRun = {
  schemaVersion: 1,
  runId: RUN_ID,
  status: 'completed',
  registryVersion: 'test-registry',
  targetId: 'generation/core',
  destination: {
    kind: 'project-asset',
    projectId: PROJECT_ID,
    projectAssetId: ASSET_ID,
  },
  requestedJobCount: 1,
  seedPlan: { strategy: 'harness-random' },
  prompt: 'A small blue house',
  jobIds: [JOB_ID],
  createdAt: NOW,
  updatedAt: NOW,
};
const job: LocalJob = {
  schemaVersion: 1,
  runId: RUN_ID,
  jobId: JOB_ID,
  status: 'completed',
  targetId: 'generation/core',
  destination: run.destination,
  request: {
    prompt: 'must remain server-side',
    image: '/Users/private/untrusted-input.png',
  },
  inputs: [
    {
      field: 'image',
      role: 'image',
      imageId: REFERENCE_IMAGE_ID,
      repositoryRelativePath: referenceImage.repositoryRelativePath,
      sha256: referenceImage.sha256,
      mediaType: referenceImage.mediaType,
    },
  ],
  plannedSeed: 42,
  providerSeed: 42,
  outputImageIds: [IMAGE_ID],
  attempts: [
    {
      attemptId: ATTEMPT_ID,
      ordinal: 1,
      status: 'succeeded',
      startedAt: NOW,
      finishedAt: NOW,
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};
const snapshot: RunSnapshot = { run, jobs: [job] };
const imageMetadata: GeneratedImageSidecar = {
  schemaVersion: 1,
  imageId: IMAGE_ID,
  repositoryRelativePath: `projects/private--${PROJECT_ID}/images/output.png`,
  projectId: PROJECT_ID,
  createdAt: NOW,
  runId: RUN_ID,
  jobId: JOB_ID,
  attemptId: ATTEMPT_ID,
  capabilityRegistryVersion: 'test-registry',
  canonicalTargetId: 'generation/core',
  invocationId: 'stability.test',
  prompt: 'A small blue house',
  normalizedRequest: { prompt: 'A small blue house' },
  seed: { strategy: 'harness-random', planned: 42, provider: 42 },
  output: {
    format: 'png',
    mediaType: 'image/png',
    width: 10,
    height: 10,
    byteLength: 3,
    sha256: 'b'.repeat(64),
  },
  inputs: [],
  provider: { finishReason: null, metadata: {} },
};

interface InjectedServices {
  repositoryManager: RepositoryManagerLike;
  projectService: ProjectService;
  referenceLibraryService: ReferenceLibraryService;
  runService: RunService;
}

function createInjectedServices(): InjectedServices {
  const emptyStatus: RepositoryStatus = { active: null, recent: [] };
  const repositoryManager: RepositoryManagerLike = {
    initialize: vi.fn(async () => emptyStatus),
    getStatus: vi.fn(() => emptyStatus),
    choose: vi.fn(async () => emptyStatus),
    activateRepository: vi.fn(async () => emptyStatus),
  };
  const projectService: ProjectService = {
    listProjects: vi.fn(async () => []),
    getProject: vi.fn(async () => undefined),
    createProject: vi.fn(async () => project),
    updateProject: vi.fn(async () => project),
    archiveProject: vi.fn(async () => project),
    unarchiveProject: vi.fn(async () => project),
    deleteProject: vi.fn(async () => undefined),
    listProjectAssets: vi.fn(async () => []),
    getProjectAsset: vi.fn(async () => undefined),
    createProjectAsset: vi.fn(async () => projectAsset),
    updateProjectAsset: vi.fn(async () => projectAsset),
    archiveProjectAsset: vi.fn(async () => projectAsset),
    unarchiveProjectAsset: vi.fn(async () => projectAsset),
    deleteProjectAsset: vi.fn(async () => undefined),
    resolveDestinationDirectory: vi.fn(async () => 'images'),
  };
  const referenceLibraryService: ReferenceLibraryService = {
    list: vi.fn(async () => []),
    createFolder: vi.fn(async () => referenceFolder),
    renameFolder: vi.fn(async () => undefined),
    deleteFolder: vi.fn(async () => undefined),
    createImage: vi.fn(async () => referenceImage),
    getImage: vi.fn(async () => undefined),
    getImageById: vi.fn(async () => undefined),
    readImage: vi.fn(async () => new Uint8Array()),
    renameImage: vi.fn(async () => undefined),
    deleteImage: vi.fn(async () => undefined),
  };
  const runService: RunService = {
    submit: vi.fn(async () => ({ runId: RUN_ID })),
    getSnapshot: vi.fn(async () => undefined),
    listRuns: vi.fn(async () => []),
    consumeFailures: vi.fn(() => []),
    cancel: vi.fn(async () => snapshot),
    retry: vi.fn(async () => ({ runId: RETRY_RUN_ID })),
    getImage: vi.fn(async () => undefined),
    getImageMetadata: vi.fn(async () => undefined),
    readImage: vi.fn(async () => new Uint8Array()),
    listImages: vi.fn(async () => []),
    recover: vi.fn(async () => undefined),
  };
  return { repositoryManager, projectService, referenceLibraryService, runService };
}

const openApps: FastifyInstance[] = [];

async function openApp(
  services: InjectedServices,
  overrides: AppOptions = {},
): Promise<FastifyInstance> {
  const app = await buildApp({ ...services, ...overrides });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
});

describe('loopback safeguards', () => {
  it('returns a controlled 403 for malformed and non-loopback origins', async () => {
    const services = createInjectedServices();
    const app = await openApp(services);

    const malformed = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { ...HEADERS, origin: 'not a URL' },
    });
    const remote = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { ...HEADERS, origin: 'https://example.com' },
    });

    expect(malformed.statusCode).toBe(403);
    expect(malformed.json()).toEqual({ error: 'Untrusted Origin header' });
    expect(remote.statusCode).toBe(403);
    expect(services.repositoryManager.initialize).toHaveBeenCalledOnce();
  });
});

describe('repository API', () => {
  it('returns path-free status for folder selection and recent activation', async () => {
    const services = createInjectedServices();
    const selectedStatus = {
      active: { repositoryId: REPOSITORY_ID, name: 'Private repository' },
      recent: [{ repositoryId: REPOSITORY_ID, name: 'Private repository' }],
      absolutePath: '/Users/private/Pictures',
    } as RepositoryStatus & { absolutePath: string };
    const choose = vi.fn(async () => selectedStatus);
    const activate = vi.fn(async () => selectedStatus);
    services.repositoryManager.choose = choose;
    services.repositoryManager.activateRepository = activate;
    const app = await openApp(services);

    const chosen = await app.inject({
      method: 'POST',
      url: '/api/repository/choose',
      headers: HEADERS,
    });
    const activated = await app.inject({
      method: 'POST',
      url: `/api/repository/activate/${REPOSITORY_ID}`,
      headers: HEADERS,
    });

    expect(chosen.statusCode).toBe(200);
    expect(activated.json()).toEqual({
      active: { repositoryId: REPOSITORY_ID, name: 'Private repository' },
      recent: [{ repositoryId: REPOSITORY_ID, name: 'Private repository' }],
    });
    expect(activated.body).not.toContain('/Users/private');
    expect(choose).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledWith(REPOSITORY_ID);
  });

  it('validates activation IDs and maps unavailable recent repositories to 404', async () => {
    const services = createInjectedServices();
    services.repositoryManager.activateRepository = vi.fn(async () => {
      throw new RepositoryUnavailableError('private filesystem detail');
    });
    const app = await openApp(services);

    const malformed = await app.inject({
      method: 'POST',
      url: '/api/repository/activate/not-a-uuid',
      headers: HEADERS,
    });
    const missing = await app.inject({
      method: 'POST',
      url: `/api/repository/activate/${REPOSITORY_ID}`,
      headers: HEADERS,
    });

    expect(malformed.statusCode).toBe(400);
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'Repository not found.' });
  });
});

describe('project API', () => {
  it('validates strict bodies and drives project plus nested-asset CRUD without paths', async () => {
    const services = createInjectedServices();
    const createProject = vi.fn(async () => project);
    const updateProject = vi.fn(async () => project);
    const deleteProject = vi.fn(async () => undefined);
    const createAsset = vi.fn(async () => projectAsset);
    const updateAsset = vi.fn(async () => projectAsset);
    const deleteAsset = vi.fn(async () => undefined);
    services.projectService.createProject = createProject;
    services.projectService.updateProject = updateProject;
    services.projectService.deleteProject = deleteProject;
    services.projectService.getProject = vi.fn(async () => project);
    services.projectService.listProjectAssets = vi.fn(async () => [projectAsset]);
    services.projectService.getProjectAsset = vi.fn(async () => projectAsset);
    services.projectService.createProjectAsset = createAsset;
    services.projectService.updateProjectAsset = updateAsset;
    services.projectService.deleteProjectAsset = deleteAsset;
    const app = await openApp(services);

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: HEADERS,
      payload: { name: 'Campaign', description: 'Notes', directory: '/tmp/injected' },
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: HEADERS,
      payload: { name: '  Campaign  ', description: 'Notes' },
    });
    const detail = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}`,
      headers: HEADERS,
    });
    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}`,
      headers: HEADERS,
      payload: { description: 'Updated notes' },
    });
    const nestedCreated = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/assets`,
      headers: HEADERS,
      payload: { name: 'Hero product', description: 'Nested notes' },
    });
    const nestedUpdated = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/assets/${ASSET_ID}`,
      headers: HEADERS,
      payload: { name: 'Hero detail' },
    });
    const nestedDeleted = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/assets/${ASSET_ID}`,
      headers: HEADERS,
    });
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}`,
      headers: HEADERS,
    });

    expect(invalid.statusCode).toBe(400);
    expect(created.statusCode).toBe(201);
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      project: { projectId: PROJECT_ID, description: 'Organizational notes only' },
      assets: [{ assetId: ASSET_ID, projectId: PROJECT_ID }],
    });
    expect(detail.body).not.toContain('directory');
    expect(updated.statusCode).toBe(200);
    expect(nestedCreated.statusCode).toBe(201);
    expect(nestedUpdated.statusCode).toBe(200);
    expect(nestedDeleted.statusCode).toBe(204);
    expect(deleted.statusCode).toBe(204);
    expect(createProject).toHaveBeenCalledWith({ name: 'Campaign', description: 'Notes' });
    expect(updateProject).toHaveBeenCalledWith(PROJECT_ID, {
      description: 'Updated notes',
    });
    expect(createAsset).toHaveBeenCalledWith(PROJECT_ID, {
      name: 'Hero product',
      description: 'Nested notes',
    });
    expect(updateAsset).toHaveBeenCalledWith(PROJECT_ID, ASSET_ID, {
      name: 'Hero detail',
    });
    expect(deleteAsset).toHaveBeenCalledWith(PROJECT_ID, ASSET_ID);
    expect(deleteProject).toHaveBeenCalledWith(PROJECT_ID);
  });

  it('centrally maps repository and project service failures', async () => {
    const services = createInjectedServices();
    services.projectService.listProjects = vi.fn(async () => {
      throw new RepositoryUnavailableError();
    });
    services.projectService.createProject = vi.fn(async () => {
      throw new ProjectServiceError('An active project already has that name.', 409);
    });
    const app = await openApp(services);

    const unavailable = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: HEADERS,
    });
    const conflict = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: HEADERS,
      payload: { name: 'Duplicate' },
    });

    expect(unavailable.statusCode).toBe(503);
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({ error: 'An active project already has that name.' });
  });
});

describe('local run API', () => {
  it('defaults destination, filters durable history, and returns path-free polling DTOs', async () => {
    const services = createInjectedServices();
    const submit = vi.fn(async () => ({ runId: RUN_ID }));
    const listRuns = vi.fn(async () => [snapshot]);
    services.runService.submit = submit;
    services.runService.getSnapshot = vi.fn(async () => snapshot);
    services.runService.listRuns = listRuns;
    services.runService.cancel = vi.fn(async () => snapshot);
    services.runService.retry = vi.fn(async () => ({ runId: RETRY_RUN_ID }));
    const app = await openApp(services);

    const submitted = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: HEADERS,
      payload: {
        targetId: 'generation/core',
        request: { prompt: 'A small blue house', aspect_ratio: '1:1' },
        requestedJobCount: 1,
        seedPlan: { strategy: 'harness-random' },
      },
    });
    const history = await app.inject({
      method: 'GET',
      url: `/api/runs?destination=project-asset&projectId=${PROJECT_ID}&projectAssetId=${ASSET_ID}`,
      headers: HEADERS,
    });
    const polled = await app.inject({
      method: 'GET',
      url: `/api/runs/${RUN_ID}`,
      headers: HEADERS,
    });
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/runs/${RUN_ID}/cancel`,
      headers: HEADERS,
    });
    const retried = await app.inject({
      method: 'POST',
      url: `/api/runs/${RUN_ID}/retry`,
      headers: HEADERS,
    });

    expect(submitted.statusCode).toBe(202);
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ destination: { kind: 'main' } }));
    expect(history.statusCode).toBe(200);
    expect(listRuns).toHaveBeenCalledWith({
      kind: 'project-asset',
      projectId: PROJECT_ID,
      projectAssetId: ASSET_ID,
    });
    const pollingDto = polled.json<{ jobs: Record<string, unknown>[] }>();
    expect(pollingDto).toMatchObject({
      run: { runId: RUN_ID, destination: run.destination },
      jobs: [
        {
          jobId: JOB_ID,
          outputImageIds: [IMAGE_ID],
        },
      ],
    });
    expect(pollingDto.jobs[0]).not.toHaveProperty('request');
    expect(pollingDto.jobs[0]).not.toHaveProperty('inputs');
    expect(polled.body).not.toContain('/Users/private');
    expect(polled.body).not.toContain(referenceImage.repositoryRelativePath);
    expect(cancelled.statusCode).toBe(200);
    expect(retried.statusCode).toBe(202);
    expect(retried.json()).toEqual({ runId: RETRY_RUN_ID, status: 'queued' });
  });

  it('returns 503 when no repository is active and rejects unknown body fields', async () => {
    const services = createInjectedServices();
    services.runService.submit = vi.fn(async () => {
      throw new RepositoryUnavailableError();
    });
    const app = await openApp(services);

    const unavailable = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: HEADERS,
      payload: {
        targetId: 'generation/core',
        request: { prompt: 'A small blue house' },
        requestedJobCount: 1,
        seedPlan: { strategy: 'harness-random' },
      },
    });
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: HEADERS,
      payload: {
        targetId: 'generation/core',
        request: { prompt: 'A small blue house' },
        requestedJobCount: 1,
        seedPlan: { strategy: 'harness-random' },
        localPath: '/tmp/output',
      },
    });

    expect(unavailable.statusCode).toBe(503);
    expect(invalid.statusCode).toBe(400);
  });

  it('delivers a discarded generation error without adding a failed history record', async () => {
    const services = createInjectedServices();
    const consumeFailures = vi.fn(() => [
      { runId: RUN_ID, error: 'Bedrock rejected this generation', discarded: true },
    ]);
    services.runService.consumeFailures = consumeFailures;
    const app = await openApp(services);

    const response = await app.inject({
      method: 'GET',
      url: '/api/runs',
      headers: HEADERS,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      runs: [],
      failures: [{ runId: RUN_ID, error: 'Bedrock rejected this generation', discarded: true }],
    });
    expect(consumeFailures).toHaveBeenCalledWith(undefined);
  });
});

describe('generated image API', () => {
  it('serves ID-resolved gallery, content, and sidecar routes safely', async () => {
    const services = createInjectedServices();
    const generatedRecord = {
      imageId: IMAGE_ID,
      runId: RUN_ID,
      repositoryRelativePath: imageMetadata.repositoryRelativePath,
      mediaType: 'image/png' as const,
      byteLength: 3,
    };
    const readImage = vi.fn(async () => new Uint8Array([1, 2, 3]));
    services.runService.listImages = vi.fn(async () => [
      {
        imageId: IMAGE_ID,
        runId: RUN_ID,
        mediaType: 'image/png' as const,
        byteLength: 3,
        createdAt: NOW,
        prompt: 'A small blue house',
        targetId: 'generation/core',
        projectId: PROJECT_ID,
      },
    ]);
    services.runService.getImage = vi.fn(async () => generatedRecord);
    services.runService.getImageMetadata = vi.fn(async () => imageMetadata);
    services.runService.readImage = readImage;
    const app = await openApp(services);

    const gallery = await app.inject({
      method: 'GET',
      url: '/api/images',
      headers: HEADERS,
    });
    const content = await app.inject({
      method: 'GET',
      url: `/api/images/${IMAGE_ID}/content`,
      headers: HEADERS,
    });
    const metadata = await app.inject({
      method: 'GET',
      url: `/api/images/${IMAGE_ID}/metadata`,
      headers: HEADERS,
    });
    const legacyAssetRoute = await app.inject({
      method: 'GET',
      url: `/api/assets/${RUN_ID}/${IMAGE_ID}`,
      headers: HEADERS,
    });

    expect(gallery.statusCode).toBe(200);
    expect(gallery.body).not.toContain('repositoryRelativePath');
    expect(content.statusCode).toBe(200);
    expect(content.headers['content-type']).toContain('image/png');
    expect(content.rawPayload).toEqual(Buffer.from([1, 2, 3]));
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json()).toMatchObject({
      imageId: IMAGE_ID,
      repositoryRelativePath: imageMetadata.repositoryRelativePath,
    });
    expect(metadata.body).not.toContain('/Users/');
    expect(legacyAssetRoute.statusCode).toBe(404);
    expect(readImage).toHaveBeenCalledWith(generatedRecord);
  });
});

describe('local reference library API', () => {
  it('keeps repository paths out of DTOs and reads content through the image record', async () => {
    const services = createInjectedServices();
    const readImage = vi.fn(async () => new Uint8Array([4, 5, 6]));
    services.referenceLibraryService.list = vi.fn(async () => [
      { folder: referenceFolder, images: [referenceImage] },
    ]);
    services.referenceLibraryService.getImage = vi.fn(async () => referenceImage);
    services.referenceLibraryService.readImage = readImage;
    const app = await openApp(services);

    const library = await app.inject({
      method: 'GET',
      url: '/api/reference-library',
      headers: HEADERS,
    });
    const content = await app.inject({
      method: 'GET',
      url: `/api/reference-folders/${FOLDER_ID}/images/${REFERENCE_IMAGE_ID}/content`,
      headers: HEADERS,
    });

    expect(library.statusCode).toBe(200);
    expect(library.json()).toMatchObject({
      folders: [
        {
          folderId: FOLDER_ID,
          name: 'Lighting',
          images: [{ imageId: REFERENCE_IMAGE_ID, name: 'softbox.jpg' }],
        },
      ],
    });
    expect(library.body).not.toContain('repositoryRelativePath');
    expect(library.body).not.toContain(referenceFolder.directory);
    expect(library.body).not.toContain(referenceImage.sha256);
    expect(content.statusCode).toBe(200);
    expect(content.rawPayload).toEqual(Buffer.from([4, 5, 6]));
    expect(readImage).toHaveBeenCalledWith(referenceImage);
  });
});
