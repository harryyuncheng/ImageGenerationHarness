import { RefreshCw, WandSparkles, X } from 'lucide-react';

/** Cancelling replaces generating while the loaded run still has droppable work. */
export function SubmitButton({
  isSubmitting,
  onCancel,
}: {
  isSubmitting: boolean;
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
      disabled={isSubmitting}
      title="Generate (⌘ Enter)"
    >
      {isSubmitting ? <RefreshCw className="spin" size={18} /> : <WandSparkles size={17} />}
      <span>Generate</span>
    </button>
  );
}
