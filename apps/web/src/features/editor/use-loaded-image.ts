import type { GenerationSetup, GenerationSetupSource } from '@harness/contracts';
import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useLayoutEffect, useRef } from 'react';
import { useStudioNavigate } from '../../app/use-studio-navigate.js';
import { generatedImageContentUrl, imageFileExtension } from '../../shared/images/files.js';
import { toStudioImages, type StudioImage } from '../../shared/images/studio-image.js';
import type { GalleryImage } from '../../shared/types/domain.js';
import { useImages } from '../gallery/use-images.js';
import type { RunStatus, StudioRun } from '../history/run-presentation.js';
import { generationSetupOptions } from './api.js';

export interface LoadedImage {
  prompt: string;
  status: RunStatus;
  aspectRatio?: number;
  isPending: boolean;
  isRestoringSetup: boolean;
  setupBlockedReason: string | undefined;
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
  jobId: string | undefined;
  outputIndex: number | undefined;
  runs: readonly StudioRun[];
  runsLoading: boolean;
  shouldRestoreRun: (run: StudioRun) => boolean;
  onLoadSetup: (setup: GenerationSetup, source: GenerationSetupSource) => void;
  onCancelRun: (run: StudioRun) => void;
}

/**
 * Restore once per opened setup, not per poll. An in-flight submission keeps ownership
 * of its draft until another image is explicitly opened.
 */
export function useLoadedImage(options: LoadedImageOptions): LoadedImage | undefined {
  const {
    activeRepositoryId,
    imageId,
    runId,
    jobId,
    outputIndex,
    runs,
    shouldRestoreRun,
    onLoadSetup,
    onCancelRun,
  } = options;
  const navigate = useStudioNavigate();
  const historyState = useRouterState({ select: (state) => state.resolvedLocation?.state });
  const setupKey =
    historyState &&
    'generationSetupKey' in historyState &&
    typeof historyState.generationSetupKey === 'string'
      ? historyState.generationSetupKey
      : '';
  const restored = useRef<string | undefined>(undefined);
  const hasFocus = imageId !== undefined || runId !== undefined;
  const imagesQuery = useImages(activeRepositoryId, hasFocus);

  const images = imagesQuery.data?.images ?? [];
  const studioImages = toStudioImages(images, runs, imagesQuery.data?.requestedAt ?? 0);
  const image = studioImages.find(
    (candidate) => candidate.saved?.imageId === imageId && imageId !== undefined,
  );
  const run =
    runId === undefined
      ? undefined
      : runs.find((candidate) => candidate.id === runId || candidate.remoteId === runId);
  const loadedImageId = image?.saved?.imageId;
  const resolvedRunId = run?.remoteId ?? run?.id;
  const outputs = image
    ? [image]
    : studioImages
        .filter((candidate) => candidate.runId === resolvedRunId)
        .sort((left, right) => left.outputIndex - right.outputIndex);
  const matchedIndex = outputs.findIndex((output) =>
    jobId === undefined
      ? output.outputIndex === (outputIndex ?? 0)
      : output.jobId === jobId && output.jobOutputIndex === (outputIndex ?? 0),
  );
  const missingOutput = !image && jobId !== undefined && matchedIndex < 0;
  const selectedIndex = Math.max(0, matchedIndex);
  const selectedImage = missingOutput ? undefined : outputs[selectedIndex];
  const setupSource: GenerationSetupSource | undefined = loadedImageId
    ? { kind: 'images', id: loadedImageId }
    : run?.remoteId && !missingOutput && shouldRestoreRun(run)
      ? { kind: 'runs', id: run.remoteId }
      : undefined;
  const setupQuery = useQuery(generationSetupOptions(activeRepositoryId, setupSource));
  const restoreId = setupSource ? `${setupSource.kind}:${setupSource.id}:${setupKey}` : undefined;

  useLayoutEffect(() => {
    if (restoreId === undefined) {
      restored.current = undefined;
    } else if (setupSource && setupQuery.data && restored.current !== restoreId) {
      restored.current = restoreId;
      onLoadSetup(setupQuery.data, setupSource);
    }
  }, [restoreId, setupQuery.data]);

  useLayoutEffect(() => {
    if (imageId !== undefined || jobId !== undefined || !run?.remoteId || !selectedImage?.jobId)
      return;
    navigate.readdressRun(runId ?? run.id, selectedImage);
  }, [imageId, jobId, runId, outputIndex, run?.remoteId, selectedImage?.jobId]);

  const waitingForFocus =
    Boolean(activeRepositoryId) &&
    ((imageId !== undefined && !image && imagesQuery.isLoading) ||
      (runId !== undefined && !run && options.runsLoading));
  const isRestoringSetup = waitingForFocus || (setupSource !== undefined && setupQuery.isPending);
  const setupBlockedReason =
    setupQuery.error?.message ??
    (isRestoringSetup ? 'Loading the original generation setup.' : undefined);
  const error =
    setupQuery.error?.message ?? run?.error ?? (hasFocus ? imagesQuery.error?.message : undefined);
  if (!image && (!run || missingOutput) && !error && !waitingForFocus) return undefined;

  const saved = selectedImage?.saved;
  const aspectRatio = selectedImage?.aspectRatio ?? run?.aspectRatio;
  const cancellable = run?.status === 'queued' || run?.status === 'running';

  return {
    prompt: image?.saved?.prompt ?? run?.prompt ?? '',
    status: image?.status ?? run?.status ?? (error ? 'failed' : 'completed'),
    ...(aspectRatio === undefined ? {} : { aspectRatio }),
    ...(error === undefined ? {} : { error }),
    requestedOutputCount: run?.outputCount ?? 1,
    isPending: selectedImage !== undefined && saved === undefined,
    isRestoringSetup,
    setupBlockedReason,
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
      navigate.openRun(output.runId, output);
    },
  };
}
