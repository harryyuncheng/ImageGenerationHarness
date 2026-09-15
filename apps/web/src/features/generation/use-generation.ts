import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';
import { requestedImageAspectRatio } from '@harness/contracts';
import { useStudioNavigate } from '../../app/use-studio-navigate.js';
import { useAlert } from '../../shared/hooks/use-alert.js';
import { matchesShortcut, type ShortcutBinding } from '../../shared/shortcuts.js';
import type { StudioRun } from '../history/run-presentation.js';
import type { RunsController } from '../history/use-runs.js';
import { queueRun } from './api.js';
import { capabilityLabel, needsImage, requiresPrompt } from './capabilities.js';
import { buildGenerationSubmission } from './request.js';
import type { AttachmentsController } from './use-attachments.js';
import type { GenerationSettingsController } from './use-generation-settings.js';
import type { PromptDraftController } from './use-prompt-draft.js';

interface GenerationOptions {
  activeRepositoryId: string | undefined;
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  runs: RunsController;
  createShortcut: ShortcutBinding | null;
  capabilityBlockedReason: string | undefined;
  requireRepository: (action: string) => boolean;
}

export function useGeneration(options: GenerationOptions) {
  const { promptDraft, settings, attachments, runs } = options;
  const navigate = useStudioNavigate();
  const feedback = useAlert();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mounted = useRef(true);
  const { prompt } = promptDraft;
  const { selectedCapability } = settings;
  const blockedReason = options.capabilityBlockedReason ?? attachments.blockedReason;

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const requestBody = useMemo(
    () =>
      buildGenerationSubmission(selectedCapability, prompt, settings.settings, attachments.inputs),
    [attachments.inputs, prompt, selectedCapability, settings.settings],
  );

  function draftIsIncomplete(): boolean {
    if (blockedReason) {
      feedback.reportError(blockedReason);
      return true;
    }
    if (!prompt.trim() && requiresPrompt(selectedCapability)) {
      feedback.reportError('Describe the image you want to create.');
      promptDraft.focusPrompt();
      return true;
    }
    if (needsImage(selectedCapability) && !attachments.inputs.source) {
      feedback.reportError('Add a source image for this tool.');
      attachments.chooseFiles('source');
      return true;
    }
    if (
      selectedCapability.canonicalId === 'service/style-transfer' &&
      attachments.inputs.references.length === 0
    ) {
      feedback.reportError('Style Transfer needs a source image and a style reference.');
      attachments.chooseFiles('references');
      return true;
    }
    if (
      selectedCapability.canonicalId === 'service/search-recolor' &&
      !settings.settings.selectPrompt.trim()
    ) {
      feedback.reportError('Describe the object or area to recolor in Run settings.');
      return true;
    }
    if (
      selectedCapability.canonicalId === 'service/search-replace' &&
      !settings.settings.searchPrompt.trim()
    ) {
      feedback.reportError('Describe the object to replace in Run settings.');
      return true;
    }
    return false;
  }

  async function generate(event?: SyntheticEvent<HTMLFormElement>) {
    event?.preventDefault();
    const repositoryId = options.activeRepositoryId;
    feedback.clearAlert();
    runs.feedback.clearAlert();
    if (repositoryId === undefined) {
      options.requireRepository('generate images');
      return;
    }
    if (draftIsIncomplete()) return;

    const localId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const aspectRatio = requestedImageAspectRatio(requestBody.request);
    const baseRun: StudioRun = {
      id: localId,
      createdAt,
      updatedAt: createdAt,
      prompt,
      targetId: selectedCapability.canonicalId,
      targetName: capabilityLabel(selectedCapability),
      ...(aspectRatio === undefined ? {} : { aspectRatio }),
      outputCount: settings.settings.outputCount,
      attachmentNames: [
        attachments.inputs.source,
        ...attachments.inputs.references,
        attachments.inputs.mask,
      ]
        .filter((attachment) => attachment !== undefined)
        .map((attachment) => attachment.name),
      jobs: Array.from({ length: settings.settings.outputCount }, () => ({
        id: crypto.randomUUID(),
        status: 'submitting',
        requestedOutputCount: 1,
        outputImageIds: [],
      })),
      status: 'submitting',
    };
    runs.addOptimisticRun(baseRun);
    navigate.openRun(localId);
    setIsSubmitting(true);

    try {
      const queued = await queueRun({ ...requestBody, repositoryId });
      if (!mounted.current) return;
      runs.markRunQueued(localId, queued);
      navigate.readdressRun(localId, queued);
      void runs.invalidateRuns();
    } catch (error) {
      if (!mounted.current) return;
      const message = error instanceof Error ? error.message : 'Generation could not be queued.';
      runs.discardOptimisticRun(localId);
      navigate.readdressRun(localId, undefined);
      promptDraft.focusPromptSoon();
      runs.feedback.reportError(message);
    } finally {
      if (mounted.current) setIsSubmitting(false);
    }
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!isSubmitting && matchesShortcut(event.nativeEvent, options.createShortcut)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return {
    isSubmitting,
    blockedReason,
    generate,
    handlePromptKeyDown,
    createShortcut: options.createShortcut,
    feedback,
  };
}

export type GenerationController = ReturnType<typeof useGeneration>;
