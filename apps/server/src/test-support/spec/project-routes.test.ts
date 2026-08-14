import { describe, expect, it, vi } from 'vitest';
import {
  createInjectedServices,
  HEADERS,
  PROJECT_ID,
  ASSET_ID,
  RepositoryUnavailableError,
  ProjectServiceError,
  openApp,
  project,
  projectAsset,
} from './app-test-support.js';

describe('project API', () => {
  it('validates strict bodies and drives project plus nested-asset CRUD without paths', async () => {
    const services = createInjectedServices();
    const createProject = vi.fn(() => Promise.resolve(project));
    const updateProject = vi.fn(() => Promise.resolve(project));
    const deleteProject = vi.fn(() => Promise.resolve());
    const createAsset = vi.fn(() => Promise.resolve(projectAsset));
    const updateAsset = vi.fn(() => Promise.resolve(projectAsset));
    const deleteAsset = vi.fn(() => Promise.resolve());
    services.projectService.createProject = createProject;
    services.projectService.updateProject = updateProject;
    services.projectService.deleteProject = deleteProject;
    services.projectService.getProject = vi.fn(() => Promise.resolve(project));
    services.projectService.listProjectAssets = vi.fn(() => Promise.resolve([projectAsset]));
    services.projectService.getProjectAsset = vi.fn(() => Promise.resolve(projectAsset));
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
    services.projectService.listProjects = vi.fn(() =>
      Promise.reject(new RepositoryUnavailableError()),
    );
    services.projectService.createProject = vi.fn(() =>
      Promise.reject(new ProjectServiceError('An active project already has that name.', 409)),
    );
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
