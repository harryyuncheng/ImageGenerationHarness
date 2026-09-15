import { capabilityCatalog, providerCatalog } from '@harness/capabilities/catalog';
import type { RequestParameter } from '@harness/contracts';
import type { ImageInputRole } from '../../shared/types/attachments.js';
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
      return 'Fast, text-only generation for everyday images.';
    case 'generation/ultra':
      return 'Fine-detail images from text or a starting image.';
    case 'generation/sd3.5-large':
      return 'Detailed prompts and image guidance, with WebP output.';
    case 'generation/gpt-image-2':
      return 'Create new images from text and up to 16 references.';
    case 'edit/gpt-image-2':
      return 'Edit a source with up to 15 references and an optional mask.';
    case 'service/control-sketch':
      return 'Render sketches while preserving their outlines.';
    case 'service/control-structure':
      return 'Restyle images while keeping their layout and shapes.';
    case 'service/style-guide':
      return "Create new scenes using one image's style.";
    case 'service/style-transfer':
      return "Restyle one image using a second image's style.";
    case 'service/creative-upscale':
      return 'Upscale to 4K and reimagine fine detail.';
    case 'service/conservative-upscale':
      return 'Upscale to 4K, preserving the original look.';
    case 'service/fast-upscale':
      return 'Quick 4x enlargement; no prompt or creative controls.';
    case 'service/inpaint':
      return 'Fill masked areas with new, prompted content.';
    case 'service/outpaint':
      return 'Grow the canvas with newly generated edges.';
    case 'service/search-recolor':
      return 'Recolor a named object without replacing it.';
    case 'service/search-replace':
      return 'Replace a named object; no drawn mask needed.';
    case 'service/erase':
      return 'Remove masked objects and fill the gaps.';
    case 'service/remove-background':
      return 'Cut out the subject automatically; no mask needed.';
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

export function imageInputRoles(capability: Capability): readonly ImageInputRole[] {
  if (!hasParameter(capability, 'image') && !hasParameter(capability, 'init_image')) return [];
  if (capability.maxInputImages !== undefined && capability.category === 'generation') {
    return ['references'];
  }
  const roles: ImageInputRole[] = ['source'];
  if (hasParameter(capability, 'style_image') || capability.maxInputImages !== undefined) {
    roles.push('references');
  }
  if (hasParameter(capability, 'mask')) roles.push('mask');
  return roles;
}

/** Targets take either a named ratio or explicit pixel dimensions, but share one shape picker. */
export function supportsImageShape(capability: Capability): boolean {
  return hasParameter(capability, 'aspect_ratio') || hasParameter(capability, 'size');
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
  const maximum = maximumSeed(capability);
  if (maximum === undefined) return 0;
  // Stability treats zero as provider randomness, not a reproducible seed.
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(Math.trunc(value), maximum));
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
