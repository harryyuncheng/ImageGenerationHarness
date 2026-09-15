import type { GenerationSetup, GenerationSetupSource } from '@harness/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useLayoutEffect, useRef } from 'react';
import { useStudioNavigate } from '../../app/use-studio-navigate.js';
import type { StudioImage } from '../../shared/images/studio-image.js';
import type { Attachment, MaskAttachment } from '../../shared/types/attachments.js';
import { generationSetupOptions } from '../editor/api.js';
import type { StyleGuideController } from '../style-guide/use-style-guide.js';
import type { AttachmentsController } from './use-attachments.js';
import type { GenerationSettingsController } from './use-generation-settings.js';
import type { PromptDraftController } from './use-prompt-draft.js';

interface DraftActionsOptions {
  activeRepositoryId: string | undefined;
  promptDraft: PromptDraftController;
  settings: GenerationSettingsController;
  attachments: AttachmentsController;
  styleGuide: StyleGuideController;
  releaseRunDraft: () => void;
}

export function useDraftActions({
  activeRepositoryId,
  promptDraft,
  settings,
  attachments,
  styleGuide,
  releaseRunDraft,
}: DraftActionsOptions) {
  const navigate = useStudioNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const opening = useRef(0);

  useLayoutEffect(
    () => () => {
      opening.current += 1;
    },
    [],
  );

  function loadSetup(setup: GenerationSetup, owner: GenerationSetupSource) {
    let source: Attachment | undefined;
    let mask: MaskAttachment | undefined;
    const references: Attachment[] = [];
    for (const [inputIndex, input] of setup.inputs.entries()) {
      const saved = {
        source: 'repository' as const,
        id: `${owner.kind}:${owner.id}:${String(inputIndex)}`,
        imageId: input.imageId,
        name: input.name,
        mediaType: input.mediaType,
        byteLength: input.byteLength,
        previewUrl: `/api/${owner.kind}/${owner.id}/inputs/${String(inputIndex)}/content`,
        snapshot: { ...owner, inputIndex },
      };
      if (input.role === 'mask') {
        mask = {
          ...saved,
          ...(input.maskEncoding === undefined ? {} : { maskEncoding: input.maskEncoding }),
        };
      } else {
        const attachment: Attachment = input.styleGuide
          ? { ...saved, source: 'style-guide', folderId: input.styleGuide.folderId }
          : saved;
        if (input.role === 'source') source = attachment;
        else references.push(attachment);
      }
    }
    promptDraft.setPrompt(setup.prompt);
    settings.restoreSettings(setup.settings);
    styleGuide.restoreGuide(setup.inputs.find((input) => input.styleGuide)?.styleGuide ?? null);
    attachments.restoreInputs({
      source,
      references,
      mask: mask && source ? { ...mask, maskSourceId: source.id } : mask,
    });
  }

  async function open(source: GenerationSetupSource, navigateToImage: () => void) {
    const request = ++opening.current;
    const location = router.state.location;
    // Setup errors belong on the canvas; missing inputs must not prevent viewing the output.
    await queryClient.prefetchQuery(generationSetupOptions(activeRepositoryId, source));
    if (opening.current !== request || router.state.location !== location) return;
    releaseRunDraft();
    navigateToImage();
  }

  function resetDraft() {
    opening.current += 1;
    attachments.reset();
    styleGuide.restoreGuide(null);
    promptDraft.setPrompt('');
    settings.resetSettings();
    navigate.closeFocus();
  }

  return {
    loadSetup,
    openImage: (image: StudioImage) => {
      if (image.status === 'submitting') {
        navigate.openImage(image);
        return;
      }
      void open(
        image.saved
          ? { kind: 'images', id: image.saved.imageId }
          : { kind: 'runs', id: image.runId },
        () => {
          navigate.openImage(image);
        },
      );
    },
    resetDraft,
  };
}

export type DraftActionsController = ReturnType<typeof useDraftActions>;
