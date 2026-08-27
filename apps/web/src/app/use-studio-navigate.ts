import { useNavigate } from '@tanstack/react-router';
import type { GalleryImage } from '../shared/types/domain.js';

/** Overlay parameters are dropped on view changes so a page is never entered focused. */
const clearedFocus = { image: undefined, run: undefined };

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
    goToStyleGuide: () => {
      void navigate({ to: '/style-guide', search: clearedFocus });
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
    /** Loading is always into the main area, so opening leaves the library behind. */
    openImage: (image: GalleryImage) => {
      void navigate({ to: '/', search: { ...clearedFocus, image: image.imageId } });
    },
    openRun: (runId: string) => {
      void navigate({ to: '/', search: { ...clearedFocus, run: runId } });
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
  };
}
