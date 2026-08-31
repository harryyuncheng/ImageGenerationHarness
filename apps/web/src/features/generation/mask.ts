import { Eraser, PenLine, Square, type LucideIcon } from 'lucide-react';
import type { UploadAttachment } from '../../shared/types/attachments.js';
import type { Capability } from '../../shared/types/domain.js';

export const maskTools = [
  {
    id: 'box',
    label: 'Box',
    description: 'Drag a rectangle over the area to change',
    icon: Square,
  },
  { id: 'pen', label: 'Pen', description: 'Paint the area to change freehand', icon: PenLine },
  { id: 'eraser', label: 'Eraser', description: 'Remove part of the selection', icon: Eraser },
] as const satisfies readonly {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}[];

export type MaskTool = (typeof maskTools)[number]['id'];

export interface MaskPoint {
  x: number;
  y: number;
}

export interface MaskStroke {
  tool: MaskTool;
  /** Brush width in source pixels; unused by the box tool. */
  size: number;
  points: readonly MaskPoint[];
}

export const MIN_BRUSH_SIZE = 4;
export const MAX_BRUSH_SIZE = 256;
/** Drawn opaque so the canvas doubles as the export alpha source; the display fades it in CSS. */
const SELECTION_COLOR = '#4f9cff';

function applyStroke(context: CanvasRenderingContext2D, stroke: MaskStroke): void {
  context.save();
  context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  context.fillStyle = SELECTION_COLOR;
  context.strokeStyle = SELECTION_COLOR;
  const first = stroke.points.at(0);
  const last = stroke.points.at(-1);
  if (!first || !last) {
    context.restore();
    return;
  }
  if (stroke.tool === 'box') {
    context.fillRect(
      Math.min(first.x, last.x),
      Math.min(first.y, last.y),
      Math.abs(last.x - first.x),
      Math.abs(last.y - first.y),
    );
    context.restore();
    return;
  }
  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }
  context.lineWidth = stroke.size;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of stroke.points.slice(1)) context.lineTo(point.x, point.y);
  context.stroke();
  context.restore();
}

export function paintSelection(
  canvas: HTMLCanvasElement,
  strokes: readonly MaskStroke[],
  draft: MaskStroke | undefined,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) applyStroke(context, stroke);
  if (draft) applyStroke(context, draft);
}

export function selectionIsEmpty(canvas: HTMLCanvasElement): boolean {
  const context = canvas.getContext('2d');
  if (!context) return true;
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 3; index < data.length; index += 4) {
    if ((data[index] ?? 0) > 0) return false;
  }
  return true;
}

/**
 * The two providers want opposite encodings of the same selection: Stability reads a
 * black-and-white mask where white is edited, while GPT Image edits wherever the mask is
 * fully transparent. Both are derived here so a drawn mask works on either target.
 */
export function usesTransparencyMask(capability: Capability): boolean {
  return capability.providerId === 'azure-foundry';
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function exportMask(
  selection: HTMLCanvasElement,
  capability: Capability,
): string | undefined {
  const output = createCanvas(selection.width, selection.height);
  const context = output.getContext('2d');
  if (!context) return undefined;
  context.fillStyle = '#000000';
  context.fillRect(0, 0, output.width, output.height);
  if (usesTransparencyMask(capability)) {
    context.globalCompositeOperation = 'destination-out';
    context.drawImage(selection, 0, 0);
  } else {
    const white = createCanvas(selection.width, selection.height);
    const whiteContext = white.getContext('2d');
    if (!whiteContext) return undefined;
    whiteContext.fillStyle = '#ffffff';
    whiteContext.fillRect(0, 0, white.width, white.height);
    whiteContext.globalCompositeOperation = 'destination-in';
    whiteContext.drawImage(selection, 0, 0);
    context.drawImage(white, 0, 0);
  }
  return output.toDataURL('image/png').split(',')[1];
}

/** A drawn mask enters the composer as an ordinary upload so staging treats it like any input. */
export function maskAttachment(encoded: string): UploadAttachment {
  return {
    source: 'upload',
    id: crypto.randomUUID(),
    name: 'mask.png',
    mediaType: 'image/png',
    byteLength: Math.floor((encoded.length * 3) / 4),
    data: encoded,
    previewUrl: `data:image/png;base64,${encoded}`,
  };
}
