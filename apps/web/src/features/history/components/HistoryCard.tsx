import { CloudOff, Image as ImageIcon, Star } from 'lucide-react';
import { generatedImageContentUrl } from '../../../shared/images/files.js';
import { isTerminalWithoutOutputStatus, type StudioRun } from '../run-presentation.js';

export function HistoryCard({
  run,
  onOpen,
  onFavorite,
}: {
  run: StudioRun;
  onOpen: (run: StudioRun) => void;
  onFavorite: (runId: string) => void;
}) {
  const firstImageId = run.outputImageIds?.at(0);
  const outputUrl = firstImageId ? generatedImageContentUrl(firstImageId) : undefined;
  const imageName = run.prompt || run.targetName;
  const terminalWithoutOutput = isTerminalWithoutOutputStatus(run.status);

  return (
    <article className={`history-card history-card--${run.status}`}>
      <button
        type="button"
        className="history-image"
        onClick={() => {
          onOpen(run);
        }}
        aria-label={`Open editor for ${imageName}`}
      >
        {outputUrl ? (
          <img src={outputUrl} alt={imageName || 'Generated image'} />
        ) : terminalWithoutOutput ? (
          <CloudOff size={30} />
        ) : run.status === 'completed' ? (
          <ImageIcon size={34} />
        ) : (
          <span className="loader-ring" />
        )}
      </button>
      <button
        type="button"
        className={`history-favorite ${run.favorite ? 'favorite' : ''}`}
        onClick={() => {
          onFavorite(run.id);
        }}
        aria-label={run.favorite ? 'Remove favorite' : 'Add favorite'}
      >
        <Star size={19} fill={run.favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
