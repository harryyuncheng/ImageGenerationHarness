import { HiddenFileInputs } from './HiddenFileInputs.js';
import { StudioDialog } from '../shared/components/StudioDialog.js';
import { useStudio, useStudioShell } from './studio-context.js';
import { ToastStack } from './ToastStack.js';

export function StudioOverlays() {
  const studio = useStudio();
  const shell = useStudioShell();

  return (
    <>
      <HiddenFileInputs
        promptInput={studio.attachments.fileInput}
        styleGuideInput={studio.styleGuide.fileInput}
        onPromptFiles={studio.attachments.handleFiles}
        onStyleGuideFiles={(event) => {
          void studio.styleGuide.handleFiles(event);
        }}
      />

      <ToastStack toasts={shell.toasts} onDismiss={shell.dismissToast} />
      <StudioDialog dialogs={shell.dialogs} />
    </>
  );
}
