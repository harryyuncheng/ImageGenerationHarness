import { useImageMetadata } from '../features/editor/use-image-metadata.js';
import { HiddenFileInputs } from './HiddenFileInputs.js';
import { StudioModals } from './StudioModals.js';
import type { PreviewModal } from './StudioShell.js';
import { useStudio, useStudioShell } from './studio-context.js';
import { ToastStack } from './ToastStack.js';

interface StudioOverlaysProps {
  previewModal: PreviewModal;
  metadataImageId: string | undefined;
  onClosePreview: () => void;
}

export function StudioOverlays({
  previewModal,
  metadataImageId,
  onClosePreview,
}: StudioOverlaysProps) {
  const studio = useStudio();
  const shell = useStudioShell();
  const metadataQuery = useImageMetadata(studio.activeRepositoryId, metadataImageId);
  const modal = metadataImageId === undefined ? previewModal : 'metadata';

  return (
    <>
      <HiddenFileInputs
        promptInput={studio.attachments.fileInput}
        editInput={studio.editSource.editFileInput}
        libraryInput={studio.references.fileInput}
        onPromptFiles={studio.attachments.handleFiles}
        onEditFile={studio.editSource.handleEditFile}
        onLibraryFiles={(event) => {
          void studio.references.handleFiles(event);
        }}
      />

      {modal && (
        <StudioModals
          modal={modal}
          requestBody={studio.generation.requestBody}
          metadataQuery={metadataQuery}
          onClose={metadataImageId === undefined ? onClosePreview : studio.navigate.closeMetadata}
          onCopy={shell.copyText}
        />
      )}

      <ToastStack toasts={shell.toasts} onDismiss={shell.dismissToast} />
    </>
  );
}
