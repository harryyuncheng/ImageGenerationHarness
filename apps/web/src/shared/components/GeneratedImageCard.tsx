import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { decodedImageRatios, generatedImageContentUrl } from '../images/files.js';
import type { StudioImage } from '../images/studio-image.js';
import { ImageFrame, ImageSkeleton } from './ImageFrame.js';

export function GeneratedImageCard({
  image,
  onOpen,
}: {
  image: StudioImage;
  onOpen: (image: StudioImage) => void;
}) {
  const [settled, setSettled] = useState<{ url: string; failed: boolean }>();
  const outputUrl = image.saved ? generatedImageContentUrl(image.saved.imageId) : undefined;
  const current = settled?.url === outputUrl ? settled : undefined;
  const cachedRatio = outputUrl === undefined ? undefined : decodedImageRatios.get(outputUrl);
  const failed = current?.failed === true;
  const visible = !failed && (current !== undefined || cachedRatio !== undefined);

  return (
    <article className="gallery-card">
      <button
        type="button"
        className="gallery-image"
        onClick={() => {
          onOpen(image);
        }}
        aria-label={`Open ${image.description}`}
        aria-busy={!visible && !failed}
      >
        <ImageFrame
          image={image}
          aspectRatio={cachedRatio ?? image.aspectRatio ?? 1}
          surface="gallery"
        >
          {outputUrl && !failed && (
            <img
              className={visible ? 'is-loaded' : ''}
              src={outputUrl}
              alt={image.description}
              loading="lazy"
              decoding="async"
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                decodedImageRatios.set(outputUrl, naturalWidth / naturalHeight);
                setSettled({ url: outputUrl, failed: false });
              }}
              onError={() => {
                decodedImageRatios.delete(outputUrl);
                setSettled({ url: outputUrl, failed: true });
              }}
            />
          )}
          {!visible && !failed && (
            <ImageSkeleton>
              {image.saved ? 'Loading image...' : 'Generating image...'}
            </ImageSkeleton>
          )}
          {failed && (
            <span className="gallery-image-unavailable">
              <ImageOff size={22} />
              Preview unavailable
            </span>
          )}
        </ImageFrame>
      </button>
    </article>
  );
}
