import { useStudioNavigate } from '../../app/use-studio-navigate.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { Capability, Destination, GalleryImage } from '../../shared/types/domain.js';
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

  function openCreateAndFocus() {
    navigate.goToCreate();
    promptDraft.focusPromptSoon();
  }

  function selectTool(capability: Capability) {
    settings.updateSettings('targetId', capability.canonicalId);
  }

  function generateTo(nextDestination: Destination) {
    destination.setDestination(nextDestination);
    openCreateAndFocus();
  }

  function resetDestination() {
    destination.resetDestination();
    notify('New images will save to the main repository.', 'success');
  }

  function reuseRun(run: StudioRun) {
    promptDraft.setPrompt(run.prompt);
    settings.updateSettings('targetId', run.targetId);
    if (run.aspectRatio !== 'saved settings') {
      settings.updateSettings('aspectRatio', run.aspectRatio);
    }
    destination.setDestination(run.destination);
    navigate.goToCreate();
    notify('Settings restored. Add source images again if needed.', 'success');
  }

  function remixImage(image: GalleryImage) {
    promptDraft.setPrompt(image.prompt ?? '');
    settings.updateSettings('targetId', image.targetId);
    destination.setDestination(imageDestination(image));
    navigate.goToCreate();
    notify(
      'Prompt, model, and destination restored. Add source images again if needed.',
      'success',
    );
  }

  return {
    selectTool,
    generateTo,
    resetDestination,
    reuseRun,
    remixImage,
  };
}

export type DraftActionsController = ReturnType<typeof useDraftActions>;
