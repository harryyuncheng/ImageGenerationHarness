import { afterEach, describe, expect, it } from 'vitest';
import type { LocalRepositoryManager } from './local-repository.js';
import { LocalProjectService } from './project-service.js';
import { TemporaryDirectoryScope } from './test-support.js';

const temporaryDirectories = new TemporaryDirectoryScope();

async function createServices(): Promise<{
  manager: LocalRepositoryManager;
  projects: LocalProjectService;
}> {
  const { manager } =
    await temporaryDirectories.createSelectedRepository('image-harness-projects-');
  return { manager, projects: new LocalProjectService(manager) };
}

afterEach(async () => {
  await temporaryDirectories.cleanup();
});

describe('local projects', () => {
  it('persists project CRUD and keeps stable directories across description and name edits', async () => {
    const { projects } = await createServices();
    const created = await projects.createProject({
      name: 'Autumn Campaign',
      description: 'Warm product studies',
    });
    const originalDirectory = created.directory;
    expect((await projects.getProject(created.projectId))?.description).toBe(
      'Warm product studies',
    );

    const updated = await projects.updateProject(created.projectId, {
      name: 'Winter Campaign',
      description: 'Cold product studies',
    });
    expect(updated.directory).toBe(originalDirectory);
    expect(updated.description).toBe('Cold product studies');
    expect((await projects.listProjects()).map((project) => project.name)).toEqual([
      'Winter Campaign',
    ]);

    await projects.archiveProject(created.projectId);
    expect(await projects.listProjects()).toEqual([]);
    expect(await projects.listProjects({ includeArchived: true })).toHaveLength(1);
    await projects.unarchiveProject(created.projectId);
    await projects.deleteProject(created.projectId);
    expect(await projects.getProject(created.projectId)).toBeUndefined();
  });

  it('enforces nested asset parents and validates destination ownership', async () => {
    const { projects } = await createServices();
    const first = await projects.createProject({ name: 'Characters' });
    const second = await projects.createProject({ name: 'Locations' });
    const asset = await projects.createProjectAsset(first.projectId, {
      name: 'Hero Costume',
      description: 'Organization only',
    });
    const originalDirectory = asset.directory;

    const renamed = await projects.updateProjectAsset(first.projectId, asset.assetId, {
      name: 'Hero Wardrobe',
      description: 'Updated organization note',
    });
    expect(renamed.directory).toBe(originalDirectory);
    expect(
      await projects.resolveDestinationDirectory({
        kind: 'project-asset',
        projectId: first.projectId,
        projectAssetId: asset.assetId,
      }),
    ).toBe(`${asset.directory}/images`);

    await expect(
      projects.resolveDestinationDirectory({
        kind: 'project-asset',
        projectId: second.projectId,
        projectAssetId: asset.assetId,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await projects.getProjectAsset(second.projectId, asset.assetId)).toBeUndefined();
  });

  it('rejects duplicate active names with a conflict error', async () => {
    const { projects } = await createServices();
    await projects.createProject({ name: 'Editorial' });
    await expect(projects.createProject({ name: 'editorial' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
