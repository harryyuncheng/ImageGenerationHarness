import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DialogController } from '../hooks/use-dialogs.js';

const dialogId = 'studio-dialog';

export function StudioDialog({ dialogs }: { dialogs: DialogController }) {
  const { request, submit, cancel } = dialogs;
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!request) return;
    setValue(request.kind === 'prompt' ? (request.initialValue ?? '') : '');
    const frame = window.requestAnimationFrame(() => {
      input.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Stops the owning surface, such as the style guide, from closing underneath.
      event.stopPropagation();
      cancel();
    };
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [request, cancel]);

  if (!request) return null;

  const canSubmit =
    request.kind === 'confirm' || request.allowEmpty === true || value.trim().length > 0;

  return createPortal(
    <div
      className="studio-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <form
        className="studio-dialog surface-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) submit(value.trim());
        }}
      >
        <h2 id={`${dialogId}-title`}>{request.title}</h2>
        {request.body && <p>{request.body}</p>}

        {request.kind === 'prompt' && (
          <label className="studio-dialog__field">
            <span>{request.label}</span>
            <input
              ref={input}
              value={value}
              placeholder={request.placeholder ?? ''}
              onChange={(event) => {
                setValue(event.target.value);
              }}
            />
          </label>
        )}

        <div className="studio-dialog__actions">
          <button type="button" className="text-button" onClick={cancel}>
            Cancel
          </button>
          <button
            type="submit"
            className={`primary-small ${request.kind === 'confirm' && request.danger ? 'primary-small--danger' : ''}`}
            disabled={!canSubmit}
          >
            {request.confirmLabel}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
