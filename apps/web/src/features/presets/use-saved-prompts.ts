import type { PresetCoverRequest, UpdatePresetRequest } from '@harness/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { runMutation } from '../../shared/api/mutation.js';
import { queryKeys } from '../../shared/api/query-keys.js';
import type { Confirm } from '../../shared/hooks/use-dialogs.js';
import { useAlert } from '../../shared/hooks/use-alert.js';
import { readAsData, revokeUploadPreviews } from '../../shared/images/files.js';
import type { UploadAttachment } from '../../shared/types/attachments.js';
import type { Preset, PresetsResponse } from '../../shared/types/domain.js';
import type { PromptDraftController } from '../generation/use-prompt-draft.js';
import * as api from './api.js';

interface PresetEditorState {
  preset?: Preset;
  initialPrompt: string;
}

export interface PresetDraft extends Pick<UpdatePresetRequest, 'name' | 'prompt'> {
  cover?:
    Extract<PresetCoverRequest, { source: 'gallery' }> | { source: 'upload'; file: File } | null;
}

export function useSavedPrompts({
  activeRepositoryId,
  requireRepository,
  confirm,
  promptDraft,
}: {
  activeRepositoryId: string | undefined;
  requireRepository: (action: string) => boolean;
  confirm: Confirm;
  promptDraft: PromptDraftController;
}) {
  const queryClient = useQueryClient();
  const feedback = useAlert();
  const [editor, setEditor] = useState<PresetEditorState | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const presetsQuery = useQuery({
    queryKey: queryKeys.presets(activeRepositoryId),
    queryFn: api.getPresets,
    enabled: Boolean(activeRepositoryId),
    retry: false,
  });

  function beginCreate(initialPrompt = '') {
    feedback.clearAlert();
    if (!requireRepository('save presets')) return false;
    setEditor({ initialPrompt });
    return true;
  }

  function beginEdit(preset: Preset) {
    feedback.clearAlert();
    setEditor({ preset, initialPrompt: preset.prompt });
  }

  function closeEditor() {
    feedback.clearAlert();
    setEditor(null);
  }

  function appendPrompt(preset: Preset) {
    feedback.clearAlert();
    const current = promptDraft.prompt;
    const next = current ? `${current}\n\n${preset.prompt}` : preset.prompt;
    if (next.length > 10_000) {
      feedback.reportWarning(
        'Adding this preset would exceed the 10,000-character prompt limit. Shorten your prompt first.',
      );
      return false;
    }
    promptDraft.setPrompt(next);
    return true;
  }

  async function savePreset(input: PresetDraft) {
    feedback.clearAlert();
    setIsMutating(true);
    try {
      const result = await runMutation(
        async () => {
          let upload: UploadAttachment | undefined;
          try {
            let cover: PresetCoverRequest | null | undefined;
            if (input.cover?.source === 'upload') {
              upload = await readAsData(input.cover.file);
              cover = {
                source: 'upload',
                name: upload.name,
                mediaType: upload.mediaType,
                data: upload.data,
              };
            } else {
              cover = input.cover;
            }
            const fields = { name: input.name, prompt: input.prompt };
            if (editor?.preset) {
              return await api.updatePreset(editor.preset.presetId, {
                ...fields,
                ...(cover === undefined ? {} : { cover }),
              });
            }
            return await api.createPreset({ ...fields, ...(cover ? { cover } : {}) });
          } finally {
            if (upload) revokeUploadPreviews([upload]);
          }
        },
        'Could not save the preset.',
        feedback.reportError,
      );
      if (!result.ok) return;
      queryClient.setQueryData<PresetsResponse>(
        queryKeys.presets(activeRepositoryId),
        (current) => {
          if (current?.presets.some((preset) => preset.presetId === result.value.presetId)) {
            return {
              presets: current.presets.map((preset) =>
                preset.presetId === result.value.presetId ? result.value : preset,
              ),
            };
          }
          return { presets: [result.value, ...(current?.presets ?? [])] };
        },
      );
      setEditor(null);
    } finally {
      setIsMutating(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.presets(activeRepositoryId) });
    }
  }

  async function deletePreset(preset: Preset) {
    const confirmed = await confirm({
      title: `Delete "${preset.name}"?`,
      body: 'This deletes the preset and its cover from this repository. Gallery images and text already added to your prompt are kept.',
      confirmLabel: 'Delete preset',
      danger: true,
    });
    if (!confirmed) return;
    feedback.clearAlert();
    setIsMutating(true);
    try {
      const result = await runMutation(
        () => api.deletePreset(preset.presetId),
        'Could not delete the preset.',
        feedback.reportError,
      );
      if (!result.ok) return;
      queryClient.setQueryData<PresetsResponse>(
        queryKeys.presets(activeRepositoryId),
        (current) => ({
          presets: (current?.presets ?? []).filter((item) => item.presetId !== preset.presetId),
        }),
      );
    } finally {
      setIsMutating(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.presets(activeRepositoryId) });
    }
  }

  return {
    presets: presetsQuery.data?.presets ?? [],
    presetsQuery,
    editor,
    isMutating,
    feedback,
    beginCreate,
    beginEdit,
    closeEditor,
    appendPrompt,
    savePreset,
    deletePreset,
  };
}

export type SavedPromptsController = ReturnType<typeof useSavedPrompts>;
