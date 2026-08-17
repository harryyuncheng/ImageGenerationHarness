import { useEffect, useState } from 'react';
import type { StudioSearch } from '../../app/studio-search.js';
import type { GalleryImage } from '../../shared/types/domain.js';
import type { StudioRun } from '../history/run-presentation.js';

export interface UploadSelection {
  kind: 'upload';
  id: string;
  file: File;
  previewUrl: string;
  createdAt: string;
}

export type EditorFocus =
  | { kind: 'image'; image: GalleryImage; intent: 'view' | 'edit' }
  | { kind: 'run'; run: StudioRun }
  | UploadSelection;

/**
 * An uploaded image is a live File plus an object URL, so it is the one editor
 * subject that cannot be addressed by a link and stays in component state.
 */
export function useUploadSelection() {
  const [upload, setUpload] = useState<UploadSelection>();
  const previewUrl = upload?.previewUrl;

  useEffect(() => {
    if (previewUrl === undefined) return;
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function openUpload(file: File) {
    setUpload({
      kind: 'upload',
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      createdAt: new Date().toISOString(),
    });
  }

  function clearUpload() {
    setUpload(undefined);
  }

  return { upload, openUpload, clearUpload };
}

export type UploadSelectionController = ReturnType<typeof useUploadSelection>;

/**
 * Resolves the addressed identifier against live data. An identifier that no longer
 * exists yields no focus, which surfaces the underlying view rather than an error.
 */
export function resolveEditorFocus(
  search: StudioSearch,
  images: readonly GalleryImage[],
  runs: readonly StudioRun[],
  upload: UploadSelection | undefined,
): EditorFocus | undefined {
  if (search.image !== undefined) {
    const image = images.find((candidate) => candidate.imageId === search.image);
    return image ? { kind: 'image', image, intent: search.mode ?? 'view' } : undefined;
  }
  if (search.run !== undefined) {
    const run = runs.find(
      (candidate) => candidate.id === search.run || candidate.remoteId === search.run,
    );
    return run ? { kind: 'run', run } : undefined;
  }
  return upload;
}
