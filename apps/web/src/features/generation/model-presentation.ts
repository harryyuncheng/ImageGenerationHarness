import {
  Blend,
  Expand,
  Focus,
  LayoutTemplate,
  Palette,
  Sparkles,
  Spline,
  Wand,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from '../../shared/types/domain.js';
import type { ImageInputRole, ImageInputs } from '../../shared/types/attachments.js';
import { hasParameter } from './capabilities.js';

export const toolbarTabs = [
  { id: 'create', label: 'Create', category: 'generation' },
  { id: 'style', label: 'Style', category: 'control' },
  { id: 'edit', label: 'Edit', category: 'edit' },
  { id: 'export', label: 'Export', category: 'upscale' },
] as const satisfies readonly {
  id: string;
  label: string;
  category: Capability['category'];
}[];

type RangeSettingKey =
  | 'changeStrength'
  | 'compositionFidelity'
  | 'controlStrength'
  | 'creativity'
  | 'fidelity'
  | 'growMask'
  | 'strength'
  | 'styleStrength';

interface ToolbarRangeSetting {
  key: RangeSettingKey;
  label: string;
  description: string;
  icon: LucideIcon;
  min: number;
  max: number;
  step: number;
}

/** Continuous controls the capability accepts, in the order their chips appear in the toolbar. */
export function toolbarRangeSettings(capability: Capability): readonly ToolbarRangeSetting[] {
  const ranges: ToolbarRangeSetting[] = [];
  if (hasParameter(capability, 'strength')) {
    ranges.push({
      key: 'strength',
      label: 'Image strength',
      description: 'How far results may move from a source image',
      icon: Blend,
      min: 0,
      max: 1,
      step: 0.05,
    });
  }
  if (hasParameter(capability, 'control_strength')) {
    ranges.push({
      key: 'controlStrength',
      label: 'Control strength',
      description: 'How strongly the source image guides the result',
      icon: Spline,
      min: 0,
      max: 1,
      step: 0.05,
    });
  }
  if (hasParameter(capability, 'fidelity')) {
    ranges.push({
      key: 'fidelity',
      label: 'Style fidelity',
      description: 'How closely results match the reference style',
      icon: Focus,
      min: 0,
      max: 1,
      step: 0.05,
    });
  }
  if (hasParameter(capability, 'composition_fidelity')) {
    ranges.push({
      key: 'compositionFidelity',
      label: 'Composition fidelity',
      description: 'How closely results keep the content image layout',
      icon: LayoutTemplate,
      min: 0,
      max: 1,
      step: 0.05,
    });
  }
  if (hasParameter(capability, 'style_strength')) {
    ranges.push({
      key: 'styleStrength',
      label: 'Style strength',
      description: 'How strongly the style reference is applied',
      icon: Palette,
      min: 0,
      max: 1,
      step: 0.05,
    });
  }
  if (hasParameter(capability, 'change_strength')) {
    ranges.push({
      key: 'changeStrength',
      label: 'Change strength',
      description: 'How far results may depart from the content image',
      icon: Wand,
      min: 0.1,
      max: 1,
      step: 0.05,
    });
  }
  if (hasParameter(capability, 'creativity')) {
    ranges.push({
      key: 'creativity',
      label: 'Creativity',
      description: 'How much new detail the model may invent',
      icon: Sparkles,
      min: 0.1,
      max: capability.category === 'upscale' ? 0.5 : 1,
      step: 0.05,
    });
  }
  if (hasParameter(capability, 'grow_mask')) {
    ranges.push({
      key: 'growMask',
      label: 'Mask growth (px)',
      description: 'Expand the edited area beyond the mask',
      icon: Expand,
      min: 0,
      max: 20,
      step: 1,
    });
  }
  return ranges;
}

export function inputRoleLabel(capability: Capability, role: ImageInputRole): string {
  if (role === 'source') {
    return capability.canonicalId === 'service/style-transfer' ? 'Content' : 'Source';
  }
  if (role === 'references') {
    return capability.maxInputImages === undefined ? 'Style reference' : 'References';
  }
  return 'Mask';
}

export function mainImageInputs(inputs: ImageInputs) {
  // Keep an existing mask's source on the canvas; reference-only guides stay in the left stack.
  return [
    ...(inputs.source ? [{ role: 'source' as const, image: inputs.source }] : []),
    ...inputs.references.map((image) => ({ role: 'references' as const, image })),
  ].filter(
    ({ role, image }) =>
      image.source !== 'style-guide' || (role === 'source' && inputs.mask !== undefined),
  );
}
