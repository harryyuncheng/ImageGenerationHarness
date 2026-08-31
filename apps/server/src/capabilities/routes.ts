import {
  CAPABILITY_REGISTRY_VERSION,
  capabilityCatalog,
  providerCatalog,
} from '@harness/capabilities/catalog';
import { capabilitiesResponseSchema } from '@harness/contracts';
import type { FastifyInstance } from 'fastify';
import type { RunService } from '../runs/run-types.js';

export function registerCapabilityRoutes(
  app: FastifyInstance,
  runService: RunService | null,
): void {
  app.get('/api/health', () => ({
    ok: true,
    registryVersion: CAPABILITY_REGISTRY_VERSION,
  }));
  app.get('/api/capabilities', () =>
    capabilitiesResponseSchema.parse({
      registryVersion: CAPABILITY_REGISTRY_VERSION,
      providers: providerCatalog.map((provider) => ({
        ...provider,
        configured: runService?.isProviderConfigured(provider.providerId) ?? false,
      })),
      targets: capabilityCatalog,
    }),
  );
}
