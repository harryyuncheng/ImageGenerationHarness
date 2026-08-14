import { X } from 'lucide-react';
import { formatBytes } from '../../../shared/format.js';
import type { Attachment } from '../../../shared/types/attachments.js';
import type { Capability } from '../../../shared/types/domain.js';
import { attachmentRole } from '../model-presentation.js';

export function AttachmentStrip({
  attachments,
  capability,
  onRemove,
}: {
  attachments: readonly Attachment[];
  capability: Capability;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="attachment-strip">
      {attachments.map((attachment, index) => (
        <div className="attachment" key={attachment.id}>
          <img src={attachment.previewUrl} alt="" />
          <span>
            <strong>{attachmentRole(capability, index)}</strong>
            <small>
              {attachment.name} · {formatBytes(attachment.byteLength)}
            </small>
          </span>
          <button
            type="button"
            onClick={() => {
              onRemove(attachment.id);
            }}
            aria-label={`Remove ${attachment.name}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
