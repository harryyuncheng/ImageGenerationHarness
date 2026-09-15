import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { readFanOrigins, type FanOrigin } from './components/StyleGuideStack.js';

interface ImageFrame extends Omit<FanOrigin, 'imageId'> {
  clip: string;
}

interface Motion {
  closing: boolean;
  flights: Map<string, HTMLElement>;
  cancel: () => void;
}

const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
const unclipped = 'inset(0% 0% 0% 0%)';

function readFrame(element: HTMLElement): ImageFrame {
  const bounds = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const scale = style.scale === 'none' ? 1 : Number.parseFloat(style.scale);
  return {
    centerX: bounds.left + bounds.width / 2,
    centerY: bounds.top + bounds.height / 2,
    width: Number.parseFloat(style.width) * scale,
    height: Number.parseFloat(style.height) * scale,
    rotate: style.rotate === 'none' ? '0deg' : style.rotate,
    radius: Number.parseFloat(style.borderTopLeftRadius) * scale,
    shadow: style.boxShadow,
    clip: style.clipPath === 'none' ? unclipped : style.clipPath,
  };
}

export function useStyleGuideTransition({
  fanRef,
  origins,
  activeFolderId,
  viewedFolderId,
  onClose,
}: {
  fanRef: RefObject<HTMLButtonElement | null>;
  origins: readonly FanOrigin[];
  activeFolderId: string | null;
  viewedFolderId: string | undefined;
  onClose: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const motion = useRef<Motion | undefined>(undefined);
  const opened = useRef(false);
  const finishClose = useRef(onClose);
  finishClose.current = onClose;
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    setClosing(true);
  }, []);

  useLayoutEffect(() => {
    const fan = fanRef.current;
    const visibility = fan?.style.visibility;
    if (fan) fan.style.visibility = 'hidden';
    const settle = () => {
      const wasClosing = motion.current?.closing;
      motion.current?.cancel();
      motion.current = undefined;
      if (wasClosing) {
        backdropRef.current?.style.setProperty('opacity', '0');
        finishClose.current();
      }
    };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    window.addEventListener('resize', settle);
    preference.addEventListener('change', settle);
    return () => {
      motion.current?.cancel();
      motion.current = undefined;
      opened.current = false;
      if (fan && visibility !== undefined) fan.style.visibility = visibility;
      window.removeEventListener('resize', settle);
      preference.removeEventListener('change', settle);
    };
  }, [fanRef]);

  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop || motion.current?.closing) return;
    if (!closing && opened.current) {
      motion.current?.cancel();
      motion.current = undefined;
      return;
    }
    opened.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (closing) finishClose.current();
      return;
    }
    const currentFrames = new Map(
      Array.from(motion.current?.flights ?? [], ([imageId, element]) => [
        imageId,
        readFrame(element),
      ]),
    );
    const opacity = motion.current ? getComputedStyle(backdrop).opacity : closing ? '1' : '0';
    const duration = closing ? 240 : 280;
    const viewport = backdrop.querySelector('.style-guide-dialog__body')?.getBoundingClientRect();
    const previews = backdrop.querySelectorAll<HTMLElement>('.style-guide-preview[data-image-id]');
    const fanOrigins =
      viewedFolderId === activeFolderId
        ? closing && fanRef.current
          ? readFanOrigins(fanRef.current)
          : origins
        : [];
    const originsById = new Map(fanOrigins.map((origin) => [origin.imageId, origin]));
    const centerOrigin = fanOrigins[1];
    const offscreenOrigin = centerOrigin && {
      ...centerOrigin,
      centerX: Math.min(0, centerOrigin.centerX - centerOrigin.width / 2) - centerOrigin.width / 2,
    };

    const transfers = Array.from(previews).flatMap((preview) => {
      const imageId = preview.dataset['imageId'];
      const origin =
        previews.length < 3
          ? (originsById.get(imageId) ?? fanOrigins.find((frame) => !frame.imageId))
          : offscreenOrigin;
      const image = preview.querySelector('img');
      if (!imageId || !origin || !image || !viewport) return [];
      const bounds = preview.getBoundingClientRect();
      if (
        bounds.width === 0 ||
        bounds.height === 0 ||
        bounds.bottom <= viewport.top ||
        bounds.top >= viewport.bottom ||
        bounds.right <= viewport.left ||
        bounds.left >= viewport.right
      )
        return [];
      const insets = [
        Math.max(0, viewport.top - bounds.top) / bounds.height,
        Math.max(0, bounds.right - viewport.right) / bounds.width,
        Math.max(0, bounds.bottom - viewport.bottom) / bounds.height,
        Math.max(0, viewport.left - bounds.left) / bounds.width,
      ];
      const gridFrame = {
        ...readFrame(preview),
        clip: `inset(${insets.map((part) => `${String(part * 100)}%`).join(' ')})`,
      };
      const fanFrame = { ...origin, clip: unclipped };
      const from = closing ? (currentFrames.get(imageId) ?? gridFrame) : fanFrame;
      const to = closing ? fanFrame : gridFrame;
      return [{ imageId, image, preview, from, to }];
    });
    motion.current?.cancel();
    const flights = new Map<string, HTMLElement>();
    const hidden = new Map<HTMLElement, string>();
    const fragment = document.createDocumentFragment();
    const tiles = transfers.map(({ imageId, image, preview, from, to }) => {
      const tile = document.createElement('div');
      tile.className = 'style-guide-flight';
      tile.dataset['imageId'] = imageId;
      tile.setAttribute('aria-hidden', 'true');
      Object.assign(tile.style, {
        left: `${String(to.centerX - to.width / 2)}px`,
        top: `${String(to.centerY - to.height / 2)}px`,
        width: `${String(to.width)}px`,
        height: `${String(to.height)}px`,
      });
      tile.append(image.cloneNode(true));
      fragment.append(tile);
      flights.set(imageId, tile);
      hidden.set(preview, preview.style.visibility);
      preview.style.visibility = 'hidden';
      return { tile, from, to };
    });
    // Measure every endpoint before mounting flights outside the clipped, blurred scroll body.
    document.body.append(fragment);
    let completion = backdrop.animate([{ opacity }, { opacity: closing ? 0 : 1 }], {
      duration: duration - 40,
      easing,
      fill: 'both',
    });
    const animations = [completion];

    for (const [index, { tile, from, to }] of tiles.entries()) {
      completion = tile.animate(
        [from, to].map((frame) => {
          const scale = frame.width / to.width;
          return {
            translate: `${String(frame.centerX - to.centerX)}px ${String(frame.centerY - to.centerY)}px`,
            rotate: frame.rotate,
            scale,
            borderRadius: `${String(frame.radius / scale)}px`,
            boxShadow: frame.shadow,
            clipPath: frame.clip,
          };
        }),
        { duration, delay: index * 12, easing, fill: 'both' },
      );
      animations.push(completion);
    }

    const cancel = () => {
      for (const animation of animations) {
        animation.onfinish = null;
        animation.cancel();
      }
      for (const [element, visibility] of hidden) element.style.visibility = visibility;
      for (const tile of flights.values()) tile.remove();
    };
    completion.onfinish = () => {
      if (closing) finishClose.current();
      else {
        cancel();
        motion.current = undefined;
      }
    };
    motion.current = { closing, flights, cancel };
  }, [activeFolderId, closing, fanRef, origins, viewedFolderId]);

  return { backdropRef, closing, close };
}
