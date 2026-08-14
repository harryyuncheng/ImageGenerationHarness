import { Eraser, Paintbrush, Scaling, Sparkles, type LucideIcon } from 'lucide-react';
import type { Capability } from '../../shared/types/domain.js';
import { hasParameter } from './capabilities.js';

export const categoryMeta: Record<Capability['category'], { label: string; Icon: LucideIcon }> = {
  generation: { label: 'Generate', Icon: Sparkles },
  control: { label: 'Control & style', Icon: Paintbrush },
  upscale: { label: 'Upscale', Icon: Scaling },
  edit: { label: 'Edit', Icon: Eraser },
};

export const modelCategories = ['generation', 'control', 'upscale', 'edit'] as const;

export function shortModelName(name: string): string {
  return name.replace('Stable Diffusion', 'SD').replace('Stable Image', 'Stable');
}

export function modelPromptSummary(capability: Capability): string {
  if (capability.modes.includes('image-to-image')) return 'Text or image prompt';
  if (capability.modes.includes('text-to-image')) return 'Text prompt';
  return 'Source image required';
}

export function attachmentRole(capability: Capability, index: number): string {
  if (index === 0) {
    return capability.canonicalId === 'service/style-transfer' ? 'Content' : 'Source';
  }
  if (index === 1 && capability.canonicalId === 'service/style-transfer') return 'Style reference';
  if (index === 1 && hasParameter(capability, 'mask')) return 'Mask';
  return `Reference ${String(index)}`;
}
