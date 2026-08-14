import { CloudOff, Copy } from 'lucide-react';
import { Modal } from '../shared/components/Modal.js';
import { ShortcutList } from '../shared/components/ShortcutList.js';
import type { ImageMetadataController } from '../features/editor/use-image-metadata.js';
import { buildRunCodeExample } from '../features/generation/code-sample.js';
import type { ModalName } from './use-studio-navigation.js';

const titles = {
  code: 'Get code',
  request: 'Request preview',
  metadata: 'Generated image metadata',
  shortcuts: 'Keyboard shortcuts',
} as const;

interface StudioModalsProps {
  modal: Exclude<ModalName, null>;
  requestBody: unknown;
  metadata: ImageMetadataController;
  onClose: () => void;
  onCopy: (value: string, message?: string) => Promise<void>;
}

/** Request previews stay local: only the exact submitted payload is shown. */
export function StudioModals({ modal, requestBody, metadata, onClose, onCopy }: StudioModalsProps) {
  const requestJson = JSON.stringify(requestBody, null, 2);
  const codeExample = buildRunCodeExample(requestBody);

  return (
    <Modal title={titles[modal]} onClose={onClose}>
      {modal === 'shortcuts' ? (
        <ShortcutList />
      ) : modal === 'metadata' ? (
        metadata.metadataError ? (
          <div className="metadata-error">
            <CloudOff size={22} />
            <p>{metadata.metadataError}</p>
          </div>
        ) : metadata.metadata === undefined ? (
          <div className="metadata-loading">
            <span className="loader-ring" />
            <p>Loading authoritative sidecar metadata…</p>
          </div>
        ) : (
          <>
            <div className="code-toolbar">
              <span>Versioned image sidecar</span>
              <button
                className="text-button"
                onClick={() => {
                  void onCopy(JSON.stringify(metadata.metadata, null, 2));
                }}
              >
                <Copy size={15} /> Copy
              </button>
            </div>
            <pre className="code-block metadata-code">
              <code>{JSON.stringify(metadata.metadata, null, 2)}</code>
            </pre>
          </>
        )
      ) : (
        <>
          <div className="code-toolbar">
            <span>{modal === 'code' ? 'JavaScript' : 'JSON'}</span>
            <button
              className="text-button"
              onClick={() => {
                void onCopy(modal === 'code' ? codeExample : requestJson);
              }}
            >
              <Copy size={15} /> Copy
            </button>
          </div>
          <pre className="code-block">
            <code>{modal === 'code' ? codeExample : requestJson}</code>
          </pre>
          <p className="modal-note">
            Credentials remain in the loopback server. The browser only submits the exact prompt,
            explicit model settings, and chosen destination.
          </p>
        </>
      )}
    </Modal>
  );
}
