import { FolderTree, X } from 'lucide-react';

/** Surfaces a non-default save target so it is visible and reversible. */
export function DestinationPill({ label, onReset }: { label: string; onReset: () => void }) {
  return (
    <button
      type="button"
      className="destination-pill"
      onClick={onReset}
      title="Save to the main repository instead"
      aria-label={`Saving to ${label}. Save to the main repository instead.`}
    >
      <FolderTree size={14} aria-hidden="true" />
      <span>Saving to {label}</span>
      <X size={14} aria-hidden="true" />
    </button>
  );
}
