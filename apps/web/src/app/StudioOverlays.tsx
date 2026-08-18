import { HiddenFileInputs } from './HiddenFileInputs.js';
import { useStudio, useStudioShell } from './studio-context.js';
import { ToastStack } from './ToastStack.js';

export function StudioOverlays() {
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

      <ToastStack toasts={shell.toasts} onDismiss={shell.dismissToast} />
    </>
  );
}
