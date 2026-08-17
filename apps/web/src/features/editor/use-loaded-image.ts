import { useEffect, useState } from 'react';
import { generatedImageContentUrl, imageFileExtension } from '../../shared/images/files.js';
import type { GalleryImage } from '../../shared/types/domain.js';
import { useImages } from '../gallery/use-images.js';
import type { RunStatus, StudioRun } from '../history/run-presentation.js';

export interface LoadedImage {
  prompt: string;
  status: RunStatus;
  error?: string;
  requestedOutputCount: number;
  outputCount: number;
  selectedIndex: number;
  selectedOutput?: { url: string; name: string };
  /**
   * Present while the run still has work the server can drop. Cancelling removes
   * queued jobs; an active Bedrock call cannot be reliably interrupted.
   */
  cancel?: () => void;
  showOutput: (index: number) => void;
}

interface LoadedImageOptions {
  activeRepositoryId: string | undefined;
  imageId: string | undefined;
  runId: string | undefined;
  runs: readonly StudioRun[];
  onLoadImage: (image: GalleryImage) => void;
  onLoadRun: (run: StudioRun) => void;
  onCancelRun: (run: StudioRun) => void;
}

/**
 * Resolves the addressed image or run against live data, so a link that no longer
 * resolves loads nothing instead of failing. Whatever is loaded also restores the
 * draft that produced it, which makes an address behave exactly like a gallery click
 * and makes viewing and remixing the same gesture.
 */
export function useLoadedImage(options: LoadedImageOptions): LoadedImage | undefined {
  const { activeRepositoryId, imageId, runId, runs, onLoadImage, onLoadRun, onCancelRun } = options;
  const imagesQuery = useImages(activeRepositoryId, imageId !== undefined || runId !== undefined);
  const [selection, setSelection] = useState({ key: '', index: 0 });

  const images = imagesQuery.data?.images ?? [];
  const image = images.find((candidate) => candidate.imageId === imageId);
  const run =
    runId === undefined
      ? undefined
      : runs.find((candidate) => candidate.id === runId || candidate.remoteId === runId);
  const loadedImageId = image?.imageId;
  const loadedRunId = run === undefined ? undefined : (run.remoteId ?? run.id);

  useEffect(() => {
    if (image) onLoadImage(image);
    else if (run) onLoadRun(run);
  }, [loadedImageId, loadedRunId]);

  const view = image
    ? {
        prompt: image.prompt ?? '',
        status: 'completed' as RunStatus,
        requestedOutputCount: 1,
        outputImageIds: [image.imageId],
      }
    : run
      ? {
          prompt: run.prompt,
          status: run.status,
          requestedOutputCount: run.outputCount,
          ...(run.error === undefined ? {} : { error: run.error }),
          outputImageIds: run.outputImageIds ?? [],
        }
      : undefined;
  if (!view) return undefined;

  const { outputImageIds, ...common } = view;
  const key = image?.imageId ?? loadedRunId ?? '';
  const selectedIndex = Math.min(
    selection.key === key ? selection.index : 0,
    Math.max(outputImageIds.length - 1, 0),
  );
  const selectedImageId = outputImageIds[selectedIndex];
  const mediaType =
    images.find((candidate) => candidate.imageId === selectedImageId)?.mediaType ?? 'image/png';
  const cancellable = run?.status === 'queued' || run?.status === 'running';

  return {
    ...common,
    outputCount: outputImageIds.length,
    selectedIndex,
    ...(selectedImageId === undefined
      ? {}
      : {
          selectedOutput: {
            url: generatedImageContentUrl(selectedImageId),
            name: `${selectedImageId}.${imageFileExtension(mediaType)}`,
          },
        }),
    ...(cancellable
      ? {
          cancel: () => {
            onCancelRun(run);
          },
        }
      : {}),
    showOutput: (index: number) => {
      setSelection({ key, index });
    },
  };
}
