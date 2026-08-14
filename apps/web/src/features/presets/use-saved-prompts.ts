import { usePersistentState } from '../../shared/hooks/use-persistent-state.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';

/** Saved prompt presets live only in this browser. */
export function useSavedPrompts(notify: Notify) {
  const [savedPrompts, setSavedPrompts] = usePersistentState<string[]>('harness-saved-prompts', []);

  function savePrompt(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      notify('Write a prompt before saving it.', 'error');
      return;
    }
    if (!savedPrompts.includes(trimmed)) {
      setSavedPrompts((current) => [trimmed, ...current]);
    }
    notify('Prompt saved to presets.', 'success');
  }

  function deletePrompt(value: string) {
    setSavedPrompts((current) => current.filter((item) => item !== value));
  }

  return { savedPrompts, savePrompt, deletePrompt };
}

export type SavedPromptsController = ReturnType<typeof useSavedPrompts>;
