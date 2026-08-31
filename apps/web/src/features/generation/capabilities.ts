import { capabilityCatalog, providerCatalog } from '@harness/capabilities/catalog';
import type { ProviderId, RequestParameter } from '@harness/contracts';
import type { Capability, ProviderDescriptor } from '../../shared/types/domain.js';

export const defaultCapabilities: readonly Capability[] = capabilityCatalog;
export const defaultProviders: readonly ProviderDescriptor[] = providerCatalog.map((provider) => ({
  ...provider,
  configured: false,
}));

export function capabilityLabel(capability: Capability): string {
  return capability.name;
}

export function capabilityDescription(capability: Capability): string {
  switch (capability.canonicalId) {
    case 'generation/core':
      return 'Create an image from text with a fast, general-purpose model.';
    case 'generation/ultra':
      return 'Create a high-quality image from text or a source image.';
    case 'generation/sd3.5-large':
      return 'Follow detailed prompts with optional source-image guidance.';
    case 'generation/gpt-image-2':
      return 'Create a high-resolution image from text, with strong prompt following.';
    case 'edit/gpt-image-2':
      return 'Edit an image from a description, optionally limited to a masked area.';
    case 'service/control-sketch':
      return 'Turn a sketch into a finished image while preserving its lines.';
    case 'service/control-structure':
      return 'Restyle an image while preserving its layout and structure.';
    case 'service/style-guide':
      return 'Create new content guided by the look of a source image.';
    case 'service/style-transfer':
      return "Apply one image's style to another image's composition.";
    case 'service/creative-upscale':
      return 'Upscale to 4K while adding and reimagining detail.';
    case 'service/conservative-upscale':
      return 'Upscale to 4K while preserving the original image.';
    case 'service/fast-upscale':
      return 'Quickly increase resolution by 4x with minimal changes.';
    case 'service/inpaint':
      return 'Paint new content into a selected area.';
    case 'service/outpaint':
      return 'Extend the image beyond its current frame.';
    case 'service/search-recolor':
      return 'Find an object and change its color.';
    case 'service/search-replace':
      return 'Find an object and replace it with something new.';
    case 'service/erase':
      return 'Remove a selected object or region.';
    case 'service/remove-background':
      return 'Isolate the subject on a transparent background.';
    default: {
      const provider = providerCatalog.find((entry) => entry.providerId === capability.providerId);
      return `Use ${capability.name}${provider ? ` on ${provider.name}` : ''}.`;
    }
  }
}

export function needsImage(capability: Capability): boolean {
  return capability.modes.includes('image-service');
}

export function hasParameter(capability: Capability, parameter: RequestParameter): boolean {
  return capability.parameters.includes(parameter);
}

/** Targets take either a named ratio or explicit pixel dimensions, but share one shape picker. */
export function supportsImageShape(capability: Capability): boolean {
  return hasParameter(capability, 'aspect_ratio') || hasParameter(capability, 'size');
}

export function capabilitiesForProvider(
  capabilities: readonly Capability[],
  providerId: ProviderId,
): readonly Capability[] {
  return capabilities.filter((capability) => capability.providerId === providerId);
}

/** The target a provider opens on, preferring text-to-image over its editing tools. */
export function defaultTargetForProvider(
  capabilities: readonly Capability[],
  providerId: ProviderId,
): Capability | undefined {
  const owned = capabilitiesForProvider(capabilities, providerId);
  return owned.find((capability) => capability.category === 'generation') ?? owned.at(0);
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
