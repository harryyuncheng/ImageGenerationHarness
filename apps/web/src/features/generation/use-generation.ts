import { useMemo, useState } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';
import { useStudioNavigate } from '../../app/use-studio-navigate.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { StudioRun } from '../history/run-presentation.js';
import type { RunsController } from '../history/use-runs.js';
import { queueRun } from './api.js';
import { capabilityLabel, needsImage, requiresPrompt } from './capabilities.js';
import { buildGenerationSubmission } from './request.js';
import type { AttachmentsController } from './use-attachments.js';
import type { DestinationController } from './use-destination.js';
import type { GenerationSettingsController } from './use-generation-settings.js';
import type { PromptDraftController } from './use-prompt-draft.js';

interface GenerationOptions {
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  destination: DestinationController;
  runs: RunsController;
  notify: Notify;
  requireRepository: (action: string) => boolean;
}

export function useGeneration(options: GenerationOptions) {
  const { promptDraft, settings, attachments, destination, runs, notify } = options;
  const navigate = useStudioNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { prompt } = promptDraft;
  const { selectedCapability } = settings;

  const requestBody = useMemo(
    () =>
      buildGenerationSubmission(
        selectedCapability,
        prompt,
        settings.settings,
        attachments.attachments,
        destination.destination,
      ),
    [
      attachments.attachments,
      destination.destination,
      prompt,
      selectedCapability,
      settings.settings,
    ],
  );

  function draftIsIncomplete(): boolean {
    if (!prompt.trim() && requiresPrompt(selectedCapability)) {
      notify('Describe the image you want to create.', 'error');
      promptDraft.focusPrompt();
      return true;
    }
    if (needsImage(selectedCapability) && attachments.attachments.length === 0) {
      notify('Add a source image for this tool.', 'error');
      attachments.fileInput.current?.click();
      return true;
    }
    if (
      selectedCapability.canonicalId === 'service/style-transfer' &&
      attachments.attachments.length < 2
    ) {
      notify('Style Transfer needs a source image and a style reference.', 'error');
      attachments.fileInput.current?.click();
      return true;
    }
    if (
      selectedCapability.canonicalId === 'service/search-recolor' &&
      !settings.settings.selectPrompt.trim()
    ) {
      notify('Describe the object or area to recolor in Run settings.', 'error');
      return true;
    }
    if (
      selectedCapability.canonicalId === 'service/search-replace' &&
      !settings.settings.searchPrompt.trim()
    ) {
      notify('Describe the object to replace in Run settings.', 'error');
      return true;
    }
    return false;
  }

  async function generate(event?: SyntheticEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!options.requireRepository('generate images')) return;
    if (draftIsIncomplete()) return;

    const localId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const baseRun: StudioRun = {
      id: localId,
      createdAt,
      updatedAt: createdAt,
      prompt,
      targetId: selectedCapability.canonicalId,
      targetName: capabilityLabel(selectedCapability),
      aspectRatio: settings.settings.aspectRatio,
      outputCount: settings.settings.outputCount,
      attachmentNames: attachments.attachments.map((attachment) => attachment.name),
      outputImageIds: [],
      destination: destination.destination,
      status: 'submitting',
      favorite: false,
    };
    runs.addOptimisticRun(baseRun);
    navigate.openRun(localId);
    setIsSubmitting(true);

    try {
      const { runId: remoteId } = await queueRun(requestBody);
      runs.markRunQueued(localId, remoteId);
      navigate.readdressRun(remoteId);
      void runs.invalidateRuns();
      const { outputCount } = settings.settings;
      notify(`${String(outputCount)} image${outputCount === 1 ? '' : 's'} queued.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation could not be queued.';
      runs.discardOptimisticRun(localId);
      navigate.goToCreate();
      promptDraft.focusPromptSoon();
      notify(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void generate();
    }
  }

  return { isSubmitting, generate, handlePromptKeyDown };
}

export type GenerationController = ReturnType<typeof useGeneration>;
