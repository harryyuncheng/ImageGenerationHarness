import { ChevronLeft, ChevronRight, CloudOff } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { ImageFrame, ImageSkeleton } from '../../../shared/components/ImageFrame.js';
import { decodedImageRatios } from '../../../shared/images/files.js';
import type { Attachment } from '../../../shared/types/attachments.js';
import { isTerminalWithoutOutputStatus, type RunStatus } from '../../history/run-presentation.js';
import type { LoadedImage } from '../use-loaded-image.js';

interface SettledImage {
  url: string;
  failed: boolean;
  ratio: number;
}

export function progressMessage(status: RunStatus, hasOutput: boolean): string {
  if (hasOutput) return 'Loading image…';
  if (status === 'submitting') return 'Submitting request…';
  if (status === 'queued') return 'Waiting for the local worker…';
  if (status === 'running') return 'Generating';
  if (status === 'completed') return 'Finalizing the saved image…';
  if (status === 'cancelled') return 'This run was cancelled.';
  if (status === 'interrupted') return 'The server stopped during this run.';
  return 'Generation failed.';
}

export function ImageViewer({
  image,
  children,
  onImageReady,
}: {
  image: LoadedImage | Attachment;
  children?: ReactNode;
  onImageReady?: (image: HTMLImageElement | null) => void;
}) {
  const [settled, setSettled] = useState<SettledImage>();
  const loaded = 'status' in image ? image : undefined;
  const requestedOutputCount = loaded?.requestedOutputCount ?? 1;
  const imageUrl = 'previewUrl' in image ? image.previewUrl : image.selectedOutput?.url;
  const description = 'name' in image ? image.name : image.prompt;
  const current = settled?.url === imageUrl ? settled : undefined;
  const cachedRatio = imageUrl === undefined ? undefined : decodedImageRatios.get(imageUrl);
  const failed = current?.failed === true;
  const visible = !failed && (current !== undefined || cachedRatio !== undefined);
  const unavailable =
    failed ||
    (!imageUrl &&
      loaded !== undefined &&
      !loaded.isPending &&
      isTerminalWithoutOutputStatus(loaded.status));
  const ratio = current?.ratio ?? cachedRatio ?? loaded?.aspectRatio ?? settled?.ratio ?? 1;
  const imageRef = useCallback(
    (element: HTMLImageElement | null) => {
      if (!element || (element.complete && element.naturalWidth > 0)) onImageReady?.(element);
    },
    [onImageReady],
  );

  return (
    <section
      className="loaded-image"
      aria-label="Loaded image"
      aria-busy={!visible && !unavailable}
    >
      {/* The measured ratio keeps the mask canvas aligned with the artwork. */}
      <div className={`loaded-image-figure ${unavailable ? 'loaded-image-figure--error' : ''}`}>
        {children}
        <ImageFrame image={loaded?.image} aspectRatio={ratio} surface="canvas">
          {imageUrl && (
            <img
              key={imageUrl}
              ref={imageRef}
              className={visible ? 'is-loaded' : ''}
              src={imageUrl}
              alt={description || 'Generated image'}
              draggable={false}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                decodedImageRatios.set(imageUrl, naturalWidth / naturalHeight);
                setSettled({
                  url: imageUrl,
                  failed: false,
                  ratio: naturalWidth / naturalHeight,
                });
                onImageReady?.(event.currentTarget);
              }}
              onError={() => {
                decodedImageRatios.delete(imageUrl);
                setSettled({ url: imageUrl, failed: true, ratio });
                onImageReady?.(null);
              }}
            />
          )}
          {!visible && !unavailable && (
            <ImageSkeleton>
              {progressMessage(loaded?.status ?? 'completed', imageUrl !== undefined)}
              {loaded &&
                ` ${String(requestedOutputCount)} image${requestedOutputCount === 1 ? '' : 's'} requested.`}
            </ImageSkeleton>
          )}
          {!visible && unavailable && (
            <div className="loaded-image-progress" role="status">
              <CloudOff size={26} />
              <strong>
                {failed
                  ? 'Image preview unavailable.'
                  : progressMessage(loaded?.status ?? 'completed', imageUrl !== undefined)}
              </strong>
              <small>
                {failed
                  ? loaded
                    ? 'The image may still be available through Download in the Export tab.'
                    : 'Attach the source image again to continue.'
                  : loaded?.error}
              </small>
            </div>
          )}
        </ImageFrame>
        {loaded && loaded.outputCount > 1 && (
          <>
            <button
              type="button"
              className="loaded-image-arrow loaded-image-arrow--previous"
              disabled={loaded.selectedIndex === 0}
              aria-label="Previous output"
              onClick={() => {
                loaded.showOutput(loaded.selectedIndex - 1);
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="loaded-image-arrow loaded-image-arrow--next"
              disabled={loaded.selectedIndex === loaded.outputCount - 1}
              aria-label="Next output"
              onClick={() => {
                loaded.showOutput(loaded.selectedIndex + 1);
              }}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
