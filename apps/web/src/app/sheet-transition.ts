import type { ParsedLocation } from '@tanstack/react-router';
import { studioSearchSchema } from './studio-search.js';

type Surface = 'canvas' | 'gallery';
type Frame = Pick<DOMRectReadOnly, 'x' | 'y' | 'width' | 'height'>;

let camera:
  | {
      surface: Surface;
      imageId: string | undefined;
      source: Frame | undefined;
      positioned: boolean;
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

export function sheetTransitionTypes({
  fromLocation,
  toLocation,
}: {
  fromLocation?: ParsedLocation;
  toLocation: ParsedLocation;
}): ['sheet-in' | 'sheet-out'] | false {
  if (
    document.visibilityState !== 'visible' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return false;
  const fromGallery = fromLocation?.pathname.startsWith('/gallery') ?? false;
  const toGallery = toLocation.pathname.startsWith('/gallery');
  if (fromGallery === toGallery || (!toGallery && toLocation.pathname !== '/')) return false;

  for (const image of document.querySelectorAll<HTMLElement>('.canvas [data-sheet-image-id]')) {
    image.style.viewTransitionName = 'none';
  }
  const search = studioSearchSchema.parse(toLocation.search);
  const image = toGallery
    ? document.querySelector<HTMLElement>('.canvas-origin [data-sheet-image-id]')
    : search.image
      ? document.querySelector<HTMLElement>(`.gallery-card [data-image-id="${search.image}"]`)
      : search.run
        ? document.querySelector<HTMLElement>(
            `.gallery-card [data-run-id="${search.run}"][data-output-index="${String(search.output ?? 0)}"]`,
          )
        : null;
  const bounds = image?.getBoundingClientRect();
  const visible =
    image !== null &&
    bounds !== undefined &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.bottom > 0 &&
    bounds.top < window.innerHeight &&
    bounds.right > 0 &&
    bounds.left < window.innerWidth;

  camera = {
    surface: toGallery ? 'gallery' : 'canvas',
    imageId: visible ? image.dataset['sheetImageId'] : undefined,
    source: visible ? bounds : undefined,
    positioned: false,
  };
  if (visible) {
    image.style.viewTransitionName = 'sheet-image';
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

export function connectSheetImage(image: HTMLElement | null, surface: Surface) {
  if (
    !image ||
    !camera?.source ||
    camera.surface !== surface ||
    camera.positioned ||
    image.dataset['sheetImageId'] !== camera.imageId
  )
    return;
  const bounds = image.getBoundingClientRect();
  if (
    bounds.width === 0 ||
    bounds.height === 0 ||
    bounds.bottom <= 0 ||
    bounds.top >= window.innerHeight ||
    bounds.right <= 0 ||
    bounds.left >= window.innerWidth
  )
    return;
  image.style.viewTransitionName = 'sheet-image';
  // One affine camera move drives both snapshots; never retarget it during playback.
  positionCamera(camera.source, bounds);
  camera.positioned = true;
}
