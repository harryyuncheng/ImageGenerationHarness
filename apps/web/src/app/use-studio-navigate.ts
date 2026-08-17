import { useNavigate } from '@tanstack/react-router';
import type { GalleryImage } from '../shared/types/domain.js';

/** Overlay parameters are dropped on view changes so a page is never entered focused. */
const clearedFocus = { image: undefined, mode: undefined, run: undefined };

/**
 * The single place that turns a studio intent into a URL change. Feature hooks call
 * these directly instead of receiving navigation callbacks from the composition root.
 */
export function useStudioNavigate() {
  const navigate = useNavigate();

  return {
    goToCreate: () => {
      void navigate({ to: '/', search: clearedFocus });
    },
    goToEdit: () => {
      void navigate({ to: '/edit', search: clearedFocus });
    },
    goToReferences: () => {
      void navigate({ to: '/references', search: clearedFocus });
    },
    goToPresets: () => {
      void navigate({ to: '/presets', search: clearedFocus });
    },
    goToHistory: () => {
      void navigate({ to: '/gallery/history', search: clearedFocus });
    },
    goToProjects: () => {
      void navigate({ to: '/gallery/projects', search: clearedFocus });
    },
    openProject: (projectId: string) => {
      void navigate({
        to: '/gallery/projects/$projectId',
        params: { projectId },
        search: clearedFocus,
      });
    },
    openImage: (image: GalleryImage, intent: 'view' | 'edit' = 'view') => {
      void navigate({
        to: '.',
        search: (previous) => ({
          ...previous,
          image: image.imageId,
          mode: intent,
          run: undefined,
        }),
      });
    },
    openRun: (runId: string) => {
      void navigate({
        to: '.',
        search: (previous) => ({ ...previous, run: runId, image: undefined, mode: undefined }),
      });
    },
    /** Replaces so the pre-submission local identifier never becomes a history entry. */
    readdressRun: (runId: string) => {
      void navigate({
        to: '.',
        replace: true,
        search: (previous) => ({ ...previous, run: runId }),
      });
    },
    closeFocus: () => {
      void navigate({ to: '.', search: (previous) => ({ ...previous, ...clearedFocus }) });
    },
    openMetadata: (imageId: string) => {
      void navigate({ to: '.', search: (previous) => ({ ...previous, metadata: imageId }) });
    },
    closeMetadata: () => {
      void navigate({ to: '.', search: (previous) => ({ ...previous, metadata: undefined }) });
    },
  };
}
