import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { runMutation } from '../../shared/api/mutation.js';
import {
  readAsData,
  readGalleryImageAsData,
  supportedImageFiles,
} from '../../shared/images/files.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { GalleryImage } from '../../shared/types/domain.js';
import { imageDestination } from '../generation/destination.js';
import type { AttachmentsController } from '../generation/use-attachments.js';
import type { DestinationController } from '../generation/use-destination.js';
import type { GenerationSettingsController } from '../generation/use-generation-settings.js';
import type { PromptDraftController } from '../generation/use-prompt-draft.js';
import type { EditToolsController } from './use-edit-tools.js';
import type { EditorSelectionController, ImageEditorSelection } from './use-editor-selection.js';

interface EditSourceOptions {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  destination: DestinationController;
  editor: EditorSelectionController;
  editTools: EditToolsController;
  notify: Notify;
  goToEdit: () => void;
  goToCreate: () => void;
}

/**
 * Turns a chosen image into the single source attachment for the selected
 * editing tool, then hands the draft back to the composer.
 */
export function useEditSource({
  promptDraft,
  settings,
  attachments,
  destination,
  editor,
  editTools,
  notify,
  goToEdit,
  goToCreate,
}: EditSourceOptions) {
  const editFileInput = useRef<HTMLInputElement>(null);

  const reportError = (message: string) => {
    notify(message, 'error');
  };

  function openEditFile(files: readonly File[]) {
    const file = files[0];
    if (!file) return;
    if (supportedImageFiles([file]).length === 0) {
      notify('Use a PNG, JPEG, or WebP image up to 10 MB.', 'error');
      return;
    }
    editor.openUpload(file);
    goToEdit();
  }

  function handleEditFile(event: ChangeEvent<HTMLInputElement>) {
    openEditFile(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function requireEditingTool(): string | undefined {
    const canonicalId = editTools.selectedTool?.canonicalId;
    if (!canonicalId) notify('No image editing tools are available.', 'error');
    return canonicalId;
  }

  async function editBaroqueImage(image: GalleryImage) {
    const toolId = requireEditingTool();
    if (!toolId) return;
    const result = await runMutation(
      () => readGalleryImageAsData(image),
      'Could not prepare the Baroque image for editing.',
      reportError,
    );
    if (!result.ok) return;
    attachments.replaceWithEditingSource(result.value);
    promptDraft.setPrompt(image.prompt ?? '');
    settings.updateSettings('targetId', toolId);
    destination.setDestination(imageDestination(image));
    editor.close();
    goToCreate();
    notify('Image added as the editing source.', 'success');
  }

  async function editUploadedImage(selection: Extract<ImageEditorSelection, { kind: 'upload' }>) {
    const toolId = requireEditingTool();
    if (!toolId) return;
    const result = await runMutation(
      () => readAsData(selection.file),
      'Could not prepare the uploaded image for editing.',
      reportError,
    );
    if (!result.ok) return;
    attachments.replaceWithEditingSource(result.value);
    promptDraft.setPrompt('');
    settings.updateSettings('targetId', toolId);
    destination.resetDestination();
    editor.close();
    goToCreate();
    notify('Image added as the editing source.', 'success');
  }

  function startSelectedEdit() {
    const selection = editor.selection;
    if (selection?.kind === 'upload') {
      void editUploadedImage(selection);
      return;
    }
    if (selection?.kind === 'image' && selection.intent === 'edit') {
      void editBaroqueImage(selection.image);
    }
  }

  return {
    editFileInput,
    openEditFile,
    handleEditFile,
    editBaroqueImage,
    editUploadedImage,
    startSelectedEdit,
  };
}

export type EditSourceController = ReturnType<typeof useEditSource>;
