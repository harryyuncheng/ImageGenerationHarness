import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useStudioNavigate } from '../../app/use-studio-navigate.js';
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
import type {
  EditorFocus,
  UploadSelection,
  UploadSelectionController,
} from './use-editor-focus.js';
import type { EditToolsController } from './use-edit-tools.js';

interface EditSourceOptions {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  destination: DestinationController;
  upload: UploadSelectionController;
  editTools: EditToolsController;
  notify: Notify;
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
  upload,
  editTools,
  notify,
}: EditSourceOptions) {
  const navigate = useStudioNavigate();
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
    upload.openUpload(file);
    navigate.goToEdit();
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
    navigate.goToCreate();
    notify('Image added as the editing source.', 'success');
  }

  async function editUploadedImage(selection: UploadSelection) {
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
    upload.clearUpload();
    navigate.goToCreate();
    notify('Image added as the editing source.', 'success');
  }

  function startSelectedEdit(focus: EditorFocus | undefined) {
    if (focus?.kind === 'upload') {
      void editUploadedImage(focus);
      return;
    }
    if (focus?.kind === 'image' && focus.intent === 'edit') {
      void editBaroqueImage(focus.image);
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
