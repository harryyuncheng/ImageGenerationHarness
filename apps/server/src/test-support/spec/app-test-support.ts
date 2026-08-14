import type { FastifyInstance } from 'fastify';
import { afterEach, vi } from 'vitest';
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
import { buildApp, type AppOptions, type RepositoryManagerLike } from '../../app.js';
import type { ProjectService } from '../../projects/project-service.js';
import type { ReferenceLibraryService } from '../../references/reference-library-service.js';
import type { GalleryImage, RunService, RunSnapshot } from '../../runs/run-types.js';

export type {
  AppOptions,
  GalleryImage,
  GeneratedImageSidecar,
  LocalJob,
  LocalRun,
  Project,
  ProjectAsset,
  ProjectService,
  ReferenceFolder,
  ReferenceImage,
  ReferenceLibraryService,
  RepositoryManagerLike,
  RepositoryStatus,
  RunService,
  RunSnapshot,
};
export { ProjectServiceError } from '../../projects/project-records.js';
export { RepositoryUnavailableError } from '../../repository/errors.js';

export const HEADERS = { host: '127.0.0.1:4173' } as const;
export const NOW = '2026-08-07T12:00:00.000Z';
export const REPOSITORY_ID = '99999999-9999-4999-8999-999999999999';
export const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
export const ASSET_ID = '22222222-2222-4222-8222-222222222222';
export const RUN_ID = '33333333-3333-4333-8333-333333333333';
export const RETRY_RUN_ID = '33333333-3333-4333-8333-333333333334';
export const JOB_ID = '44444444-4444-4444-8444-444444444444';
export const IMAGE_ID = '55555555-5555-4555-8555-555555555555';
export const FOLDER_ID = '66666666-6666-4666-8666-666666666666';
export const REFERENCE_IMAGE_ID = '77777777-7777-4777-8777-777777777777';
export const ATTEMPT_ID = '88888888-8888-4888-8888-888888888888';

export const project: Project = {
  schemaVersion: 1,
  projectId: PROJECT_ID,
  name: 'Autumn campaign',
  description: 'Organizational notes only',
  directory: `projects/private--${PROJECT_ID}`,
  createdAt: NOW,
  updatedAt: NOW,
};

export const projectAsset: ProjectAsset = {
  schemaVersion: 1,
  assetId: ASSET_ID,
  projectId: PROJECT_ID,
  name: 'Hero product',
  description: 'Nested notes',
  directory: `${project.directory}/assets/private--${ASSET_ID}`,
  createdAt: NOW,
  updatedAt: NOW,
};

export const referenceFolder: ReferenceFolder = {
  schemaVersion: 1,
  folderId: FOLDER_ID,
  name: 'Lighting',
  directory: `references/private--${FOLDER_ID}`,
  createdAt: NOW,
  updatedAt: NOW,
};

export const referenceImage: ReferenceImage = {
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

export const run: LocalRun = {
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

export const job: LocalJob = {
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

export const snapshot: RunSnapshot = { run, jobs: [job] };

export const imageMetadata: GeneratedImageSidecar = {
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

export interface InjectedServices {
  repositoryManager: RepositoryManagerLike;
  projectService: ProjectService;
  referenceLibraryService: ReferenceLibraryService;
  runService: RunService;
}

const openApps: FastifyInstance[] = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
});

const resolved = <T>(value: T): Promise<T> => Promise.resolve(value);

export function createInjectedServices(): InjectedServices {
  const emptyStatus: RepositoryStatus = { active: null, recent: [] };
  const repositoryManager: RepositoryManagerLike = {
    initialize: vi.fn(() => resolved(emptyStatus)),
    getStatus: vi.fn(() => emptyStatus),
    choose: vi.fn(() => resolved(emptyStatus)),
    activateRepository: vi.fn(() => resolved(emptyStatus)),
  };
  const projectService: ProjectService = {
    listProjects: vi.fn(() => resolved<Project[]>([])),
    getProject: vi.fn(() => resolved<Project | undefined>(undefined)),
    createProject: vi.fn(() => resolved(project)),
    updateProject: vi.fn(() => resolved(project)),
    archiveProject: vi.fn(() => resolved(project)),
    unarchiveProject: vi.fn(() => resolved(project)),
    deleteProject: vi.fn(() => resolved(undefined)),
    listProjectAssets: vi.fn(() => resolved<ProjectAsset[]>([])),
    getProjectAsset: vi.fn(() => resolved<ProjectAsset | undefined>(undefined)),
    createProjectAsset: vi.fn(() => resolved(projectAsset)),
    updateProjectAsset: vi.fn(() => resolved(projectAsset)),
    archiveProjectAsset: vi.fn(() => resolved(projectAsset)),
    unarchiveProjectAsset: vi.fn(() => resolved(projectAsset)),
    deleteProjectAsset: vi.fn(() => resolved(undefined)),
    resolveDestinationDirectory: vi.fn(() => resolved('images')),
  };
  const referenceLibraryService: ReferenceLibraryService = {
    list: vi.fn(() => resolved<Awaited<ReturnType<ReferenceLibraryService['list']>>>([])),
    createFolder: vi.fn(() => resolved(referenceFolder)),
    renameFolder: vi.fn(() => resolved(undefined)),
    deleteFolder: vi.fn(() => resolved(undefined)),
    createImage: vi.fn(() => resolved(referenceImage)),
    getImage: vi.fn(() =>
      resolved<Awaited<ReturnType<ReferenceLibraryService['getImage']>>>(undefined),
    ),
    getImageById: vi.fn(() =>
      resolved<Awaited<ReturnType<ReferenceLibraryService['getImageById']>>>(undefined),
    ),
    readImage: vi.fn(() => resolved(new Uint8Array())),
    renameImage: vi.fn(() => resolved(undefined)),
    deleteImage: vi.fn(() => resolved(undefined)),
  };
  const runService: RunService = {
    submit: vi.fn(() => resolved({ runId: RUN_ID })),
    getSnapshot: vi.fn(() => resolved<RunSnapshot | undefined>(undefined)),
    listRuns: vi.fn(() => resolved<RunSnapshot[]>([])),
    consumeFailures: vi.fn(() => []),
    cancel: vi.fn(() => resolved(snapshot)),
    retry: vi.fn(() => resolved({ runId: RETRY_RUN_ID })),
    getImage: vi.fn(() => resolved<Awaited<ReturnType<RunService['getImage']>>>(undefined)),
    getImageMetadata: vi.fn(() =>
      resolved<Awaited<ReturnType<RunService['getImageMetadata']>>>(undefined),
    ),
    readImage: vi.fn(() => resolved(new Uint8Array())),
    listImages: vi.fn(() => resolved<GalleryImage[]>([])),
    recover: vi.fn(() => resolved(undefined)),
  };
  return { repositoryManager, projectService, referenceLibraryService, runService };
}

export async function openApp(
  services: InjectedServices,
  overrides: AppOptions = {},
): Promise<FastifyInstance> {
  const app = await buildApp({ ...services, ...overrides });
  openApps.push(app);
  return app;
}
