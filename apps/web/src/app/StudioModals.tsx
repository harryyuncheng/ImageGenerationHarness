import { Copy } from 'lucide-react';
import { Modal } from '../shared/components/Modal.js';
import { buildRunCodeExample } from '../features/generation/code-sample.js';

const titles = {
  code: 'Get code',
  request: 'Request preview',
} as const;

interface StudioModalsProps {
  modal: keyof typeof titles;
  requestBody: unknown;
  onClose: () => void;
  onCopy: (value: string, message?: string) => Promise<void>;
}

/** Request previews stay local: only the exact submitted payload is shown. */
export function StudioModals({ modal, requestBody, onClose, onCopy }: StudioModalsProps) {
  const value =
    modal === 'code' ? buildRunCodeExample(requestBody) : JSON.stringify(requestBody, null, 2);

  return (
    <Modal title={titles[modal]} onClose={onClose}>
      <div className="code-toolbar">
        <span>{modal === 'code' ? 'JavaScript' : 'JSON'}</span>
        <button
          className="text-button"
          onClick={() => {
            void onCopy(value);
          }}
        >
          <Copy size={15} /> Copy
        </button>
      </div>
      <pre className="code-block">
        <code>{value}</code>
      </pre>
      <p className="modal-note">
        Credentials remain in the loopback server. The browser only submits the exact prompt,
        explicit model settings, and chosen destination.
      </p>
    </Modal>
  );
}
