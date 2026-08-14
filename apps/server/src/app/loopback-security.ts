import type { FastifyInstance } from 'fastify';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function trustedUrl(value: string, requireHttpProtocol: boolean): boolean {
  try {
    const parsed = new URL(requireHttpProtocol ? value : `http://${value}`);
    return (
      (!requireHttpProtocol || parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      LOOPBACK_HOSTS.has(parsed.hostname) &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === '/' &&
      !parsed.search &&
      !parsed.hash
    );
  } catch {
    return false;
  }
}

export function registerLoopbackSecurity(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    if (!request.headers.host || !trustedUrl(request.headers.host, false)) {
      return reply.code(403).send({ error: 'Untrusted Host header' });
    }
    const origin = request.headers.origin;
    if (origin && !trustedUrl(origin, true)) {
      return reply.code(403).send({ error: 'Untrusted Origin header' });
    }
  });
}
