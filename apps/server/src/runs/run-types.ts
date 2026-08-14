import type { CreateRunRequest, GalleryImageDto, GenerationFailure } from '@harness/contracts';
import type {
  Destination,
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
  submit(input: RunSubmission): Promise<{ runId: string }>;
  getSnapshot(runId: string): Promise<RunSnapshot | undefined>;
  listRuns(destination?: Destination): Promise<RunSnapshot[]>;
  consumeFailures(destination?: Destination): GenerationFailure[];
  cancel(runId: string): Promise<RunSnapshot>;
  retry(runId: string): Promise<{ runId: string }>;
  getImage(imageId: string): Promise<GeneratedImageRecord | undefined>;
  getImageMetadata(imageId: string): Promise<GeneratedImageSidecar | undefined>;
  readImage(image: GeneratedImageRecord): Promise<Uint8Array>;
  listImages(destination?: Destination): Promise<GalleryImage[]>;
  recover(): Promise<void>;
}

export interface RunQueueItem {
  runId: string;
  jobId: string;
  repository: LocalImageRepository;
  destinationDirectory: string;
}

export interface StagedRequest {
  request: Record<string, unknown>;
  inputs: LocalInputReference[];
  createdInputPaths: string[];
}

export interface PendingGenerationFailure extends GenerationFailure {
  destination: Destination;
}

export interface PublishedOutput {
  imagePath: string;
  sidecarPath: string;
}
