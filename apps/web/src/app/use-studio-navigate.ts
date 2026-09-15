import type { QueuedRunResponse } from '@harness/contracts';
import { useNavigate } from '@tanstack/react-router';
import type { StudioImage } from '../shared/images/studio-image.js';

const clearedFocus = { image: undefined, run: undefined, job: undefined, output: undefined };

/**
 * The single place that turns a studio intent into a URL change. Feature hooks call
 * these directly instead of receiving navigation callbacks from the composition root.
 */
export function useStudioNavigate() {
  const navigate = useNavigate();

  function openRun(runId: string, output?: StudioImage) {
    void navigate({
      to: '/',
      state: (previous) => ({ ...previous, generationSetupKey: crypto.randomUUID() }),
      search: {
        ...clearedFocus,
        run: runId,
        job: output?.jobId,
        output: output?.jobId === undefined ? output?.outputIndex : output.jobOutputIndex,
      },
    });
  }

  return {
    returnToCanvas: () => {
      void navigate({ to: '/', search: (previous) => previous, state: (previous) => previous });
    },
    goToStyleGuide: () => {
      void navigate({
        to: '/style-guide',
        search: (previous) => previous,
        state: (previous) => previous,
      });
    },
    goToPresets: () => {
      void navigate({
        to: '/presets',
        search: (previous) => previous,
        state: (previous) => previous,
      });
    },
    goToGallery: () => {
      void navigate({
        to: '/gallery',
        search: (previous) => previous,
        state: (previous) => previous,
      });
    },
    /** Loading is always into the main area, so opening leaves the library behind. */
    openImage: (image: StudioImage) => {
      if (image.saved) {
        void navigate({
          to: '/',
          search: { ...clearedFocus, image: image.saved.imageId },
          state: (previous) => ({ ...previous, generationSetupKey: crypto.randomUUID() }),
        });
      } else {
        openRun(image.runId, image);
      }
    },
    openRun,
    /** Replace temporary run/output identities without leaving the current view. */
    readdressRun: (
      localId: string,
      next:
        | Pick<QueuedRunResponse, 'runId' | 'jobs'>
        | Pick<StudioImage, 'runId' | 'jobId' | 'jobOutputIndex' | 'outputIndex'>
        | undefined,
    ) => {
      void navigate({
        to: '.',
        replace: true,
        viewTransition: false,
        state: (previous) => previous,
        search: (previous) => {
          if (previous.run !== localId) return previous;
          if (!next) return { ...previous, ...clearedFocus };
          if (
            !('jobs' in next) &&
            previous.job === undefined &&
            (previous.output ?? 0) !== next.outputIndex
          )
            return previous;
          const output = previous.job
            ? { job: previous.job, output: previous.output }
            : 'jobs' in next
              ? next.jobs.flatMap((job) =>
                  Array.from({ length: job.requestedOutputCount }, (_, index) => ({
                    job: job.jobId,
                    output: index,
                  })),
                )[previous.output ?? 0]
              : { job: next.jobId, output: next.jobOutputIndex };
          return { ...previous, run: next.runId, job: output?.job, output: output?.output };
        },
      });
    },
    closeFocus: () => {
      void navigate({ to: '.', search: (previous) => ({ ...previous, ...clearedFocus }) });
    },
  };
}
