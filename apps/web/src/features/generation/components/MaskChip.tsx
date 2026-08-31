import { SquareDashedMousePointer } from 'lucide-react';
import { useState } from 'react';
import type { UploadAttachment } from '../../../shared/types/attachments.js';
import type { Capability } from '../../../shared/types/domain.js';
import { hasParameter } from '../capabilities.js';
import { maskAttachment } from '../mask.js';
import { MaskEditor } from './MaskEditor.js';

/** Stays visible but disabled without a source image, so the capability is discoverable early. */
export function MaskChip({
  capability,
  source,
  hasMask,
  onMaskChange,
}: {
  capability: Capability;
  source: UploadAttachment | undefined;
  hasMask: boolean;
  onMaskChange: (mask: UploadAttachment) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!hasParameter(capability, 'mask')) return null;

  return (
    <>
      <button
        type="button"
        className={`tool-chip tool-chip--mask ${hasMask ? 'selected' : ''}`}
        disabled={source === undefined}
        title={
          source === undefined
            ? 'Attach a source image to draw a mask'
            : 'Draw the area this tool should change'
        }
        onClick={() => {
          setOpen(true);
        }}
      >
        <SquareDashedMousePointer size={16} />
        <span>{hasMask ? 'Edit mask' : 'Draw mask'}</span>
      </button>
      {open && source && (
        <MaskEditor
          source={source}
          capability={capability}
          onCancel={() => {
            setOpen(false);
          }}
          onSave={(encoded) => {
            onMaskChange(maskAttachment(encoded));
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
