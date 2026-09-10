import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouter, type NavigateOptions } from '@tanstack/react-router';
import { flushSync } from 'react-dom';
import { getImages } from '../features/gallery/api.js';
import { getRepository } from '../features/repository/api.js';
import { queryKeys } from '../shared/api/query-keys.js';
import type { StudioImage } from '../shared/images/studio-image.js';
import type { RepositoryStatus } from '../shared/types/domain.js';
import { connectSheetImage, sheetTransitionTypes } from './sheet-transition.js';

const clearedFocus = { image: undefined, run: undefined, output: undefined };
let activeTransition: ViewTransition | undefined;

/**
 * The single place that turns a studio intent into a URL change. Feature hooks call
 * these directly instead of receiving navigation callbacks from the composition root.
 */
export function useStudioNavigate() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function go(options: NavigateOptions) {
    const location = router.buildLocation(options);
    if (location.pathname.startsWith('/gallery')) {
      if (!queryClient.getQueryData<RepositoryStatus>(queryKeys.repository())) {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.repository(),
          queryFn: getRepository,
        });
      }
      const repositoryId = queryClient.getQueryData<RepositoryStatus>(queryKeys.repository())
        ?.active?.repositoryId;
      if (repositoryId) {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.allImages(repositoryId),
          queryFn: getImages,
        });
      }
    }
    const types = sheetTransitionTypes({
      fromLocation: router.state.location,
      toLocation: location,
    });
    if (!types || typeof document.startViewTransition !== 'function') {
      await navigate(options);
      return;
    }

    document.documentElement.dataset['sheetTransition'] = types[0];
    const transition = document.startViewTransition(async () => {
      await navigate({ ...options, viewTransition: false });
      const frames = [...document.querySelectorAll<HTMLElement>('.canvas .image-frame')].filter(
        (frame) => {
          const bounds = frame.getBoundingClientRect();
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.bottom > 0 &&
            bounds.top < window.innerHeight &&
            bounds.right > 0 &&
            bounds.left < window.innerWidth
          );
        },
      );
      const images = frames.flatMap((frame) => [...frame.querySelectorAll('img')]);
      // Resolve available pixels before capturing the same frame used while they are pending.
      await Promise.all(
        images.map(async (image) => {
          image.loading = 'eager';
          try {
            await image.decode();
          } catch (error) {
            if (!(error instanceof DOMException) || error.name !== 'EncodingError') throw error;
            if (image.isConnected) image.dispatchEvent(new Event('error'));
          }
        }),
      );
      flushSync(() => {
        // Commit image load handlers before the browser takes its target snapshot.
      });
      for (const frame of frames) {
        connectSheetImage(frame, location.pathname.startsWith('/gallery') ? 'gallery' : 'canvas');
      }
    });
    activeTransition = transition;
    try {
      await transition.finished;
    } finally {
      if (activeTransition === transition) {
        activeTransition = undefined;
        delete document.documentElement.dataset['sheetTransition'];
      }
    }
  }

  return {
    goToCreate: () => {
      void go({ to: '/', search: clearedFocus });
    },
    returnToCanvas: () => {
      void go({ to: '/', search: (previous) => previous });
    },
    goToStyleGuide: () => {
      void navigate({ to: '/style-guide', search: clearedFocus });
    },
    goToPresets: () => {
      void navigate({ to: '/presets', search: (previous) => previous });
    },
    goToHistory: () => {
      void go({ to: '/gallery/history', search: (previous) => previous });
    },
    /** Loading is always into the main area, so opening leaves the library behind. */
    openImage: (image: StudioImage) => {
      void go({
        to: '/',
        search: {
          ...clearedFocus,
          ...(image.saved
            ? { image: image.saved.imageId }
            : { run: image.runId, output: image.outputIndex }),
        },
      });
    },
    openRun: (runId: string, outputIndex?: number) => {
      void go({ to: '/', search: { ...clearedFocus, run: runId, output: outputIndex } });
    },
    /** Replaces so the pre-submission local identifier never becomes a history entry. */
    readdressRun: (localId: string, runId: string) => {
      void navigate({
        to: '.',
        replace: true,
        search: (previous) => (previous.run === localId ? { ...previous, run: runId } : previous),
      });
    },
    closeFocus: () => {
      void navigate({ to: '.', search: (previous) => ({ ...previous, ...clearedFocus }) });
    },
  };
}
