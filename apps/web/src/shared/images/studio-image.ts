import {
  isTerminalWithoutOutputStatus,
  type RunStatus,
  type StudioRun,
} from '../../features/history/run-presentation.js';
import type { GalleryImage } from '../types/domain.js';

export interface StudioImage {
  id: string;
  runId: string;
  outputIndex: number;
  description: string;
  createdAt: string;
  aspectRatio: number | undefined;
  status: RunStatus;
  saved: GalleryImage | undefined;
}

export function toStudioImages(
  images: readonly GalleryImage[],
  runs: readonly StudioRun[],
  imagesUpdatedAt: number,
): StudioImage[] {
  const savedByJob = new Map<string, GalleryImage[]>();
  for (const image of [...images].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  )) {
    const outputs = savedByJob.get(image.jobId) ?? [];
    outputs.push(image);
    savedByJob.set(image.jobId, outputs);
  }
  const savedById = new Map(images.map((image) => [image.imageId, image]));
  const included = new Set<string>();
  const result: StudioImage[] = [];

  for (const run of runs) {
    let outputIndex = 0;
    for (const job of run.jobs) {
      const savedOutputs = savedByJob.get(job.id) ?? [];
      const knownIds = new Set(job.outputImageIds);
      const outputIds: (string | undefined)[] = [
        ...job.outputImageIds,
        ...savedOutputs
          .filter((image) => !knownIds.has(image.imageId))
          .map((image) => image.imageId),
      ];
      if (
        outputIds.length === 0 &&
        job.status !== 'completed' &&
        !isTerminalWithoutOutputStatus(job.status)
      ) {
        outputIds.push(undefined);
      }
      for (const [jobOutputIndex, imageId] of outputIds.entries()) {
        const index = outputIndex++;
        const saved = imageId === undefined ? undefined : savedById.get(imageId);
        // Keep the same image through the gap between the run and saved-image polls.
        if (
          !saved &&
          (job.status === 'completed' || isTerminalWithoutOutputStatus(job.status)) &&
          imagesUpdatedAt >= Date.parse(run.updatedAt)
        )
          continue;
        if (saved) included.add(saved.imageId);
        result.push({
          id: `${job.id}:${String(jobOutputIndex)}`,
          runId: run.remoteId ?? run.id,
          outputIndex: index,
          description: (saved?.prompt ?? run.prompt) || run.targetName,
          createdAt: saved?.createdAt ?? run.createdAt,
          aspectRatio: saved?.aspectRatio ?? run.aspectRatio,
          status: saved ? 'completed' : job.status,
          saved,
        });
      }
    }
  }
  for (const [jobId, outputs] of savedByJob) {
    for (const [index, saved] of outputs.entries()) {
      if (included.has(saved.imageId)) continue;
      result.push({
        id: `${jobId}:${String(index)}`,
        runId: saved.runId,
        outputIndex: index,
        description: saved.prompt?.length ? saved.prompt : 'Generated image',
        createdAt: saved.createdAt,
        aspectRatio: saved.aspectRatio,
        status: 'completed',
        saved,
      });
    }
  }
  return result.sort(
    (left, right) =>
      Number(Boolean(left.saved)) - Number(Boolean(right.saved)) ||
      right.createdAt.localeCompare(left.createdAt) ||
      left.outputIndex - right.outputIndex,
  );
}
