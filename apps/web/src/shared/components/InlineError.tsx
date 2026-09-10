import { X } from 'lucide-react';
import type { InlineErrorController } from '../hooks/use-inline-error.js';

export function InlineError({ feedback }: { feedback: InlineErrorController }) {
  if (feedback.error === undefined) return null;

  return (
    <div className="inline-error" role="alert">
      <span>{feedback.error}</span>
      <button type="button" onClick={feedback.clearError} aria-label="Dismiss error">
        <X size={14} />
      </button>
    </div>
  );
}
