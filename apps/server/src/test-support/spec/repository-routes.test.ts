import { describe, expect, it, vi } from 'vitest';
import {
  createInjectedServices,
  HEADERS,
  REPOSITORY_ID,
  RepositoryUnavailableError,
  openApp,
} from './app-test-support.js';

describe('repository API', () => {
  it('returns path-free status for folder selection and recent activation', async () => {
    const services = createInjectedServices();
    const selectedStatus = {
      active: { repositoryId: REPOSITORY_ID, name: 'Private repository' },
      recent: [{ repositoryId: REPOSITORY_ID, name: 'Private repository' }],
      absolutePath: '/Users/private/Pictures',
    };
    const choose = vi.fn(() => Promise.resolve(selectedStatus));
    const activate = vi.fn(() => Promise.resolve(selectedStatus));
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
    services.repositoryManager.activateRepository = vi.fn(() =>
      Promise.reject(new RepositoryUnavailableError('private filesystem detail')),
    );
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
