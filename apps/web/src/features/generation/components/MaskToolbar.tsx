import { Trash2, Undo2, Upload } from 'lucide-react';
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, maskTools } from '../mask.js';
import { handleMaskShortcut, type MaskEditorController } from '../use-mask-editor.js';

export function MaskToolbar({
  editor,
  onUpload,
}: {
  editor: MaskEditorController;
  onUpload: () => void;
}) {
  return (
    <div
      className="mask-editor__tools"
      onKeyDown={(event) => {
        handleMaskShortcut(event, editor.undo);
      }}
    >
      <div className="mask-editor__row">
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
                aria-label={entry.label}
                className={`tool-chip ${selected ? 'selected' : ''}`}
                title={`${entry.label}: ${entry.description}`}
                disabled={!editor.ready}
                onClick={() => {
                  editor.setTool(entry.id);
                }}
              >
                <Icon size={15} />
              </button>
            );
          })}
        </div>

        <div className="mask-editor__history">
          <button
            type="button"
            className="tool-chip"
            title="Undo"
            aria-label="Undo"
            disabled={!editor.ready || !editor.canUndo}
            onClick={editor.undo}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            className="tool-chip"
            title="Clear"
            aria-label="Clear"
            disabled={!editor.canClear}
            onClick={editor.clear}
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className="tool-chip"
            title="Upload mask"
            aria-label="Upload mask"
            onClick={onUpload}
          >
            <Upload size={15} />
          </button>
        </div>
      </div>

      {editor.tool !== 'box' && (
        <label className="mask-editor__brush">
          <input
            type="range"
            aria-label="Brush size"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={editor.brushSize}
            onChange={(event) => {
              editor.setBrushSize(Number(event.target.value));
            }}
          />
          <small>{editor.brushSize}px</small>
        </label>
      )}

      {editor.error ? (
        <p className="mask-editor__error" role="alert">
          {editor.error}
        </p>
      ) : !editor.ready ? (
        <p className="mask-editor__status" role="status">
          Loading image and mask...
        </p>
      ) : null}
    </div>
  );
}
