import { Maximize2 } from 'lucide-react';
import { generatedImageContentUrl } from '../images/files.js';
import type { GalleryImage } from '../types/domain.js';

export function GeneratedImageCard({
  image,
  subtitle,
  onOpen,
}: {
  image: GalleryImage;
  subtitle: string;
  onOpen: (image: GalleryImage) => void;
}) {
  const outputUrl = generatedImageContentUrl(image.imageId);
  const imageName = image.prompt?.length ? image.prompt : 'Generated image';
  return (
    <article className="gallery-card">
      <button
        className="gallery-image"
        onClick={() => {
          onOpen(image);
        }}
        aria-label={`Load ${imageName}`}
      >
        <img src={outputUrl} alt={imageName} />
        <span className="gallery-open-hint">
          <Maximize2 size={15} /> Open
        </span>
      </button>
      <div>
        <strong>{imageName}</strong>
        <span>{subtitle}</span>
      </div>
    </article>
  );
}
