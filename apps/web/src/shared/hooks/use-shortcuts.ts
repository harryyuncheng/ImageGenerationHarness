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
import { useAlert } from './use-alert.js';
import { usePersistentState } from './use-persistent-state.js';

export function useShortcuts() {
  const [stored, setStored] = usePersistentState<unknown>('harness-shortcuts', defaultShortcuts);
  const parsed = useMemo(() => shortcutBindingsSchema.safeParse(stored), [stored]);
  const bindings = parsed.success ? parsed.data : defaultShortcuts;
  const feedback = useAlert();
  const { reportWarning } = feedback;

  useEffect(() => {
    if (!parsed.success) {
      reportWarning('Saved shortcuts are invalid. Defaults are active; Reset all restores them.');
    }
  }, [parsed, reportWarning]);

  function setBinding(action: ShortcutAction, binding: ShortcutBinding | null): boolean {
    const error = shortcutBindingError(bindings, action, binding);
    if (error) {
      feedback.reportError(error);
      return false;
    }
    feedback.clearAlert();
    setStored({ ...bindings, [action]: binding });
    return true;
  }

  function resetAll() {
    feedback.clearAlert();
    setStored(defaultShortcuts);
  }

  const hasChanges =
    !parsed.success ||
    shortcutActions.some(({ id }) => !sameShortcut(bindings[id], defaultShortcuts[id]));

  return { bindings, setBinding, resetAll, hasChanges, feedback };
}

export type ShortcutController = ReturnType<typeof useShortcuts>;
