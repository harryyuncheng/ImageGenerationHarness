import { Redo2, Trash2 } from 'lucide-react';
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, maskTools } from '../mask.js';
import type { MaskEditorController } from '../use-mask-editor.js';

export function MaskToolbar({
  editor,
  onCancel,
  onSave,
}: {
  editor: MaskEditorController;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <footer className="mask-editor__tools">
      <div className="mask-editor__tool-group" role="radiogroup" aria-label="Mask tool">
        {maskTools.map((entry) => {
          const Icon = entry.icon;
          const selected = entry.id === editor.tool;
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`tool-chip ${selected ? 'selected' : ''}`}
              title={entry.description}
              onClick={() => {
                editor.setTool(entry.id);
              }}
            >
              <Icon size={15} />
              <span>{entry.label}</span>
            </button>
          );
        })}
      </div>

      {editor.tool !== 'box' && (
        <label className="mask-editor__brush">
          <span>Brush</span>
          <input
            type="range"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={editor.brushSize}
            onChange={(event) => {
              editor.changeBrushSize(Number(event.target.value));
            }}
          />
          <small>{editor.brushSize}px</small>
        </label>
      )}

      <div className="mask-editor__actions">
        <button
          type="button"
          className="tool-chip"
          disabled={!editor.canUndo}
          onClick={editor.undo}
        >
          <Redo2 size={15} className="mask-editor__undo-icon" />
          <span>Undo</span>
        </button>
        <button
          type="button"
          className="tool-chip"
          disabled={!editor.canUndo}
          onClick={editor.clear}
        >
          <Trash2 size={15} />
          <span>Clear</span>
        </button>
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="primary-small" onClick={onSave}>
          Use mask
        </button>
      </div>
    </footer>
  );
}
