import type { EditSourceController } from '../features/editor/use-edit-source.js';
import type { ImageMetadataController } from '../features/editor/use-image-metadata.js';
import type { AttachmentsController } from '../features/generation/use-attachments.js';
import type { GenerationController } from '../features/generation/use-generation.js';
import type { ReferenceLibraryController } from '../features/references/use-reference-library.js';
import type { Toast } from '../shared/hooks/use-toasts.js';
import { HiddenFileInputs } from './HiddenFileInputs.js';
import { StudioModals } from './StudioModals.js';
import { ToastStack } from './ToastStack.js';
import type { StudioNavigation } from './use-studio-navigation.js';

interface StudioOverlaysProps {
  navigation: StudioNavigation;
  attachments: AttachmentsController;
  editSource: EditSourceController;
  references: ReferenceLibraryController;
  generation: GenerationController;
  metadata: ImageMetadataController;
  toasts: Toast[];
  onDismissToast: (id: string) => void;
  onCopy: (value: string, message?: string) => Promise<void>;
}

export function StudioOverlays({
  navigation,
  attachments,
  editSource,
  references,
  generation,
  metadata,
  toasts,
  onDismissToast,
  onCopy,
}: StudioOverlaysProps) {
  return (
    <>
      <HiddenFileInputs
        promptInput={attachments.fileInput}
        editInput={editSource.editFileInput}
        libraryInput={references.fileInput}
        onPromptFiles={attachments.handleFiles}
        onEditFile={editSource.handleEditFile}
        onLibraryFiles={(event) => {
          void references.handleFiles(event);
        }}
      />

      {navigation.modal && (
        <StudioModals
          modal={navigation.modal}
          requestBody={generation.requestBody}
          metadata={metadata}
          onClose={() => {
            navigation.setModal(null);
          }}
          onCopy={onCopy}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={onDismissToast} />
    </>
  );
}
