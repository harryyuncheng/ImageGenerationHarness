import { CAPABILITY_REGISTRY_VERSION, capabilityCatalog } from '@harness/capabilities/catalog';
import { capabilitiesResponseSchema } from '@harness/contracts';
import type { FastifyInstance } from 'fastify';

export function registerCapabilityRoutes(app: FastifyInstance): void {
  app.get('/api/health', () => ({
    ok: true,
    registryVersion: CAPABILITY_REGISTRY_VERSION,
  }));
  app.get('/api/capabilities', () =>
    capabilitiesResponseSchema.parse({
      registryVersion: CAPABILITY_REGISTRY_VERSION,
      targets: capabilityCatalog,
    }),
  );
}
