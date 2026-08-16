import { useState } from 'react';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { Capability, Destination, GalleryImage } from '../../shared/types/domain.js';
import type { StudioRun } from '../history/run-presentation.js';
import { capabilityLabel, needsImage } from './capabilities.js';
import { imageDestination } from './destination.js';
import type { AttachmentsController } from './use-attachments.js';
import type { DestinationController } from './use-destination.js';
import type { GenerationSettingsController } from './use-generation-settings.js';
import type { PromptDraftController } from './use-prompt-draft.js';

interface DraftActionsOptions {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  destination: DestinationController;
  notify: Notify;
  goToCreate: () => void;
}

export function useDraftActions({
  promptDraft,
  settings,
  attachments,
  destination,
  notify,
  goToCreate,
}: DraftActionsOptions) {
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  function openCreateAndFocus() {
    goToCreate();
    promptDraft.focusPromptSoon();
  }

  function toggleModelMenu() {
    setModelMenuOpen((open) => !open);
  }

  function closeModelMenu() {
    setModelMenuOpen(false);
  }

  function selectModel(capability: Capability) {
    settings.updateSettings('targetId', capability.canonicalId);
    setModelMenuOpen(false);
    if (needsImage(capability) && attachments.attachments.length === 0) {
      notify(`${capabilityLabel(capability)} needs a source image.`);
    }
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
    goToCreate();
    notify('Settings restored. Add source images again if needed.', 'success');
  }

  function remixImage(image: GalleryImage) {
    promptDraft.setPrompt(image.prompt ?? '');
    settings.updateSettings('targetId', image.targetId);
    destination.setDestination(imageDestination(image));
    goToCreate();
    notify(
      'Prompt, model, and destination restored. Add source images again if needed.',
      'success',
    );
  }

  return {
    modelMenuOpen,
    toggleModelMenu,
    closeModelMenu,
    selectModel,
    generateTo,
    resetDestination,
    reuseRun,
    remixImage,
  };
}

export type DraftActionsController = ReturnType<typeof useDraftActions>;
