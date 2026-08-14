import { Clock3 } from 'lucide-react';
import { EmptyState } from '../../../shared/components/EmptyState.js';
import type { StudioRun } from '../run-presentation.js';
import { HistoryCard } from './HistoryCard.js';

export function HistoryView({
  runs,
  onCreate,
  onOpenRun,
  onFavorite,
}: {
  runs: StudioRun[];
  onCreate: () => void;
  onOpenRun: (run: StudioRun) => void;
  onFavorite: (runId: string) => void;
}) {
  return (
    <div className="library-page history-page surface-enter">
      <div className="library-heading">
        <h2>Generation history</h2>
      </div>
      {runs.length === 0 ? (
        <EmptyState
          Icon={Clock3}
          title="No generations here yet"
          body="Generated images saved in this repository will appear here in chronological order."
          action="Create an image"
          onAction={onCreate}
        />
      ) : (
        <div className="history-grid">
          {runs.map((run) => (
            <HistoryCard key={run.id} run={run} onOpen={onOpenRun} onFavorite={onFavorite} />
          ))}
        </div>
      )}
    </div>
  );
}
