import { Check, Sparkles, X } from 'lucide-react';
import type { Toast } from '../shared/hooks/use-toasts.js';

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          {toast.tone === 'success' ? (
            <Check size={16} />
          ) : toast.tone === 'error' ? (
            <X size={16} />
          ) : (
            <Sparkles size={16} />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => {
              onDismiss(toast.id);
            }}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
