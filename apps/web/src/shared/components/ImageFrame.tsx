import type { ReactNode } from 'react';
import type { StudioImage } from '../images/studio-image.js';

export function ImageFrame({
  image,
  aspectRatio,
  surface,
  children,
}: {
  image: StudioImage | undefined;
  aspectRatio: number;
  surface: 'canvas' | 'gallery';
  children: ReactNode;
}) {
  return (
    <div
      className="image-frame"
      data-sheet-surface={surface}
      data-sheet-image-id={image?.id}
      data-image-id={image?.saved?.imageId}
      data-run-id={image?.runId}
      data-output-index={image?.outputIndex}
      style={{
        aspectRatio: String(aspectRatio),
        width: `min(100cqw, calc(100cqh * ${String(aspectRatio)}))`,
      }}
    >
      {children}
    </div>
  );
}

export function ImageSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className="image-skeleton" role="status">
      <span className="visually-hidden">{children}</span>
    </div>
  );
}
