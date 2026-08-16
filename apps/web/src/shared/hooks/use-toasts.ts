import { useCallback, useState } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
}

export type Notify = (message: string, tone?: ToastTone) => void;

const toastDurationMs = 3800;

interface ToastController {
  toasts: Toast[];
  notify: Notify;
  dismiss: (id: string) => void;
}

export function useToasts(): ToastController {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback<Notify>(
    (message, tone = 'info') => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, tone }]);
      window.setTimeout(() => {
        dismiss(id);
      }, toastDurationMs);
    },
    [dismiss],
  );

  return { toasts, notify, dismiss };
}
