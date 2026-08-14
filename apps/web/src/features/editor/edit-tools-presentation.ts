import {
  Eraser,
  Image as ImageIcon,
  Paintbrush,
  Pencil,
  Scaling,
  Search,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from '../../shared/types/domain.js';
import type { RunStatus } from '../history/run-presentation.js';

export function editorProgressMessage(status: RunStatus, hasImage: boolean): string {
  if (hasImage) return 'Loading image…';
  if (status === 'submitting') return 'Submitting request…';
  if (status === 'queued') return 'Waiting for the local worker…';
  if (status === 'running') return 'Creating your image…';
  if (status === 'completed') return 'Finalizing the saved image…';
  if (status === 'cancelled') return 'This run was cancelled.';
  if (status === 'interrupted') return 'The server stopped during this run.';
  return 'Generation failed.';
}

export function editToolDescription(capability: Capability): string {
  switch (capability.canonicalId) {
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
    default:
      return 'Edit this image with Stability on Bedrock.';
  }
}

export function editToolIcon(capability: Capability): LucideIcon {
  switch (capability.canonicalId) {
    case 'service/inpaint':
      return Paintbrush;
    case 'service/outpaint':
      return Scaling;
    case 'service/search-recolor':
      return Search;
    case 'service/search-replace':
      return WandSparkles;
    case 'service/erase':
      return Eraser;
    case 'service/remove-background':
      return ImageIcon;
    default:
      return Pencil;
  }
}
