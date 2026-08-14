import type { RepositoryStatus } from '@harness/domain';
import type { ProjectService } from '../projects/project-service.js';
import type { ReferenceLibraryService } from '../references/reference-library-service.js';
import type { RunService } from '../runs/run-types.js';

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
