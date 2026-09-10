import { useStudioNavigate } from '../../app/use-studio-navigate.js';
import type { GalleryImage } from '../../shared/types/domain.js';
import type { StudioRun } from '../history/run-presentation.js';
import type { AttachmentsController } from './use-attachments.js';
import type { GenerationSettingsController } from './use-generation-settings.js';
import type { PromptDraftController } from './use-prompt-draft.js';

interface DraftActionsOptions {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
}

export function useDraftActions({ promptDraft, settings, attachments }: DraftActionsOptions) {
  const navigate = useStudioNavigate();

  /** Loading a saved image restores the draft that produced it, ready to run again. */
  function loadImageDraft(image: GalleryImage) {
    promptDraft.setPrompt(image.prompt ?? '');
    settings.updateSettings('targetId', image.targetId);
  }

  /** Loading a run restores its prompt and tool without changing other controls. */
  function loadRunDraft(run: StudioRun) {
    promptDraft.setPrompt(run.prompt);
    settings.updateSettings('targetId', run.targetId);
  }

  function resetDraft() {
    attachments.reset();
    promptDraft.setPrompt('');
    settings.resetSettings();
    navigate.closeFocus();
  }

  return {
    loadImageDraft,
    loadRunDraft,
    resetDraft,
  };
}

export type DraftActionsController = ReturnType<typeof useDraftActions>;
