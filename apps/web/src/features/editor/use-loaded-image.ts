import { useLayoutEffect } from 'react';
import { useStudioNavigate } from '../../app/use-studio-navigate.js';
import { generatedImageContentUrl, imageFileExtension } from '../../shared/images/files.js';
import { toStudioImages, type StudioImage } from '../../shared/images/studio-image.js';
import type { GalleryImage } from '../../shared/types/domain.js';
import { useImages } from '../gallery/use-images.js';
import type { RunStatus, StudioRun } from '../history/run-presentation.js';

export interface LoadedImage {
  prompt: string;
  status: RunStatus;
  aspectRatio?: number;
  isPending: boolean;
  error?: string;
  requestedOutputCount: number;
  outputCount: number;
  selectedIndex: number;
  image: StudioImage | undefined;
  selectedOutput?: {
    imageId: string;
    url: string;
    name: string;
    mediaType: GalleryImage['mediaType'];
    byteLength: number;
  };
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
  outputIndex: number | undefined;
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
  const {
    activeRepositoryId,
    imageId,
    runId,
    outputIndex,
    runs,
    onLoadImage,
    onLoadRun,
    onCancelRun,
  } = options;
  const navigate = useStudioNavigate();
  const imagesQuery = useImages(activeRepositoryId, imageId !== undefined || runId !== undefined);

  const images = imagesQuery.data?.images ?? [];
  const studioImages = toStudioImages(images, runs, imagesQuery.dataUpdatedAt);
  const image = studioImages.find(
    (candidate) => candidate.saved?.imageId === imageId && imageId !== undefined,
  );
  const run =
    runId === undefined
      ? undefined
      : runs.find((candidate) => candidate.id === runId || candidate.remoteId === runId);
  const loadedImageId = image?.saved?.imageId;
  const loadedRunId = run === undefined ? undefined : (run.remoteId ?? run.id);

  useLayoutEffect(() => {
    if (image?.saved) onLoadImage(image.saved);
    else if (run) onLoadRun(run);
  }, [loadedImageId, loadedRunId]);

  if (!image && !run) return undefined;

  const outputs = image
    ? [image]
    : studioImages
        .filter((candidate) => candidate.runId === loadedRunId)
        .sort((left, right) => left.outputIndex - right.outputIndex);
  const selectedIndex = Math.max(
    0,
    outputs.findIndex((output) => output.outputIndex === (outputIndex ?? 0)),
  );
  const selectedImage = outputs[selectedIndex];
  const saved = selectedImage?.saved;
  const aspectRatio = selectedImage?.aspectRatio ?? run?.aspectRatio;
  const cancellable = run?.status === 'queued' || run?.status === 'running';

  return {
    prompt: image?.saved?.prompt ?? run?.prompt ?? '',
    status: image?.status ?? run?.status ?? 'completed',
    ...(aspectRatio === undefined ? {} : { aspectRatio }),
    ...(run?.error === undefined ? {} : { error: run.error }),
    requestedOutputCount: run?.outputCount ?? 1,
    isPending: selectedImage !== undefined && saved === undefined,
    outputCount: outputs.length,
    selectedIndex,
    image: selectedImage,
    ...(saved === undefined
      ? {}
      : {
          selectedOutput: {
            imageId: saved.imageId,
            url: generatedImageContentUrl(saved.imageId),
            name: `${saved.imageId}.${imageFileExtension(saved.mediaType)}`,
            mediaType: saved.mediaType,
            byteLength: saved.byteLength,
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
      const output = outputs[index];
      if (!output) throw new Error('Requested image is no longer available.');
      navigate.openRun(output.runId, output.outputIndex);
    },
  };
}
