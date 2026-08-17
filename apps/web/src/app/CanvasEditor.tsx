import { ImageEditor } from '../features/editor/components/ImageEditor.js';
import type { EditorFocus } from '../features/editor/use-editor-focus.js';
import { capabilityLabel, resolveCapability } from '../features/generation/capabilities.js';
import { useStudio } from './studio-context.js';

export function CanvasEditor({ focus }: { focus: EditorFocus }) {
  const studio = useStudio();
  const { closeFocus, openMetadata } = studio.navigate;

  if (focus.kind === 'image') {
    const { image, intent } = focus;
    return (
      <ImageEditor
        id={`image-editor-${image.runId}`}
        key={`image:${image.imageId}`}
        prompt={image.prompt ?? ''}
        targetName={capabilityLabel(resolveCapability(studio.capabilities, image.targetId))}
        location={studio.describeImageLocation(image)}
        createdAt={image.createdAt}
        status="completed"
        imageIds={[image.imageId]}
        expectedImageCount={1}
        onClose={closeFocus}
        onRemix={() => {
          if (intent === 'edit') {
            void studio.editSource.editBaroqueImage(image);
            return;
          }
          closeFocus();
          studio.draftActions.remixImage(image);
        }}
        onMetadata={openMetadata}
        {...(intent === 'edit' ? { statusLabel: 'Ready', editMode: true } : {})}
      />
    );
  }

  if (focus.kind === 'run') {
    const { run } = focus;
    return (
      <ImageEditor
        id={`image-editor-${run.remoteId ?? run.id}`}
        key={`run:${run.id}`}
        prompt={run.prompt}
        targetName={run.targetName}
        location={studio.describeDestination(run.destination)}
        createdAt={run.createdAt}
        status={run.status}
        imageIds={run.outputImageIds ?? []}
        expectedImageCount={run.outputCount}
        {...(run.error ? { error: run.error } : {})}
        onClose={closeFocus}
        onRemix={() => {
          closeFocus();
          studio.draftActions.reuseRun(run);
        }}
        onMetadata={openMetadata}
        {...(run.remoteId
          ? {
              onCancel: () => {
                void studio.runs.cancel(run);
              },
              onRetry: () => {
                void studio.runs.retry(run);
              },
            }
          : {})}
      />
    );
  }

  return (
    <ImageEditor
      id={`image-editor-${focus.id}`}
      key={`upload:${focus.id}`}
      prompt={focus.file.name}
      targetName="Uploaded image"
      location="This device"
      createdAt={focus.createdAt}
      status="completed"
      statusLabel="Ready"
      imageIds={[]}
      localImage={{ id: focus.id, name: focus.file.name, url: focus.previewUrl }}
      expectedImageCount={1}
      onClose={studio.upload.clearUpload}
      onRemix={() => {
        void studio.editSource.editUploadedImage(focus);
      }}
      editMode
    />
  );
}
