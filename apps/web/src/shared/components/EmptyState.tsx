import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  Icon,
  title,
  body,
  action,
  onAction,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={30} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      <button className="primary-small" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}
