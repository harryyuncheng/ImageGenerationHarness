import { CAPABILITY_REGISTRY_VERSION } from '@harness/capabilities/catalog';
import { capabilitiesResponseSchema, queuedRunResponseSchema } from '@harness/contracts';
import type { CreateRunRequest } from '@harness/contracts';
import { jsonBody, requestJson } from '../../shared/api/http.js';
import type { CapabilitiesResponse } from '../../shared/types/domain.js';

export async function getCapabilities(): Promise<CapabilitiesResponse> {
  const response = await requestJson(
    '/api/capabilities',
    capabilitiesResponseSchema,
    {},
    'Capability registry unavailable',
  );
  if (response.registryVersion !== CAPABILITY_REGISTRY_VERSION) {
    throw new Error('The browser and server capability registries do not match.');
  }
  return response;
}

export function queueRun(submission: CreateRunRequest) {
  return requestJson(
    '/api/runs',
    queuedRunResponseSchema,
    { method: 'POST', ...jsonBody(submission) },
    'The local control plane could not queue this run.',
  );
}
