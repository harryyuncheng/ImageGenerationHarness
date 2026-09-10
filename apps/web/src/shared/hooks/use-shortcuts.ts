import { useEffect, useMemo } from 'react';
import {
  defaultShortcuts,
  sameShortcut,
  shortcutActions,
  shortcutBindingError,
  shortcutBindingsSchema,
  type ShortcutAction,
  type ShortcutBinding,
} from '../shortcuts.js';
import { useInlineError } from './use-inline-error.js';
import { usePersistentState } from './use-persistent-state.js';

export function useShortcuts() {
  const [stored, setStored] = usePersistentState<unknown>('harness-shortcuts', defaultShortcuts);
  const parsed = useMemo(() => shortcutBindingsSchema.safeParse(stored), [stored]);
  const bindings = parsed.success ? parsed.data : defaultShortcuts;
  const feedback = useInlineError();
  const { reportError } = feedback;

  useEffect(() => {
    if (!parsed.success) {
      reportError('Saved shortcuts are invalid. Defaults are active; Reset all restores them.');
    }
  }, [parsed, reportError]);

  function setBinding(action: ShortcutAction, binding: ShortcutBinding | null): boolean {
    const error = shortcutBindingError(bindings, action, binding);
    if (error) {
      feedback.reportError(error);
      return false;
    }
    feedback.clearError();
    setStored({ ...bindings, [action]: binding });
    return true;
  }

  function resetAll() {
    feedback.clearError();
    setStored(defaultShortcuts);
  }

  const hasChanges =
    !parsed.success ||
    shortcutActions.some(({ id }) => !sameShortcut(bindings[id], defaultShortcuts[id]));

  return { bindings, setBinding, resetAll, hasChanges, feedback };
}

export type ShortcutController = ReturnType<typeof useShortcuts>;
