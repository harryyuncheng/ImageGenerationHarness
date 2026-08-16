import { randomUUID } from 'node:crypto';
import {
  projectCreateRequestSchema,
  projectUpdateRequestSchema,
  type ProjectCreateRequest,
  type ProjectUpdateRequest,
} from '@harness/contracts';
import {
  destinationSchema,
  projectAssetSchema,
  projectSchema,
  SCHEMA_VERSION,
  type Destination,
  type Project,
  type ProjectAsset,
} from '@harness/domain';
import {
  findDirectoryManifest,
  hasActiveNameConflict,
  loadDirectoryManifests,
  requireDirectoryManifest,
} from '../repository/manifest-collection.js';
import { type LocalImageRepository } from '../repository/local-image-repository.js';
import type { LocalRepositoryManager } from '../repository/repository-manager.js';
import { safeSlug } from '../repository/slug.js';
import {
  badInput,
  projectAssetsCollection,
  projectsCollection,
  ProjectServiceError,
  setOrganizationalRecordArchived,
  updateOrganizationalRecord,
} from './project-records.js';

export interface ProjectService {
  listProjects(options?: { includeArchived?: boolean }): Promise<Project[]>;
  getProject(projectId: string): Promise<Project | undefined>;
  createProject(input: ProjectCreateRequest): Promise<Project>;
  updateProject(projectId: string, input: ProjectUpdateRequest): Promise<Project>;
  archiveProject(projectId: string): Promise<Project>;
  unarchiveProject(projectId: string): Promise<Project>;
  deleteProject(projectId: string): Promise<void>;
  listProjectAssets(
    projectId: string,
    options?: { includeArchived?: boolean },
  ): Promise<ProjectAsset[]>;
  getProjectAsset(projectId: string, assetId: string): Promise<ProjectAsset | undefined>;
  createProjectAsset(projectId: string, input: ProjectCreateRequest): Promise<ProjectAsset>;
  updateProjectAsset(
    projectId: string,
    assetId: string,
    input: ProjectUpdateRequest,
  ): Promise<ProjectAsset>;
  archiveProjectAsset(projectId: string, assetId: string): Promise<ProjectAsset>;
  unarchiveProjectAsset(projectId: string, assetId: string): Promise<ProjectAsset>;
  deleteProjectAsset(projectId: string, assetId: string): Promise<void>;
  resolveDestinationDirectory(destination: Destination): Promise<string>;
}

export class LocalProjectService implements ProjectService {
  constructor(private readonly manager: LocalRepositoryManager) {}

  async listProjects(options: { includeArchived?: boolean } = {}): Promise<Project[]> {
    return this.manager.withRepository(async (repository) => {
      const projects = await this.#loadProjects(repository);
      return projects
        .filter((project) => options.includeArchived === true || !project.archivedAt)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
  }

  async getProject(projectId: string): Promise<Project | undefined> {
    return this.manager.withRepository((repository) => this.#findProject(repository, projectId));
  }

  async createProject(input: ProjectCreateRequest): Promise<Project> {
    let validated: ProjectCreateRequest;
    try {
      validated = projectCreateRequestSchema.parse(input);
    } catch (error) {
      badInput(error, 'Invalid project.');
    }
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const projects = await this.#loadProjects(repository);
        if (hasActiveNameConflict(projects, validated.name)) {
          throw new ProjectServiceError('An active project already has that name.', 409);
        }
        const projectId = randomUUID();
        const now = new Date().toISOString();
        const directory = `projects/${safeSlug(validated.name)}--${projectId}`;
        const project = projectSchema.parse({
          schemaVersion: SCHEMA_VERSION,
          projectId,
          name: validated.name,
          description: validated.description ?? '',
          directory,
          createdAt: now,
          updatedAt: now,
        });
        await repository.ensureDirectory(`${directory}/images`);
        await repository.ensureDirectory(`${directory}/assets`);
        await repository.writeJson(`${directory}/project.json`, project, projectSchema);
        return project;
      }),
    );
  }

  async updateProject(projectId: string, input: ProjectUpdateRequest): Promise<Project> {
    let validated: ProjectUpdateRequest;
    try {
      validated = projectUpdateRequestSchema.parse(input);
    } catch (error) {
      badInput(error, 'Invalid project update.');
    }
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const project = await this.#requireProject(repository, projectId);
        return updateOrganizationalRecord({
          repository,
          record: project,
          recordId: projectId,
          getId: (candidate) => candidate.projectId,
          loadPeers: () => this.#loadProjects(repository),
          update: validated,
          schema: projectSchema,
          manifestPath: `${project.directory}/project.json`,
          conflictMessage: 'An active project already has that name.',
        });
      }),
    );
  }

  archiveProject(projectId: string): Promise<Project> {
    return this.#setProjectArchived(projectId, true);
  }

  unarchiveProject(projectId: string): Promise<Project> {
    return this.#setProjectArchived(projectId, false);
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const project = await this.#requireProject(repository, projectId);
        await repository.removeRelative(project.directory, { recursive: true });
      }),
    );
  }

  async listProjectAssets(
    projectId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<ProjectAsset[]> {
    return this.manager.withRepository(async (repository) => {
      const project = await this.#requireProject(repository, projectId);
      const assets = await this.#loadProjectAssets(repository, project);
      return assets
        .filter((asset) => options.includeArchived === true || !asset.archivedAt)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
  }

  async getProjectAsset(projectId: string, assetId: string): Promise<ProjectAsset | undefined> {
    return this.manager.withRepository(async (repository) => {
      const project = await this.#findProject(repository, projectId);
      if (!project) return undefined;
      return this.#findProjectAsset(repository, project, assetId);
    });
  }

  async createProjectAsset(projectId: string, input: ProjectCreateRequest): Promise<ProjectAsset> {
    let validated: ProjectCreateRequest;
    try {
      validated = projectCreateRequestSchema.parse(input);
    } catch (error) {
      badInput(error, 'Invalid project asset.');
    }
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const project = await this.#requireProject(repository, projectId);
        if (project.archivedAt) {
          throw new ProjectServiceError('Archived projects cannot receive new assets.', 409);
        }
        const assets = await this.#loadProjectAssets(repository, project);
        if (hasActiveNameConflict(assets, validated.name)) {
          throw new ProjectServiceError('An active project asset already has that name.', 409);
        }
        const assetId = randomUUID();
        const now = new Date().toISOString();
        const directory = `${project.directory}/assets/${safeSlug(validated.name)}--${assetId}`;
        const asset = projectAssetSchema.parse({
          schemaVersion: SCHEMA_VERSION,
          assetId,
          projectId,
          name: validated.name,
          description: validated.description ?? '',
          directory,
          createdAt: now,
          updatedAt: now,
        });
        await repository.ensureDirectory(`${directory}/images`);
        await repository.writeJson(`${directory}/asset.json`, asset, projectAssetSchema);
        return asset;
      }),
    );
  }

  async updateProjectAsset(
    projectId: string,
    assetId: string,
    input: ProjectUpdateRequest,
  ): Promise<ProjectAsset> {
    let validated: ProjectUpdateRequest;
    try {
      validated = projectUpdateRequestSchema.parse(input);
    } catch (error) {
      badInput(error, 'Invalid project asset update.');
    }
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const project = await this.#requireProject(repository, projectId);
        const asset = await this.#requireProjectAsset(repository, project, assetId);
        return updateOrganizationalRecord({
          repository,
          record: asset,
          recordId: assetId,
          getId: (candidate) => candidate.assetId,
          loadPeers: () => this.#loadProjectAssets(repository, project),
          update: validated,
          schema: projectAssetSchema,
          manifestPath: `${asset.directory}/asset.json`,
          conflictMessage: 'An active project asset already has that name.',
        });
      }),
    );
  }

  archiveProjectAsset(projectId: string, assetId: string): Promise<ProjectAsset> {
    return this.#setProjectAssetArchived(projectId, assetId, true);
  }

  unarchiveProjectAsset(projectId: string, assetId: string): Promise<ProjectAsset> {
    return this.#setProjectAssetArchived(projectId, assetId, false);
  }

  async deleteProjectAsset(projectId: string, assetId: string): Promise<void> {
    await this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const project = await this.#requireProject(repository, projectId);
        const asset = await this.#requireProjectAsset(repository, project, assetId);
        await repository.removeRelative(asset.directory, { recursive: true });
      }),
    );
  }

  async resolveDestinationDirectory(destination: Destination): Promise<string> {
    let validated: Destination;
    try {
      validated = destinationSchema.parse(destination);
    } catch (error) {
      badInput(error, 'Invalid image destination.');
    }
    return this.manager.withRepository(async (repository) => {
      if (validated.kind === 'main') return 'images';
      const project = await this.#requireProject(repository, validated.projectId);
      if (project.archivedAt) {
        throw new ProjectServiceError('The destination project is archived.', 409);
      }
      if (validated.kind === 'project') return `${project.directory}/images`;
      const asset = await this.#requireProjectAsset(repository, project, validated.projectAssetId);
      if (asset.archivedAt) {
        throw new ProjectServiceError('The destination project asset is archived.', 409);
      }
      return `${asset.directory}/images`;
    });
  }

  async #setProjectArchived(projectId: string, archived: boolean): Promise<Project> {
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const project = await this.#requireProject(repository, projectId);
        return setOrganizationalRecordArchived({
          repository,
          record: project,
          recordId: projectId,
          getId: (candidate) => candidate.projectId,
          loadPeers: () => this.#loadProjects(repository),
          archived,
          schema: projectSchema,
          manifestPath: `${project.directory}/project.json`,
          conflictMessage: 'An active project already has that name.',
        });
      }),
    );
  }

  async #setProjectAssetArchived(
    projectId: string,
    assetId: string,
    archived: boolean,
  ): Promise<ProjectAsset> {
    return this.manager.withRepository((repository) =>
      repository.withMutation(async () => {
        const project = await this.#requireProject(repository, projectId);
        const asset = await this.#requireProjectAsset(repository, project, assetId);
        return setOrganizationalRecordArchived({
          repository,
          record: asset,
          recordId: assetId,
          getId: (candidate) => candidate.assetId,
          loadPeers: () => this.#loadProjectAssets(repository, project),
          archived,
          schema: projectAssetSchema,
          manifestPath: `${asset.directory}/asset.json`,
          conflictMessage: 'An active project asset already has that name.',
        });
      }),
    );
  }

  #loadProjects(repository: LocalImageRepository): Promise<Project[]> {
    return loadDirectoryManifests(repository, projectsCollection);
  }

  #findProject(repository: LocalImageRepository, projectId: string): Promise<Project | undefined> {
    return findDirectoryManifest(repository, projectsCollection, projectId);
  }

  #requireProject(repository: LocalImageRepository, projectId: string): Promise<Project> {
    return requireDirectoryManifest(
      repository,
      projectsCollection,
      projectId,
      () => new ProjectServiceError('Project not found.', 404),
    );
  }

  #loadProjectAssets(repository: LocalImageRepository, project: Project): Promise<ProjectAsset[]> {
    return loadDirectoryManifests(repository, projectAssetsCollection(project));
  }

  #findProjectAsset(
    repository: LocalImageRepository,
    project: Project,
    assetId: string,
  ): Promise<ProjectAsset | undefined> {
    return findDirectoryManifest(repository, projectAssetsCollection(project), assetId);
  }

  #requireProjectAsset(
    repository: LocalImageRepository,
    project: Project,
    assetId: string,
  ): Promise<ProjectAsset> {
    return requireDirectoryManifest(
      repository,
      projectAssetsCollection(project),
      assetId,
      () => new ProjectServiceError('Project asset not found.', 404),
    );
  }
}
