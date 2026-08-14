import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Modal({
  title,
  className,
  onClose,
  children,
}: {
  title: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop surface-enter" onMouseDown={onClose}>
      <section
        className={`modal surface-enter ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
