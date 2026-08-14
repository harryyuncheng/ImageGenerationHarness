/** Deterministic identifiers and payload builders shared by the studio specs. */

export const REPOSITORY_ID = '99999999-9999-4999-8999-999999999999';
export const ARCHIVE_REPOSITORY_ID = '88888888-8888-4888-8888-888888888888';
export const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
export const ASSET_ID = '22222222-2222-4222-8222-222222222222';
export const RUN_ID = '33333333-3333-4333-8333-333333333333';
export const IMAGE_ID = '44444444-4444-4444-8444-444444444444';
export const JOB_ID = '55555555-5555-4555-8555-555555555555';
export const ATTEMPT_ID = '66666666-6666-4666-8666-666666666666';
export const SECOND_RUN_ID = '77777777-7777-4777-8777-777777777777';
export const SECOND_JOB_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const SECOND_IMAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const SECOND_ATTEMPT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const NOW = '2026-08-07T12:00:00.000Z';

export const activeRepository = {
  active: { repositoryId: REPOSITORY_ID, name: 'Studio Library' },
  recent: [
    { repositoryId: REPOSITORY_ID, name: 'Studio Library' },
    { repositoryId: ARCHIVE_REPOSITORY_ID, name: 'Archive Library' },
  ],
};

export const transparentPngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

export const project = {
  projectId: PROJECT_ID,
  name: 'Autumn campaign',
  description: 'Warm organizational notes only',
  createdAt: NOW,
  updatedAt: NOW,
};

export const projectAsset = {
  assetId: ASSET_ID,
  projectId: PROJECT_ID,
  name: 'Hero product',
  description: 'Blue ceramic organizational notes',
  createdAt: NOW,
  updatedAt: NOW,
};

type RunDestination =
  | { kind: 'main' }
  | { kind: 'project'; projectId: string }
  | { kind: 'project-asset'; projectId: string; projectAssetId: string };

interface RunSnapshotOptions {
  runId: string;
  jobId: string;
  prompt: string;
  status?: 'queued' | 'completed';
  createdAt?: string;
  updatedAt?: string;
  destination?: RunDestination;
  outputImageIds?: string[];
  attemptId?: string;
}

/** A durable run snapshot exactly as the local control plane reports it. */
export function runSnapshot(options: RunSnapshotOptions) {
  const status = options.status ?? 'queued';
  const createdAt = options.createdAt ?? NOW;
  const updatedAt = options.updatedAt ?? createdAt;
  const destination: RunDestination = options.destination ?? { kind: 'main' };
  return {
    run: {
      schemaVersion: 1,
      runId: options.runId,
      status,
      registryVersion: 'test-registry',
      targetId: 'generation/core',
      destination,
      requestedJobCount: 1,
      seedPlan: { strategy: 'harness-random' },
      prompt: options.prompt,
      jobIds: [options.jobId],
      createdAt,
      updatedAt,
    },
    jobs: [
      {
        schemaVersion: 1,
        runId: options.runId,
        jobId: options.jobId,
        status,
        targetId: 'generation/core',
        destination,
        plannedSeed: null,
        providerSeed: null,
        outputImageIds: options.outputImageIds ?? [],
        attempts:
          options.attemptId === undefined
            ? []
            : [
                {
                  attemptId: options.attemptId,
                  ordinal: 1,
                  status: 'succeeded',
                  startedAt: createdAt,
                  finishedAt: createdAt,
                },
              ],
        createdAt,
        updatedAt,
      },
    ],
  };
}

export function galleryImage(overrides: Record<string, unknown> = {}) {
  return {
    imageId: IMAGE_ID,
    runId: RUN_ID,
    mediaType: 'image/png',
    byteLength: transparentPngBytes.byteLength,
    createdAt: NOW,
    prompt: 'Baroque source',
    targetId: 'generation/core',
    ...overrides,
  };
}

export function imageSidecar() {
  return {
    schemaVersion: 1,
    imageId: IMAGE_ID,
    repositoryRelativePath: `images/gallery--${IMAGE_ID}.png`,
    createdAt: NOW,
    runId: RUN_ID,
    jobId: JOB_ID,
    attemptId: ATTEMPT_ID,
    capabilityRegistryVersion: '2026-08-06.1',
    canonicalTargetId: 'generation/core',
    invocationId: 'stability.stable-image-core-v1:1',
    prompt: 'Gallery prompt',
    normalizedRequest: { prompt: 'Gallery prompt', output_format: 'png' },
    seed: { strategy: 'harness-random', planned: 123, provider: 123 },
    output: {
      format: 'png',
      mediaType: 'image/png',
      width: 16,
      height: 16,
      byteLength: 128,
      sha256: 'a'.repeat(64),
    },
    inputs: [],
    provider: { finishReason: null, metadata: {} },
  };
}

export function referenceFolder(folderId: string, imageId: string) {
  return {
    folderId,
    name: 'Editorial lighting',
    createdAt: '2026-08-06T10:00:00.000Z',
    updatedAt: '2026-08-06T10:00:00.000Z',
    images: [
      {
        folderId,
        imageId,
        name: 'soft-window-light.jpg',
        mediaType: 'image/jpeg',
        byteLength: 1024,
        width: 1200,
        height: 800,
        createdAt: '2026-08-06T10:00:00.000Z',
        updatedAt: '2026-08-06T10:00:00.000Z',
      },
    ],
  };
}
