import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type {
  Attachment,
  MaskAttachment,
  UploadAttachment,
} from '../../shared/types/attachments.js';
import type { Capability } from '../../shared/types/domain.js';
import {
  SELECTION_COLOR,
  exportMask,
  maskAttachment,
  paintSelection,
  selectionIsEmpty,
  usesTransparencyMask,
  type MaskPoint,
  type MaskStroke,
  type MaskTool,
} from './mask.js';

export function handleMaskShortcut(event: KeyboardEvent<HTMLElement>, undo: () => void) {
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
  }
}

export function useMaskEditor(
  image: HTMLImageElement | null,
  source: Attachment | undefined,
  mask: MaskAttachment | undefined,
  capability: Capability,
  onChange: (source: Attachment, mask: UploadAttachment | undefined) => void,
  onStatusChange: (sourceId: string, message: string | undefined) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<MaskTool>('box');
  const [brushSize, setBrushSize] = useState(48);
  const [strokes, setStrokes] = useState<readonly MaskStroke[]>([]);
  // Pointer-up must see the latest move even before React finishes a render.
  const draft = useRef<MaskStroke | undefined>(undefined);
  const [savedMask, setSavedMask] = useState<{ url: string; canvas: HTMLCanvasElement }>();
  const [error, setError] = useState<string>();
  const publishedUrl = useRef<string | undefined>(undefined);
  const maskUrl = mask?.previewUrl;
  const targetEncoding = usesTransparencyMask(capability) ? 'alpha' : 'luminance';
  const storedEncoding = mask?.maskEncoding ?? targetEncoding;
  const base = savedMask?.canvas;
  const ready =
    image !== null &&
    error === undefined &&
    (maskUrl === publishedUrl.current || savedMask?.url === maskUrl);
  const reportError = useCallback(
    (message: string) => {
      setError(message);
      if (source) onStatusChange(source.id, message);
    },
    [source?.id, onStatusChange],
  );

  useEffect(() => {
    if (!source) return;
    if (!image) {
      onStatusChange(source.id, 'Loading the source image.');
      return;
    }
    if (maskUrl !== undefined && maskUrl === publishedUrl.current) {
      onStatusChange(source.id, undefined);
      return;
    }
    setStrokes([]);
    draft.current = undefined;
    setSavedMask(undefined);
    setError(undefined);
    if (!maskUrl) {
      publishedUrl.current = undefined;
      onStatusChange(source.id, undefined);
      return;
    }
    onStatusChange(source.id, 'Loading the mask.');
    const saved = new Image();
    saved.onload = () => {
      if (
        saved.naturalWidth !== image.naturalWidth ||
        saved.naturalHeight !== image.naturalHeight
      ) {
        reportError('The mask must match the source image dimensions.');
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reportError('This browser could not render the mask.');
        return;
      }
      context.drawImage(saved, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        pixels.data[index + 3] =
          storedEncoding === 'alpha'
            ? 255 - (pixels.data[index + 3] ?? 255)
            : (pixels.data[index] ?? 0);
      }
      context.putImageData(pixels, 0, 0);
      context.globalCompositeOperation = 'source-in';
      context.fillStyle = SELECTION_COLOR;
      context.fillRect(0, 0, canvas.width, canvas.height);
      setSavedMask({ url: maskUrl, canvas });
      if (storedEncoding !== targetEncoding) {
        const encoded = exportMask(canvas, capability);
        if (!encoded) {
          reportError('This browser could not render the mask.');
          return;
        }
        const converted = maskAttachment(encoded, capability);
        publishedUrl.current = converted.previewUrl;
        onChange(source, converted);
      }
      onStatusChange(source.id, undefined);
    };
    saved.onerror = () => {
      reportError('The mask could not be loaded.');
    };
    saved.src = maskUrl;
    return () => {
      saved.onload = null;
      saved.onerror = null;
    };
  }, [
    image,
    source?.id,
    maskUrl,
    storedEncoding,
    targetEncoding,
    onChange,
    onStatusChange,
    reportError,
  ]);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      if (!canvas.getContext('2d')) reportError('This browser could not render the mask.');
      else paintSelection(canvas, base, strokes, draft.current);
    }
  }, [base, strokes, reportError]);

  useLayoutEffect(repaint, [repaint, image, maskUrl]);

  function publish(next: readonly MaskStroke[], background: HTMLCanvasElement | undefined) {
    const canvas = canvasRef.current;
    if (!canvas?.getContext('2d') || !source) {
      reportError('The source image is not ready for masking.');
      return;
    }
    paintSelection(canvas, background, next, undefined);
    const empty = selectionIsEmpty(canvas);
    const encoded = empty ? undefined : exportMask(canvas, capability);
    if (!empty && !encoded) {
      reportError('This browser could not render the mask.');
      return;
    }
    const nextMask = encoded ? maskAttachment(encoded, capability) : undefined;
    publishedUrl.current = nextMask?.previewUrl;
    onChange(source, nextMask);
    setError(undefined);
  }

  function beginStroke(point: MaskPoint) {
    if (!source) return;
    onStatusChange(source.id, 'Finish the current mask stroke before generating.');
    draft.current = { tool, size: brushSize, points: [point] };
    repaint();
  }

  function extendStroke(point: MaskPoint) {
    const stroke = draft.current;
    if (!stroke) return undefined;
    // A box only needs its opposite corners, so the draft never accumulates interior points.
    const points =
      stroke.tool === 'box' ? [stroke.points[0] ?? point, point] : [...stroke.points, point];
    const next: MaskStroke = { ...stroke, points };
    draft.current = next;
    repaint();
    return next;
  }

  function endStroke(point: MaskPoint) {
    const committed = extendStroke(point);
    if (!committed) return;
    draft.current = undefined;
    const next = [...strokes, committed];
    setStrokes(next);
    publish(next, base);
  }

  function undo() {
    const next = strokes.slice(0, -1);
    setStrokes(next);
    draft.current = undefined;
    publish(next, base);
  }

  function clear() {
    setStrokes([]);
    draft.current = undefined;
    setSavedMask(undefined);
    setError(undefined);
    publishedUrl.current = undefined;
    if (source) {
      onChange(source, undefined);
      onStatusChange(source.id, undefined);
    }
  }

  return {
    canvasRef,
    ready,
    error,
    tool,
    setTool,
    brushSize,
    setBrushSize,
    canUndo: strokes.length > 0,
    canClear: mask !== undefined || base !== undefined || strokes.length > 0,
    beginStroke,
    extendStroke,
    endStroke,
    cancelStroke: () => {
      draft.current = undefined;
      repaint();
      if (source) onStatusChange(source.id, undefined);
    },
    undo,
    clear,
  };
}

export type MaskEditorController = ReturnType<typeof useMaskEditor>;
