import { useStudioNavigate } from '../../app/use-studio-navigate.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { Destination, GalleryImage } from '../../shared/types/domain.js';
import type { StudioRun } from '../history/run-presentation.js';
import { imageDestination } from './destination.js';
import type { DestinationController } from './use-destination.js';
import type { GenerationSettingsController } from './use-generation-settings.js';
import type { PromptDraftController } from './use-prompt-draft.js';

interface DraftActionsOptions {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  destination: DestinationController;
  notify: Notify;
}

export function useDraftActions({
  promptDraft,
  settings,
  destination,
  notify,
}: DraftActionsOptions) {
  const navigate = useStudioNavigate();

  function generateTo(nextDestination: Destination) {
    destination.setDestination(nextDestination);
    navigate.goToCreate();
    promptDraft.focusPromptSoon();
  }

  function resetDestination() {
    destination.resetDestination();
    notify('New images will save to the main repository.', 'success');
  }

  /** Loading a saved image restores the draft that produced it, ready to run again. */
  function loadImageDraft(image: GalleryImage) {
    promptDraft.setPrompt(image.prompt ?? '');
    settings.updateSettings('targetId', image.targetId);
    destination.setDestination(imageDestination(image));
  }

  /** Durable snapshots report a placeholder aspect ratio, so only real settings are restored. */
  function loadRunDraft(run: StudioRun) {
    promptDraft.setPrompt(run.prompt);
    settings.updateSettings('targetId', run.targetId);
    destination.setDestination(run.destination);
  }

  function resetDraft() {
    promptDraft.setPrompt('');
    settings.resetSettings();
    destination.resetDestination();
    navigate.closeFocus();
  }

  return {
    generateTo,
    resetDestination,
    loadImageDraft,
    loadRunDraft,
    resetDraft,
  };
}

export type DraftActionsController = ReturnType<typeof useDraftActions>;
