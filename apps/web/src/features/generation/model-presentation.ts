import type { Capability } from '../../shared/types/domain.js';
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

export function toolbarToolLabel(capability: Capability): string {
  if (capability.canonicalId === 'generation/core') return 'Core';
  if (capability.canonicalId === 'generation/ultra') return 'Ultra';
  if (capability.canonicalId === 'generation/sd3.5-large') return '3.5 Large';
  return capability.name;
}

export function attachmentRole(capability: Capability, index: number): string {
  if (index === 0) {
    return capability.canonicalId === 'service/style-transfer' ? 'Content' : 'Source';
  }
  if (index === 1 && capability.canonicalId === 'service/style-transfer') return 'Style reference';
  if (index === 1 && hasParameter(capability, 'mask')) return 'Mask';
  return `Reference ${String(index)}`;
}
