import { HiddenFileInputs } from './HiddenFileInputs.js';
import { StudioModals } from './StudioModals.js';
import type { PreviewModal } from './StudioShell.js';
import { useStudio, useStudioShell } from './studio-context.js';
import { ToastStack } from './ToastStack.js';

interface StudioOverlaysProps {
  previewModal: PreviewModal;
  onClosePreview: () => void;
}

export function StudioOverlays({ previewModal, onClosePreview }: StudioOverlaysProps) {
  const studio = useStudio();
  const shell = useStudioShell();

  return (
    <>
      <HiddenFileInputs
        promptInput={studio.attachments.fileInput}
        libraryInput={studio.references.fileInput}
        onPromptFiles={studio.attachments.handleFiles}
        onLibraryFiles={(event) => {
          void studio.references.handleFiles(event);
        }}
      />

      {previewModal && (
        <StudioModals
          modal={previewModal}
          requestBody={studio.generation.requestBody}
          onClose={onClosePreview}
          onCopy={shell.copyText}
        />
      )}

      <ToastStack toasts={shell.toasts} onDismiss={shell.dismissToast} />
    </>
  );
}
