import type { ParsedLocation } from '@tanstack/react-router';
import { studioSearchSchema } from './studio-search.js';

type Surface = 'canvas' | 'gallery';
type Frame = Pick<DOMRectReadOnly, 'x' | 'y' | 'width' | 'height'>;

let camera:
  | {
      surface: Surface;
      imageId: string;
      source: Frame;
    }
  | undefined;

function positionCamera(source: Frame, target: Frame) {
  const scale = target.width / source.width;
  const fromX = source.x + source.width / 2;
  const fromY = source.y + source.height / 2;
  const toX = target.x + target.width / 2;
  const toY = target.y + target.height / 2;
  const style = document.documentElement.style;
  style.setProperty('--sheet-from-origin', `${String(fromX)}px ${String(fromY)}px`);
  style.setProperty('--sheet-to-origin', `${String(toX)}px ${String(toY)}px`);
  style.setProperty(
    '--sheet-from-transform',
    `translate3d(${String(toX - fromX)}px, ${String(toY - fromY)}px, 0) scale(${String(scale)})`,
  );
  style.setProperty(
    '--sheet-to-transform',
    `translate3d(${String(fromX - toX)}px, ${String(fromY - toY)}px, 0) scale(${String(1 / scale)})`,
  );
}

function visibleFrame(image: HTMLElement | null) {
  const bounds = image?.getBoundingClientRect();
  return bounds &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.bottom > 0 &&
    bounds.top < window.innerHeight &&
    bounds.right > 0 &&
    bounds.left < window.innerWidth
    ? bounds
    : undefined;
}

export function sheetTransitionTypes({
  fromLocation,
  toLocation,
}: {
  fromLocation?: ParsedLocation;
  toLocation: ParsedLocation;
}): ['sheet-in' | 'sheet-out'] | false {
  camera = undefined;
  if (
    !fromLocation ||
    document.visibilityState !== 'visible' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return false;
  const fromGallery = fromLocation.pathname.startsWith('/gallery');
  const toGallery = toLocation.pathname.startsWith('/gallery');
  if (fromGallery === toGallery || (!toGallery && toLocation.pathname !== '/')) return false;

  delete document.documentElement.dataset['sheetImageConnected'];
  for (const image of document.querySelectorAll<HTMLElement>('[data-sheet-transition-image]')) {
    delete image.dataset['sheetTransitionImage'];
  }
  const search = studioSearchSchema.parse(toLocation.search);
  const outputSelector = search.job
    ? `[data-sheet-image-id="${search.job}:${String(search.output ?? 0)}"]`
    : `[data-output-index="${String(search.output ?? 0)}"]`;
  const image = toGallery
    ? document.querySelector<HTMLElement>('.canvas-origin [data-sheet-image-id]')
    : search.image
      ? document.querySelector<HTMLElement>(`.gallery-card [data-image-id="${search.image}"]`)
      : search.run
        ? document.querySelector<HTMLElement>(
            `.gallery-card [data-run-id="${search.run}"]${outputSelector}`,
          )
        : null;
  const bounds = visibleFrame(image);
  const imageId = image?.dataset['sheetImageId'];
  if (image && bounds && imageId) {
    camera = { surface: toGallery ? 'gallery' : 'canvas', imageId, source: bounds };
    image.dataset['sheetTransitionImage'] = '';
  }

  const { innerWidth: width, innerHeight: height } = window;
  const scale = toGallery ? 0.88 : 1 / 0.88;
  positionCamera(
    { x: 0, y: 0, width, height },
    {
      x: (width * (1 - scale)) / 2,
      y: (height * (1 - scale)) / 2,
      width: width * scale,
      height: height * scale,
    },
  );
  return [toGallery ? 'sheet-out' : 'sheet-in'];
}

export function connectSheetImage() {
  const pending = camera;
  camera = undefined;
  if (!pending) return;
  const image = document.querySelector<HTMLElement>(
    `.image-frame[data-sheet-surface="${pending.surface}"][data-sheet-image-id="${CSS.escape(pending.imageId)}"]`,
  );
  const bounds = visibleFrame(image);
  if (!image || !bounds) return;

  image.dataset['sheetTransitionImage'] = '';
  positionCamera(pending.source, bounds);
  const { source } = pending;
  const root = document.documentElement;
  root.dataset['sheetImageConnected'] = '';
  root.style.setProperty('--sheet-image-width', `${String(bounds.width)}px`);
  root.style.setProperty('--sheet-image-height', `${String(bounds.height)}px`);
  root.style.setProperty(
    '--sheet-image-from',
    `translate3d(${String(source.x)}px, ${String(source.y)}px, 0) scale(${String(source.width / bounds.width)}, ${String(source.height / bounds.height)})`,
  );
  root.style.setProperty(
    '--sheet-image-to',
    `translate3d(${String(bounds.x)}px, ${String(bounds.y)}px, 0) scale(1)`,
  );
}
