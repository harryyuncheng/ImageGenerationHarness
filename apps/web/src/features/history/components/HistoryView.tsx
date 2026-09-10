import { ChevronDown, Clock3, CloudOff, FolderOpen, Image as ImageIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '../../../shared/components/EmptyState.js';
import { GeneratedImageCard } from '../../../shared/components/GeneratedImageCard.js';
import { toStudioImages, type StudioImage } from '../../../shared/images/studio-image.js';
import type { GalleryImage } from '../../../shared/types/domain.js';
import { progressMessage } from '../../editor/components/ImageViewer.js';
import { isTerminalWithoutOutputStatus, type StudioRun } from '../run-presentation.js';

export function HistoryView({
  runs,
  images,
  imagesUpdatedAt,
  feedback,
  hasRepository,
  isLoading,
  error,
  onCreate,
  onChooseRepository,
  onRetry,
  onOpenRun,
  onOpenImage,
}: {
  runs: StudioRun[];
  images: GalleryImage[];
  imagesUpdatedAt: number;
  feedback: ReactNode;
  hasRepository: boolean;
  isLoading: boolean;
  error?: string;
  onCreate: () => void;
  onChooseRepository: () => void;
  onRetry: () => void;
  onOpenRun: (run: StudioRun) => void;
  onOpenImage: (image: StudioImage) => void;
}) {
  const retainedRuns = runs.filter((run) => isTerminalWithoutOutputStatus(run.status));
  const studioImages = toStudioImages(images, runs, imagesUpdatedAt);

  return (
    <div className="history-page gallery-page">
      {feedback}
      {retainedRuns.length > 0 && (
        <details className="sheet-activity">
          <summary>
            <Clock3 size={14} />
            Retained runs
            <span>{retainedRuns.length}</span>
            <ChevronDown size={14} />
          </summary>
          <div>
            {retainedRuns.map((run) => (
              <button
                type="button"
                key={run.id}
                onClick={() => {
                  onOpenRun(run);
                }}
              >
                <strong>{run.prompt || run.targetName}</strong>
                <span>{progressMessage(run.status, false)}</span>
              </button>
            ))}
          </div>
        </details>
      )}

      {error ? (
        <EmptyState
          Icon={CloudOff}
          title="Gallery unavailable"
          body={error}
          action="Try again"
          onAction={onRetry}
        />
      ) : isLoading ? (
        <div className="library-loading" role="status">
          <span className="loader-ring" />
          <p>Unfolding your sheet...</p>
        </div>
      ) : !hasRepository ? (
        <EmptyState
          Icon={FolderOpen}
          title="Open your image repository"
          body="Your saved images live in your local folder. Choose it to see the whole sheet."
          action="Choose repository"
          onAction={onChooseRepository}
        />
      ) : studioImages.length === 0 ? (
        <EmptyState
          Icon={ImageIcon}
          title="A little room for imagination"
          body="Make your first image at the canvas. Everything you create will find a place here."
          action="Back to canvas"
          onAction={onCreate}
        />
      ) : (
        <div className="gallery-grid" aria-label="Images, newest first">
          {studioImages.map((image) => (
            <GeneratedImageCard key={image.id} image={image} onOpen={onOpenImage} />
          ))}
        </div>
      )}
    </div>
  );
}
