import type { ProjectUpdateRequest } from '@harness/contracts';
import {
  projectAssetSchema,
  projectSchema,
  type Project,
  type ProjectAsset,
} from '@harness/domain';
import { z, type ZodType } from 'zod';
import {
  hasActiveNameConflict,
  sameRecordName,
  type DirectoryManifestCollection,
} from '../repository/manifest-collection.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';

export class ProjectServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'ProjectServiceError';
  }
}

type OrganizationalRecord = Project | ProjectAsset;

export function badInput(error: unknown, message: string): never {
  if (error instanceof ProjectServiceError) throw error;
  if (error instanceof z.ZodError) throw new ProjectServiceError(message, 400);
  throw error;
}

function withoutArchivedAt<T extends OrganizationalRecord>(value: T): Omit<T, 'archivedAt'> {
  const { archivedAt, ...active } = value;
  void archivedAt;
  return active;
}

export async function updateOrganizationalRecord<T extends OrganizationalRecord>(options: {
  repository: LocalImageRepository;
  record: T;
  recordId: string;
  getId: (record: T) => string;
  loadPeers: () => Promise<T[]>;
  update: ProjectUpdateRequest;
  schema: ZodType<T>;
  manifestPath: string;
  conflictMessage: string;
}): Promise<T> {
  const { record, update } = options;
  if (update.name !== undefined && !sameRecordName(record.name, update.name)) {
    const peers = await options.loadPeers();
    if (
      hasActiveNameConflict(
        peers,
        update.name,
        (candidate) => options.getId(candidate) === options.recordId,
      )
    ) {
      throw new ProjectServiceError(options.conflictMessage, 409);
    }
  }
  const updated = options.schema.parse({
    ...record,
    ...(update.name === undefined ? {} : { name: update.name }),
    ...(update.description === undefined ? {} : { description: update.description }),
    updatedAt: new Date().toISOString(),
  });
  await options.repository.writeJson(options.manifestPath, updated, options.schema);
  return updated;
}

export async function setOrganizationalRecordArchived<T extends OrganizationalRecord>(options: {
  repository: LocalImageRepository;
  record: T;
  recordId: string;
  getId: (record: T) => string;
  loadPeers: () => Promise<T[]>;
  archived: boolean;
  schema: ZodType<T>;
  manifestPath: string;
  conflictMessage: string;
}): Promise<T> {
  if (!options.archived) {
    const peers = await options.loadPeers();
    if (
      hasActiveNameConflict(
        peers,
        options.record.name,
        (candidate) => options.getId(candidate) === options.recordId,
      )
    ) {
      throw new ProjectServiceError(options.conflictMessage, 409);
    }
  }
  const now = new Date().toISOString();
  const updated = options.schema.parse(
    options.archived
      ? {
          ...options.record,
          archivedAt: options.record.archivedAt ?? now,
          updatedAt: now,
        }
      : { ...withoutArchivedAt(options.record), updatedAt: now },
  );
  await options.repository.writeJson(options.manifestPath, updated, options.schema);
  return updated;
}

export const projectsCollection: DirectoryManifestCollection<Project> = {
  root: 'projects',
  manifestName: 'project.json',
  schema: projectSchema,
  identifier: (project) => project.projectId,
  validateBinding: (project, directory, directoryName) => {
    if (project.directory !== directory || !directoryName.endsWith(`--${project.projectId}`)) {
      throw new ProjectServiceError('A project manifest has an invalid directory binding.', 409);
    }
  },
};

export function projectAssetsCollection(
  project: Project,
): DirectoryManifestCollection<ProjectAsset> {
  return {
    root: `${project.directory}/assets`,
    manifestName: 'asset.json',
    schema: projectAssetSchema,
    identifier: (asset) => asset.assetId,
    validateBinding: (asset, directory, directoryName) => {
      if (
        asset.projectId !== project.projectId ||
        asset.directory !== directory ||
        !directoryName.endsWith(`--${asset.assetId}`)
      ) {
        throw new ProjectServiceError(
          'A project asset manifest has an invalid parent or directory binding.',
          409,
        );
      }
    },
  };
}
