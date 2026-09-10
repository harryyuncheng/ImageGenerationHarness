import { ArrowLeft, CloudOff, Images, Search } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../../../shared/components/EmptyState.js';
import { generatedImageContentUrl } from '../../../shared/images/files.js';
import type { GalleryImage } from '../../../shared/types/domain.js';
import { useImages } from '../../gallery/use-images.js';
import { PresetCover } from './PresetCover.js';

export function PresetGalleryPicker({
  repositoryId,
  onSelect,
  onBack,
}: {
  repositoryId: string | undefined;
  onSelect: (image: GalleryImage) => void;
  onBack: () => void;
}) {
  const imagesQuery = useImages(repositoryId);
  const [search, setSearch] = useState('');
  const images = (imagesQuery.data?.images ?? []).filter((image) =>
    (image.prompt ?? '').toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="preset-gallery-picker">
      <div className="preset-picker-heading">
        <button type="button" className="text-button" onClick={onBack} autoFocus>
          <ArrowLeft size={15} /> Back to preset
        </button>
        <label className="preset-search">
          <Search size={15} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search image prompts"
            aria-label="Search gallery images"
          />
        </label>
      </div>
      <p className="preset-library-note">
        Choose a cover. The original image stays in your gallery.
      </p>
      {imagesQuery.error ? (
        <EmptyState
          Icon={CloudOff}
          title="Gallery unavailable"
          body={imagesQuery.error.message}
          action="Try again"
          onAction={() => {
            void imagesQuery.refetch();
          }}
        />
      ) : imagesQuery.isLoading ? (
        <div className="library-loading" role="status">
          <span className="loader-ring" />
          <p>Loading your gallery...</p>
        </div>
      ) : images.length === 0 ? (
        <EmptyState
          Icon={Images}
          title={search ? 'No matching images' : 'Your gallery is empty'}
          body="You can also upload a PNG, JPEG, or WebP cover from your computer."
          action="Back to preset"
          onAction={onBack}
        />
      ) : (
        <div className="style-guide-grid" role="group" aria-label="Choose a preset cover">
          {images.map((image, index) => (
            <button
              key={image.imageId}
              type="button"
              className="style-guide-folder-card"
              aria-label={`Use gallery image ${String(index + 1)} as cover`}
              title={image.prompt ?? 'Generated image'}
              onClick={() => {
                onSelect(image);
              }}
            >
              <span className="style-guide-preview">
                <PresetCover
                  src={generatedImageContentUrl(image.imageId)}
                  alt={image.prompt ?? 'Generated image'}
                />
              </span>
              <span className="style-guide-folder-label">
                <span>{image.prompt ?? 'Generated image'}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
