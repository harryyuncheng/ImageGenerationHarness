import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UploadAttachment } from '../../../shared/types/attachments.js';
import type { Capability } from '../../../shared/types/domain.js';
import { exportMask, maskTools, selectionIsEmpty, usesTransparencyMask } from '../mask.js';
import { useMaskEditor } from '../use-mask-editor.js';
import { MaskToolbar } from './MaskToolbar.js';

const dialogId = 'mask-editor-dialog';

export function MaskEditor({
  source,
  capability,
  onCancel,
  onSave,
}: {
  source: UploadAttachment;
  capability: Capability;
  onCancel: () => void;
  onSave: (maskDataUrl: string) => void;
}) {
  const editor = useMaskEditor();
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = source.previewUrl;
  }, [source.previewUrl]);

  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (toolMenuOpen) setToolMenuOpen(false);
        else onCancel();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        editor.undo();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [editor, onCancel, toolMenuOpen]);

  function save() {
    const canvas = editor.canvasRef.current;
    if (!canvas) return;
    if (selectionIsEmpty(canvas)) {
      setError('Select an area before saving the mask.');
      return;
    }
    const encoded = exportMask(canvas, capability);
    if (!encoded) {
      setError('This browser could not render the mask.');
      return;
    }
    onSave(encoded);
  }

  const activeTool = maskTools.find((entry) => entry.id === editor.tool) ?? maskTools[0];

  return createPortal(
    <div
      className="mask-editor-backdrop surface-enter"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="mask-editor surface-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
      >
        <header className="mask-editor__header">
          <div>
            <h2 id={`${dialogId}-title`}>Mask</h2>
            <p>
              {usesTransparencyMask(capability)
                ? `${capability.name} changes only the area you select.`
                : `${capability.name} repaints only the area you select.`}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onCancel}
            aria-label="Close mask editor"
          >
            <X size={18} />
          </button>
        </header>

        <div className="mask-editor__stage">
          <img src={source.previewUrl} alt="" draggable={false} />
          {dimensions && (
            <canvas
              ref={editor.canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              className={`mask-editor__canvas mask-editor__canvas--${editor.tool}`}
              aria-label="Mask drawing surface"
              onPointerDown={editor.beginStroke}
              onPointerMove={editor.extendStroke}
              onPointerUp={editor.endStroke}
              onPointerCancel={editor.endStroke}
              onContextMenu={(event) => {
                event.preventDefault();
                setToolMenuOpen(true);
              }}
            />
          )}
        </div>

        <MaskToolbar editor={editor} onCancel={onCancel} onSave={save} />

        {error !== undefined && <p className="mask-editor__error">{error}</p>}

        {toolMenuOpen && (
          <div
            className="mask-editor__menu popover surface-enter"
            role="dialog"
            aria-label="Choose a mask tool"
          >
            <div className="composer-setting-menu-header">
              <strong>Mask tool</strong>
              <small>Currently using {activeTool.label}</small>
            </div>
            {maskTools.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`mask-editor__menu-option ${entry.id === editor.tool ? 'selected' : ''}`}
                  onClick={() => {
                    editor.setTool(entry.id);
                    setToolMenuOpen(false);
                  }}
                >
                  <Icon size={16} />
                  <span>
                    <strong>{entry.label}</strong>
                    <small>{entry.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
