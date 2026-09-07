import type { PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { MaskPoint } from '../mask.js';
import { handleMaskShortcut, type MaskEditorController } from '../use-mask-editor.js';

/** Strokes use source pixels even when the displayed image is scaled. */
function sourcePoint(event: PointerEvent<HTMLCanvasElement>): MaskPoint {
  const canvas = event.currentTarget;
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

export function MaskEditor({
  image,
  editor,
  hasMask,
  toolsOpen,
  onOpenTools,
}: {
  image: HTMLImageElement | null;
  editor: MaskEditorController;
  hasMask: boolean;
  toolsOpen: boolean;
  onOpenTools: () => void;
}) {
  if (!image?.parentElement) return null;

  return createPortal(
    <canvas
      ref={editor.canvasRef}
      width={image.naturalWidth}
      height={image.naturalHeight}
      className={`mask-editor__canvas mask-editor__canvas--${editor.tool}`}
      data-editing={editor.ready}
      data-input-role={hasMask ? 'mask' : undefined}
      aria-label="Mask drawing surface"
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0 || !editor.ready) return;
        if (toolsOpen) event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        editor.beginStroke(sourcePoint(event));
      }}
      onPointerMove={(event) => {
        editor.extendStroke(sourcePoint(event));
      }}
      onPointerUp={(event) => {
        const canvas = event.currentTarget;
        if (canvas.hasPointerCapture(event.pointerId))
          canvas.releasePointerCapture(event.pointerId);
        editor.endStroke(sourcePoint(event));
      }}
      onPointerCancel={editor.cancelStroke}
      onKeyDown={(event) => {
        handleMaskShortcut(event, editor.undo);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenTools();
      }}
    />,
    image.parentElement,
  );
}
