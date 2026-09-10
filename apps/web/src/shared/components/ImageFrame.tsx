import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { connectSheetImage } from '../../app/sheet-transition.js';
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
  const frameRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    connectSheetImage(frameRef.current, surface);
  });

  return (
    <div
      ref={frameRef}
      className="image-frame"
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
