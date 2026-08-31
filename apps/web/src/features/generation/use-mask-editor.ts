import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  paintSelection,
  type MaskPoint,
  type MaskStroke,
  type MaskTool,
} from './mask.js';

/** Pointer coordinates are in CSS pixels; strokes are stored in source pixels so export is exact. */
function sourcePoint(canvas: HTMLCanvasElement, event: ReactPointerEvent): MaskPoint {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
    y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
  };
}

export function useMaskEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<MaskTool>('box');
  const [brushSize, setBrushSize] = useState(48);
  const [strokes, setStrokes] = useState<readonly MaskStroke[]>([]);
  const [draft, setDraft] = useState<MaskStroke | undefined>(undefined);

  const repaint = useCallback((next: readonly MaskStroke[], pending: MaskStroke | undefined) => {
    const canvas = canvasRef.current;
    if (canvas) paintSelection(canvas, next, pending);
  }, []);

  function beginStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    const started: MaskStroke = { tool, size: brushSize, points: [sourcePoint(canvas, event)] };
    setDraft(started);
    repaint(strokes, started);
  }

  function extendStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !draft) return;
    const point = sourcePoint(canvas, event);
    // A box only needs its opposite corners, so the draft never accumulates interior points.
    const points =
      draft.tool === 'box' ? [draft.points[0] ?? point, point] : [...draft.points, point];
    const next: MaskStroke = { ...draft, points };
    setDraft(next);
    repaint(strokes, next);
  }

  function endStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (canvas?.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!draft) return;
    const committed = [...strokes, draft];
    setStrokes(committed);
    setDraft(undefined);
    repaint(committed, undefined);
  }

  function undo() {
    const next = strokes.slice(0, -1);
    setStrokes(next);
    setDraft(undefined);
    repaint(next, undefined);
  }

  function clear() {
    setStrokes([]);
    setDraft(undefined);
    repaint([], undefined);
  }

  function changeBrushSize(value: number) {
    setBrushSize(Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, Math.round(value))));
  }

  return {
    canvasRef,
    tool,
    setTool,
    brushSize,
    changeBrushSize,
    canUndo: strokes.length > 0,
    beginStroke,
    extendStroke,
    endStroke,
    undo,
    clear,
  };
}

export type MaskEditorController = ReturnType<typeof useMaskEditor>;
