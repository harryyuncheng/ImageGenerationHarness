import { Bookmark, Plus, Trash2, WandSparkles } from 'lucide-react';
import { EmptyState } from '../../../shared/components/EmptyState.js';

export function PresetsView({
  prompts,
  onUse,
  onDelete,
  onCreate,
}: {
  prompts: string[];
  onUse: (prompt: string) => void;
  onDelete: (prompt: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="library-page surface-enter">
      <div className="library-heading">
        <div>
          <h2>Saved presets</h2>
          <p>Reusable prompt directions stored only in this browser.</p>
        </div>
        <button className="primary-small" onClick={onCreate}>
          <Plus size={16} /> New prompt
        </button>
      </div>
      {prompts.length === 0 ? (
        <EmptyState
          Icon={Bookmark}
          title="Save your best prompts"
          body="Use Save in the composer to build a reusable prompt library."
          action="Write a prompt"
          onAction={onCreate}
        />
      ) : (
        <div className="preset-grid">
          {prompts.map((value, index) => (
            <article className="preset-card" key={value}>
              <span>Preset {String(index + 1).padStart(2, '0')}</span>
              <p>{value}</p>
              <div>
                <button
                  onClick={() => {
                    onUse(value);
                  }}
                >
                  <WandSparkles size={15} /> Use preset
                </button>
                <button
                  className="icon-button"
                  onClick={() => {
                    onDelete(value);
                  }}
                  aria-label="Delete preset"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
