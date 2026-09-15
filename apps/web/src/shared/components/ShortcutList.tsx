import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Confirm } from '../hooks/use-dialogs.js';
import type { ShortcutController } from '../hooks/use-shortcuts.js';
import {
  defaultShortcuts,
  formatShortcut,
  sameShortcut,
  shortcutActions,
  shortcutBindingError,
  shortcutFromEvent,
  type ShortcutAction,
  type ShortcutBinding,
} from '../shortcuts.js';
import { Alert } from './Alert.js';

function focusShortcut(action: ShortcutAction) {
  window.requestAnimationFrame(() => {
    document.getElementById(`shortcut-${action}`)?.focus({ preventScroll: true });
  });
}

export function ShortcutList({
  shortcuts,
  confirm,
}: {
  shortcuts: ShortcutController;
  confirm: Confirm;
}) {
  const [editing, setEditing] = useState<ShortcutAction | null>(null);
  const [draft, setDraft] = useState<ShortcutBinding | null>(null);
  const [recordingError, setRecordingError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const draftError =
    recordingError ??
    (editing && draft ? shortcutBindingError(shortcuts.bindings, editing, draft) : undefined);

  useEffect(() => {
    input.current?.focus();
  }, [editing]);

  function closeEditor() {
    if (editing) focusShortcut(editing);
    setEditing(null);
  }

  function recordShortcut(event: KeyboardEvent<HTMLInputElement>) {
    const unmodified = !event.metaKey && !event.ctrlKey && !event.altKey;
    if (
      event.key === 'Escape' ||
      (event.key === 'Tab' && unmodified) ||
      (event.key === 'Enter' && unmodified && !event.shiftKey)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || ['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
    if (event.nativeEvent.isComposing || event.getModifierState('AltGraph')) {
      setDraft(null);
      setRecordingError('Finish composing text and release AltGr before recording a shortcut.');
      return;
    }
    setRecordingError(undefined);
    setDraft(shortcutFromEvent(event.nativeEvent));
  }

  function saveBinding(binding: ShortcutBinding | null) {
    if (editing && shortcuts.setBinding(editing, binding)) closeEditor();
  }

  return (
    <div className="shortcut-settings">
      <div className="shortcut-settings__toolbar">
        <button
          type="button"
          className="text-button"
          disabled={!shortcuts.hasChanges}
          onClick={async () => {
            if (
              await confirm({
                title: 'Reset all shortcuts?',
                body: 'Your custom bindings will be replaced with the defaults.',
                confirmLabel: 'Reset all',
              })
            ) {
              shortcuts.resetAll();
              setEditing(null);
              focusShortcut('focusPrompt');
            }
          }}
        >
          <RotateCcw size={13} aria-hidden="true" />
          Reset all
        </button>
      </div>
      <div className="settings-card settings-card--shortcuts">
        <Alert feedback={shortcuts.feedback} />
        <ul className="shortcut-list" aria-label="Keyboard shortcuts">
          {shortcutActions.map(({ id, label, scope }) => (
            <li key={id} className="shortcut-row">
              <div className="shortcut-row__main">
                <span className="shortcut-row__copy">
                  <span>{label}</span>
                  <small>{scope}</small>
                </span>
                <button
                  id={`shortcut-${id}`}
                  type="button"
                  className="shortcut-binding"
                  aria-label={`Change ${label} shortcut, ${formatShortcut(shortcuts.bindings[id])}`}
                  aria-expanded={editing === id}
                  aria-controls={editing === id ? `shortcut-${id}-editor` : undefined}
                  onClick={() => {
                    setDraft(null);
                    setRecordingError(undefined);
                    setEditing(editing === id ? null : id);
                  }}
                >
                  <kbd>{formatShortcut(shortcuts.bindings[id])}</kbd>
                </button>
                <button
                  type="button"
                  className="icon-button shortcut-reset"
                  disabled={sameShortcut(shortcuts.bindings[id], defaultShortcuts[id])}
                  aria-label={`Reset ${label} shortcut`}
                  title={`Reset to ${formatShortcut(defaultShortcuts[id])}`}
                  onClick={() => {
                    if (shortcuts.setBinding(id, defaultShortcuts[id])) {
                      setEditing(null);
                      focusShortcut(id);
                    }
                  }}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                </button>
              </div>
              {editing === id && (
                <form
                  id={`shortcut-${id}-editor`}
                  className="shortcut-editor"
                  aria-label={`Change ${label} shortcut`}
                  onKeyDown={(event) => {
                    if (event.key !== 'Escape') return;
                    event.preventDefault();
                    event.stopPropagation();
                    closeEditor();
                  }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (draft && !draftError) saveBinding(draft);
                  }}
                >
                  <input
                    ref={input}
                    readOnly
                    aria-label={`Record ${label} shortcut`}
                    aria-describedby={`shortcut-${id}-help${draftError ? ` shortcut-${id}-error` : ''}`}
                    aria-invalid={draftError !== undefined}
                    value={draft ? formatShortcut(draft) : ''}
                    placeholder="Press a shortcut"
                    onKeyDown={recordShortcut}
                  />
                  <p id={`shortcut-${id}-help`} className="shortcut-editor__hint" role="status">
                    {draftError
                      ? 'Choose another combination. Esc cancels.'
                      : draft
                        ? `Recorded ${formatShortcut(draft)}. Enter saves; Esc cancels.`
                        : 'Press Command or Ctrl with a key. Esc cancels.'}
                  </p>
                  {draftError && (
                    <p id={`shortcut-${id}-error`} className="shortcut-editor__error" role="alert">
                      {draftError}
                    </p>
                  )}
                  <div className="shortcut-editor__actions">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        saveBinding(null);
                      }}
                    >
                      Remove
                    </button>
                    <button type="button" className="text-button" onClick={closeEditor}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary-small"
                      disabled={!draft || !!draftError}
                    >
                      Save
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
          <li className="shortcut-row">
            <div className="shortcut-row__main">
              <span className="shortcut-row__copy">
                <span>Close menu or dialog</span>
                <small>Always available</small>
              </span>
              <kbd>Esc</kbd>
            </div>
          </li>
        </ul>
        <p className="shortcut-settings__note">
          Saved on this device. Tab navigation and standard text editing stay unchanged. Some
          browser and system shortcuts cannot be overridden.
        </p>
      </div>
    </div>
  );
}
