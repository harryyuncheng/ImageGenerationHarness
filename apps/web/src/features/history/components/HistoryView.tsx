import { CloudOff, FolderOpen, Image as ImageIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '../../../shared/components/EmptyState.js';
import { GeneratedImageCard } from '../../../shared/components/GeneratedImageCard.js';
import { toStudioImages, type StudioImage } from '../../../shared/images/studio-image.js';
import type { GalleryImage } from '../../../shared/types/domain.js';
import type { StudioRun } from '../run-presentation.js';

export function HistoryView({
  runs,
  images,
  imagesRequestedAt,
  feedback,
  hasRepository,
  isLoading,
  error,
  onCreate,
  onChooseRepository,
  onRetry,
  onOpenImage,
}: {
  runs: StudioRun[];
  images: GalleryImage[];
  imagesRequestedAt: number;
  feedback: ReactNode;
  hasRepository: boolean;
  isLoading: boolean;
  error?: string;
  onCreate: () => void;
  onChooseRepository: () => void;
  onRetry: () => void;
  onOpenImage: (image: StudioImage) => void;
}) {
  const studioImages = toStudioImages(images, runs, imagesRequestedAt);

  return (
    <div className="history-page gallery-page">
      {feedback}
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
