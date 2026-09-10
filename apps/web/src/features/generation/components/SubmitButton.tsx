import { RefreshCw, WandSparkles, X } from 'lucide-react';
import {
  formatShortcut,
  shortcutAriaKeys,
  type ShortcutBinding,
} from '../../../shared/shortcuts.js';

/** Cancelling replaces generating while the loaded run still has droppable work. */
export function SubmitButton({
  isSubmitting,
  blockedReason,
  shortcut,
  onCancel,
}: {
  isSubmitting: boolean;
  blockedReason: string | undefined;
  shortcut: ShortcutBinding | null;
  onCancel?: () => void;
}) {
  if (onCancel) {
    return (
      <button
        className="generate-button generate-button--cancel"
        type="button"
        title="Cancel queued generation"
        onClick={onCancel}
      >
        <X size={17} />
        <span>Cancel</span>
      </button>
    );
  }

  return (
    <button
      className="generate-button"
      type="submit"
      disabled={isSubmitting || blockedReason !== undefined}
      title={blockedReason ?? (shortcut ? `Generate (${formatShortcut(shortcut)})` : 'Generate')}
      aria-keyshortcuts={shortcutAriaKeys(shortcut)}
    >
      {isSubmitting ? <RefreshCw className="spin" size={18} /> : <WandSparkles size={17} />}
      <span>Generate</span>
    </button>
  );
}
