import { capabilityCatalog } from '@harness/capabilities/catalog';
import type { RequestParameter } from '@harness/contracts';
import type { Capability } from '../../shared/types/domain.js';
import type { GenerationSettings } from './settings.js';

export const defaultCapabilities: readonly Capability[] = capabilityCatalog;

export function capabilityLabel(capability: Capability): string {
  return capability.name;
}

export function needsImage(capability: Capability): boolean {
  return capability.modes.includes('image-service');
}

export function hasParameter(capability: Capability, parameter: RequestParameter): boolean {
  return capability.parameters.includes(parameter);
}

export function supportsPrompt(capability: Capability): boolean {
  return hasParameter(capability, 'prompt');
}

export function requiresPrompt(capability: Capability): boolean {
  return (
    supportsPrompt(capability) &&
    !['service/style-transfer', 'service/outpaint'].includes(capability.canonicalId)
  );
}

export function supportedOutputFormats(
  capability: Capability,
): readonly GenerationSettings['outputFormat'][] {
  return capability.outputFormats;
}

export function maximumSeed(capability: Capability): number | undefined {
  return capability.seedMaximum;
}

export function effectiveSeed(capability: Capability, value: number): number {
  const maximum = maximumSeed(capability) ?? 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.trunc(value), maximum));
}

/** Falls back to the first known capability so an empty server registry can never crash the studio. */
export function resolveCapability(
  capabilities: readonly Capability[],
  targetId: string,
): Capability {
  const capability =
    capabilities.find((candidate) => candidate.canonicalId === targetId) ??
    capabilities.at(0) ??
    defaultCapabilities.at(0);
  if (!capability) throw new Error('The capability registry is empty');
  return capability;
}
