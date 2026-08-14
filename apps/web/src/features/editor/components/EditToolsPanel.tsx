import { Check, Pencil } from 'lucide-react';
import { capabilityLabel } from '../../generation/capabilities.js';
import { editToolDescription, editToolIcon } from '../edit-tools-presentation.js';
import type { EditingToolSelection } from '../use-edit-tools.js';

export function EditToolsPanel({
  selection,
  hasImage,
  onStart,
}: {
  selection: EditingToolSelection;
  hasImage: boolean;
  onStart?: () => void;
}) {
  const selectedTool =
    selection.tools.find((tool) => tool.canonicalId === selection.selectedToolId) ??
    selection.tools[0];

  return (
    <aside
      className="settings-panel settings-panel--open edit-tools-panel"
      aria-label="Editing tools"
    >
      <header className="settings-panel-header">
        <h2>Editing tools</h2>
      </header>
      <div className="settings-scroll edit-tools-scroll">
        <div className="edit-tool-summary">
          <span>Selected tool</span>
          <h3>{selectedTool ? capabilityLabel(selectedTool) : 'No tools available'}</h3>
          <p>
            {selectedTool
              ? editToolDescription(selectedTool)
              : 'No image editing capabilities are available.'}
          </p>
        </div>
        <div className="edit-tool-list" role="group" aria-label="Editing tools">
          {selection.tools.map((tool) => {
            const selected = tool.canonicalId === selectedTool?.canonicalId;
            const ToolIcon = editToolIcon(tool);
            return (
              <button
                key={tool.canonicalId}
                className={selected ? 'selected' : ''}
                aria-pressed={selected}
                onClick={() => {
                  selection.onSelectTool(tool.canonicalId);
                }}
              >
                <span>
                  <ToolIcon size={14} />
                </span>
                <span>
                  <strong>{capabilityLabel(tool)}</strong>
                  <small>{editToolDescription(tool)}</small>
                </span>
                {selected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="settings-footer edit-tool-footer">
        <p>
          {hasImage
            ? 'The selected tool will use this image as its source.'
            : 'Choose a source on the canvas. This tool selection will stay active.'}
        </p>
        {hasImage && onStart && (
          <button className="primary-small" onClick={onStart}>
            <Pencil size={15} /> Start editing
          </button>
        )}
      </div>
    </aside>
  );
}
