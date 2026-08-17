import type { Capability } from '../../../shared/types/domain.js';
import { toolbarTabs } from '../model-presentation.js';

export function ToolbarTabs({
  capabilities,
  activeCategory,
  onSelect,
}: {
  capabilities: readonly Capability[];
  activeCategory: Capability['category'];
  onSelect: (category: Capability['category']) => void;
}) {
  return (
    <div className="toolbar-tab-row">
      <div className="toolbar-tabs" role="group" aria-label="Workflow">
        {toolbarTabs.map((tab) => {
          const selected = tab.category === activeCategory;
          const available = capabilities.some((capability) => capability.category === tab.category);
          return (
            <button
              key={tab.id}
              type="button"
              className={`toolbar-tab ${selected ? 'selected' : ''}`}
              aria-pressed={selected}
              disabled={!available}
              onClick={() => {
                onSelect(tab.category);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
