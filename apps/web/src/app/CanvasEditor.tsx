import { ImageEditor } from '../features/editor/components/ImageEditor.js';
import type { EditorSelectionController } from '../features/editor/use-editor-selection.js';
import type { EditSourceController } from '../features/editor/use-edit-source.js';
import { capabilityLabel, resolveCapability } from '../features/generation/capabilities.js';
import type { DraftActionsController } from '../features/generation/use-draft-actions.js';
import type { RunsController } from '../features/history/use-runs.js';
import type { Capability, Destination } from '../shared/types/domain.js';

export interface CanvasEditorProps {
  editor: EditorSelectionController;
  capabilities: readonly Capability[];
  runs: RunsController;
  editSource: EditSourceController;
  draftActions: DraftActionsController;
  describeDestination: (destination: Destination) => string;
  onViewMetadata: (imageId: string) => void;
}

export function CanvasEditor({
  editor,
  capabilities,
  runs,
  editSource,
  draftActions,
  describeDestination,
  onViewMetadata,
}: CanvasEditorProps) {
  const selection = editor.selection;
  const openMetadata = (imageId: string) => {
    onViewMetadata(imageId);
  };

  if (selection?.kind === 'image') {
    const { image, location, intent } = selection;
    return (
      <ImageEditor
        id={`image-editor-${image.runId}`}
        key={`image:${image.imageId}`}
        prompt={image.prompt ?? ''}
        targetName={capabilityLabel(resolveCapability(capabilities, image.targetId))}
        location={location}
        createdAt={image.createdAt}
        status="completed"
        imageIds={[image.imageId]}
        expectedImageCount={1}
        onClose={editor.close}
        onRemix={() => {
          if (intent === 'edit') {
            void editSource.editBaroqueImage(image);
            return;
          }
          editor.close();
          draftActions.remixImage(image);
        }}
        onMetadata={openMetadata}
        {...(intent === 'edit' ? { statusLabel: 'Ready', editMode: true } : {})}
      />
    );
  }

  if (selection?.kind === 'run') {
    const run = editor.resolveRun(runs.allRuns);
    if (!run) return null;
    return (
      <ImageEditor
        id={`image-editor-${run.remoteId ?? selection.localId}`}
        key={`run:${selection.localId}`}
        prompt={run.prompt}
        targetName={run.targetName}
        location={describeDestination(run.destination)}
        createdAt={run.createdAt}
        status={run.status}
        imageIds={run.outputImageIds ?? []}
        expectedImageCount={run.outputCount}
        {...(run.error ? { error: run.error } : {})}
        onClose={editor.close}
        onRemix={() => {
          editor.close();
          draftActions.reuseRun(run);
        }}
        onMetadata={openMetadata}
        {...(run.remoteId
          ? {
              onCancel: () => {
                void runs.cancel(run);
              },
              onRetry: () => {
                void runs.retry(run);
              },
            }
          : {})}
      />
    );
  }

  if (selection?.kind === 'upload') {
    return (
      <ImageEditor
        id={`image-editor-${selection.id}`}
        key={`upload:${selection.id}`}
        prompt={selection.file.name}
        targetName="Uploaded image"
        location="This device"
        createdAt={selection.createdAt}
        status="completed"
        statusLabel="Ready"
        imageIds={[]}
        localImage={{
          id: selection.id,
          name: selection.file.name,
          url: selection.previewUrl,
        }}
        expectedImageCount={1}
        onClose={editor.close}
        onRemix={() => {
          void editSource.editUploadedImage(selection);
        }}
        editMode
      />
    );
  }

  return null;
}
