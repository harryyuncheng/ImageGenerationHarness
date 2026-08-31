import type { Capability } from '@harness/capabilities';
import type { ProviderId } from '@harness/contracts';

export interface ProviderImage {
  base64: string;
  seed: number | null;
  finishReason: string | null;
}

export interface ProviderInvocation {
  /** The model, inference profile, or deployment that actually served the request. */
  invocationId: string;
  images: readonly ProviderImage[];
  requestId?: string;
  metadata: Record<string, string | number | boolean | null>;
}

/**
 * Each provider owns its own wire format: it builds the request payload, validates the
 * response, and raises provider-side filtering or refusal as an error. Callers receive
 * only decoded image data and non-secret provenance.
 */
export interface ImageProvider {
  readonly configured: boolean;
  invoke(capability: Capability, request: Record<string, unknown>): Promise<ProviderInvocation>;
}

export type ImageProviders = Readonly<Record<ProviderId, ImageProvider>>;
