import { describe, expect, it } from 'vitest';
import { createInjectedServices, HEADERS, openApp } from './app-test-support.js';

describe('loopback safeguards', () => {
  it('returns a controlled 403 for malformed and non-loopback origins', async () => {
    const services = createInjectedServices();
    const app = await openApp(services);

    const malformed = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { ...HEADERS, origin: 'not a URL' },
    });
    const remote = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { ...HEADERS, origin: 'https://example.com' },
    });

    expect(malformed.statusCode).toBe(403);
    expect(malformed.json()).toEqual({ error: 'Untrusted Origin header' });
    expect(remote.statusCode).toBe(403);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(services.repositoryManager.initialize).toHaveBeenCalledOnce();
  });
});
