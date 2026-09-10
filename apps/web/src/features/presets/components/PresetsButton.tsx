import { Bookmark, Plus } from 'lucide-react';

export function PresetsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className="presets-button"
      aria-label="Saved presets"
      aria-haspopup="dialog"
      title="Saved presets"
      onClick={onOpen}
    >
      <span className="presets-button-mark" aria-hidden="true">
        <Bookmark size={184} />
        <span className="style-guide-tile__add">
          <Plus size={22} strokeWidth={1.5} />
        </span>
      </span>
    </button>
  );
}
