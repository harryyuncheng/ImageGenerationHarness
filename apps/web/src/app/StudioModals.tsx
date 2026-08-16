import { CloudOff, Copy } from 'lucide-react';
import { Modal } from '../shared/components/Modal.js';
import type { ImageMetadataController } from '../features/editor/use-image-metadata.js';
import { buildRunCodeExample } from '../features/generation/code-sample.js';
import type { ModalName } from './use-studio-navigation.js';

const titles = {
  code: 'Get code',
  request: 'Request preview',
  metadata: 'Generated image metadata',
} as const;

interface StudioModalsProps {
  modal: Exclude<ModalName, null>;
  requestBody: unknown;
  metadata: ImageMetadataController;
  onClose: () => void;
  onCopy: (value: string, message?: string) => Promise<void>;
}

function CodePreview({
  label,
  value,
  metadata = false,
  onCopy,
}: {
  label: string;
  value: string;
  metadata?: boolean;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <>
      <div className="code-toolbar">
        <span>{label}</span>
        <button
          className="text-button"
          onClick={() => {
            void onCopy(value);
          }}
        >
          <Copy size={15} /> Copy
        </button>
      </div>
      <pre className={`code-block${metadata ? ' metadata-code' : ''}`}>
        <code>{value}</code>
      </pre>
    </>
  );
}

/** Request previews stay local: only the exact submitted payload is shown. */
export function StudioModals({ modal, requestBody, metadata, onClose, onCopy }: StudioModalsProps) {
  const requestJson = JSON.stringify(requestBody, null, 2);
  const codeExample = buildRunCodeExample(requestBody);
  const metadataJson =
    metadata.metadata === undefined ? undefined : JSON.stringify(metadata.metadata, null, 2);

  return (
    <Modal title={titles[modal]} onClose={onClose}>
      {modal === 'metadata' ? (
        metadata.metadataError ? (
          <div className="metadata-error">
            <CloudOff size={22} />
            <p>{metadata.metadataError}</p>
          </div>
        ) : metadataJson === undefined ? (
          <div className="metadata-loading">
            <span className="loader-ring" />
            <p>Loading authoritative sidecar metadata…</p>
          </div>
        ) : (
          <CodePreview
            label="Versioned image sidecar"
            value={metadataJson}
            metadata
            onCopy={onCopy}
          />
        )
      ) : (
        <>
          <CodePreview
            label={modal === 'code' ? 'JavaScript' : 'JSON'}
            value={modal === 'code' ? codeExample : requestJson}
            onCopy={onCopy}
          />
          <p className="modal-note">
            Credentials remain in the loopback server. The browser only submits the exact prompt,
            explicit model settings, and chosen destination.
          </p>
        </>
      )}
    </Modal>
  );
}
