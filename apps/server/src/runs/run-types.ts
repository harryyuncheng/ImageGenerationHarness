import type {
  CreateRunRequest,
  GalleryImageDto,
  GenerationFailure,
  ProviderId,
} from '@harness/contracts';
import type {
  GeneratedImageSidecar,
  LocalInputReference,
  LocalJob,
  LocalRun,
} from '@harness/domain';
import type { LocalImageRepository } from '../repository/local-image-repository.js';

export type RunSubmission = CreateRunRequest;

export interface RunSnapshot {
  run: LocalRun;
  jobs: LocalJob[];
}

export interface GeneratedImageRecord {
  imageId: string;
  runId: string;
  repositoryRelativePath: string;
  mediaType: GeneratedImageSidecar['output']['mediaType'];
  byteLength: number;
}

export type GalleryImage = GalleryImageDto;

export interface RunService {
  isProviderConfigured(providerId: ProviderId): boolean;
  submit(input: RunSubmission): Promise<{ runId: string }>;
  getSnapshot(runId: string): Promise<RunSnapshot | undefined>;
  listRuns(): Promise<RunSnapshot[]>;
  consumeFailures(): GenerationFailure[];
  cancel(runId: string): Promise<RunSnapshot>;
  getImage(imageId: string): Promise<GeneratedImageRecord | undefined>;
  readImage(image: GeneratedImageRecord): Promise<Uint8Array>;
  listImages(): Promise<GalleryImage[]>;
  recover(): Promise<void>;
}

export interface RunQueueItem {
  runId: string;
  jobId: string;
  repository: LocalImageRepository;
}

export interface StagedRequest {
  request: Record<string, unknown>;
  inputs: LocalInputReference[];
  createdInputPaths: string[];
}

export interface PublishedOutput {
  imagePath: string;
  sidecarPath: string;
}
