import { useEffect, useState } from 'react';
import type { GalleryImage } from '../../shared/types/domain.js';
import type { StudioRun } from '../history/run-presentation.js';

export type ImageEditorSelection =
  | {
      kind: 'run';
      localId: string;
      remoteId?: string;
      fallback: StudioRun;
    }
  | {
      kind: 'image';
      image: GalleryImage;
      location: string;
      intent: 'view' | 'edit';
    }
  | {
      kind: 'upload';
      id: string;
      file: File;
      previewUrl: string;
      createdAt: string;
    };

/**
 * Owns which image the canvas is editing. Upload previews are object URLs, so the
 * selection is also responsible for revoking them.
 */
export function useEditorSelection(activeRepositoryId: string | undefined) {
  const [selection, setSelection] = useState<ImageEditorSelection>();

  useEffect(() => {
    setSelection(undefined);
  }, [activeRepositoryId]);

  const uploadedPreviewUrl = selection?.kind === 'upload' ? selection.previewUrl : undefined;
  useEffect(() => {
    if (!uploadedPreviewUrl) return;
    return () => {
      URL.revokeObjectURL(uploadedPreviewUrl);
    };
  }, [uploadedPreviewUrl]);

  function close() {
    setSelection(undefined);
  }

  function openRun(run: StudioRun) {
    setSelection({
      kind: 'run',
      localId: run.id,
      ...(run.remoteId ? { remoteId: run.remoteId } : {}),
      fallback: run,
    });
  }

  function openRunDraft(localId: string, fallback: StudioRun) {
    setSelection({ kind: 'run', localId, fallback });
  }

  function openImage(image: GalleryImage, location: string, intent: 'view' | 'edit' = 'view') {
    setSelection({ kind: 'image', image, location, intent });
  }

  function openUpload(file: File) {
    setSelection({
      kind: 'upload',
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      createdAt: new Date().toISOString(),
    });
  }

  /** Promotes a submitted draft once the local control plane accepts the run. */
  function attachRemoteId(localId: string, remoteId: string) {
    setSelection((current) =>
      current?.kind === 'run' && current.localId === localId
        ? {
            ...current,
            remoteId,
            fallback: { ...current.fallback, remoteId, status: 'queued' },
          }
        : current,
    );
  }

  function closeRun(localId: string) {
    setSelection((current) =>
      current?.kind === 'run' && current.localId === localId ? undefined : current,
    );
  }

  function showsFailedRun(failedIds: ReadonlySet<string>): boolean {
    return (
      selection?.kind === 'run' &&
      (failedIds.has(selection.localId) ||
        (selection.remoteId !== undefined && failedIds.has(selection.remoteId)))
    );
  }

  function matchesRun(run: StudioRun): boolean {
    if (selection?.kind === 'image') {
      return run.id === selection.image.runId || run.remoteId === selection.image.runId;
    }
    if (selection?.kind !== 'run') return false;
    return (
      run.id === selection.localId ||
      (selection.remoteId !== undefined &&
        (run.remoteId === selection.remoteId || run.id === selection.remoteId))
    );
  }

  /** Falls back to the optimistic snapshot until the durable run arrives. */
  function resolveRun(runs: readonly StudioRun[]): StudioRun | undefined {
    if (selection?.kind !== 'run') return undefined;
    return (
      runs.find(
        (run) =>
          run.id === selection.localId ||
          (selection.remoteId !== undefined &&
            (run.id === selection.remoteId || run.remoteId === selection.remoteId)),
      ) ?? selection.fallback
    );
  }

  return {
    selection,
    close,
    openRun,
    openRunDraft,
    openImage,
    openUpload,
    attachRemoteId,
    closeRun,
    showsFailedRun,
    matchesRun,
    resolveRun,
  };
}

export type EditorSelectionController = ReturnType<typeof useEditorSelection>;
