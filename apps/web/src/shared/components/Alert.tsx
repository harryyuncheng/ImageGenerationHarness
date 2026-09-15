import { CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AlertController, AlertTone } from '../hooks/use-alert.js';

const toneIcon: Record<AlertTone, typeof Info> = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

export function Alert({ feedback }: { feedback: AlertController }) {
  if (feedback.alert === undefined) return null;
  const { tone, message } = feedback.alert;
  const Icon = toneIcon[tone];

  return (
    <div
      className="studio-alert surface-enter"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="studio-alert__icon" size={15} aria-hidden="true" />
      <span>{message}</span>
      <button type="button" onClick={feedback.clearAlert} aria-label="Dismiss message">
        <X size={13} />
      </button>
    </div>
  );
}

/** Keeps concurrent alerts from several controllers on one rhythm. */
export function AlertStack({ children }: { children: ReactNode }) {
  return <div className="alert-stack">{children}</div>;
}
