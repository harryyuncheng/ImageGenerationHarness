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
import type { ImageInputs } from '../../shared/types/attachments.js';
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
      icon: Expand,
      min: 0,
      max: 20,
      step: 1,
    });
  }
  return ranges;
}

export function mainSourceImage(inputs: ImageInputs) {
  // Only a guide source with an existing mask needs a duplicate preview on the canvas.
  return inputs.source?.source !== 'style-guide' || inputs.mask !== undefined
    ? inputs.source
    : undefined;
}
