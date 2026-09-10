import { Info } from 'lucide-react';
import { useId } from 'react';

export function LibraryInfo({ label, children }: { label: string; children: string }) {
  const tooltipId = useId();

  return (
    <span className="library-info">
      <button
        type="button"
        className="icon-button library-info__trigger"
        aria-label={label}
        aria-describedby={tooltipId}
      >
        <Info size={15} />
      </button>
      <p className="library-info__bubble" id={tooltipId} role="tooltip">
        {children}
      </p>
    </span>
  );
}
