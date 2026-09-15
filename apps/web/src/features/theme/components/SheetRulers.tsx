import { useLayoutEffect, useRef, useState } from 'react';

const MAJOR = 240;

interface RulerPose {
  scale: number;
  scroll: number;
}

function rulerTransform(vertical: boolean, position: number | undefined, pose: RulerPose) {
  if (position === undefined) {
    return vertical
      ? `translate3d(0, ${String(-pose.scroll)}px, 0) scaleY(${String(pose.scale)})`
      : `scaleX(${String(pose.scale)})`;
  }
  const offset = position * pose.scale - (vertical ? pose.scroll : 0);
  return vertical
    ? `translate3d(0, ${String(offset)}px, 0)`
    : `translate3d(${String(offset)}px, 0, 0)`;
}

export function SheetRulers({
  scale,
  scrollTop,
  width,
  height,
}: {
  scale: number;
  scrollTop: number;
  width: number;
  height: number;
}) {
  const rulerRef = useRef<HTMLDivElement>(null);
  const pose = useRef<RulerPose>({ scale, scroll: scrollTop });
  const clock = useRef<{ driver: Animation; from: RulerPose } | undefined>(undefined);
  const [travel, setTravel] = useState<{ from: RulerPose; to: RulerPose }>();
  const target = { scale, scroll: scrollTop };
  const from = travel?.from ?? target;
  const to = travel?.to ?? target;
  const minimumScale = Math.min(from.scale, to.scale);
  const columnCount = Math.ceil(width / (MAJOR * minimumScale));
  const firstRow = Math.max(
    1,
    Math.floor(Math.min(from.scroll / from.scale, to.scroll / to.scale) / MAJOR),
  );
  const lastRow = Math.ceil(
    Math.max((from.scroll + height) / from.scale, (to.scroll + height) / to.scale) / MAJOR,
  );

  useLayoutEffect(() => {
    const ruler = rulerRef.current;
    if (!ruler) return;
    const root = document.documentElement;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const from = pose.current;
    const to = { scale, scroll: scrollTop };
    if (
      preference.matches ||
      !CSS.supports('selector(:active-view-transition-type(sheet-in))') ||
      !root.matches(
        ':active-view-transition-type(sheet-in), :active-view-transition-type(sheet-out)',
      )
    ) {
      pose.current = to;
      clock.current = undefined;
      setTravel(undefined);
      return;
    }

    setTravel({ from, to });
    let disposed = false;
    let driver: Animation | undefined;
    const movements: Animation[] = [];
    const settle = () => {
      disposed = true;
      for (const movement of movements) movement.cancel();
      movements.length = 0;
      pose.current = to;
      clock.current = undefined;
      setTravel(undefined);
    };
    const align = () => {
      if (disposed || driver) return;
      const candidate = document
        .getAnimations()
        .find(
          (animation) =>
            animation instanceof CSSAnimation &&
            animation.animationName === 'sheet-enter' &&
            animation.playState === 'running',
        );
      const duration = candidate?.effect?.getTiming().duration;
      if (candidate && typeof candidate.startTime === 'number' && typeof duration === 'number') {
        driver = candidate;
        const origin = clock.current?.driver === driver ? clock.current.from : from;
        clock.current = { driver, from: origin };
        const easing = getComputedStyle(root).getPropertyValue('--motion-sheet-easing').trim();
        for (const element of ruler.querySelectorAll<HTMLElement>('[data-ruler-axis]')) {
          const vertical = element.dataset['rulerAxis'] === 'y';
          const position = element.dataset['rulerPosition'];
          const offset = position === undefined ? undefined : Number(position);
          const movement = element.animate(
            [
              { transform: rulerTransform(vertical, offset, origin) },
              { transform: rulerTransform(vertical, offset, to) },
            ],
            { duration, easing, fill: 'both' },
          );
          movement.id = 'sheet-ruler-motion';
          // Fixed-size labels and tick tracks share the camera's clock without repainting a gradient.
          movement.startTime = candidate.startTime;
          movements.push(movement);
        }
        driver.addEventListener('finish', settle, { once: true });
        driver.addEventListener('cancel', settle, { once: true });
      }
    };
    const started = (event: AnimationEvent) => {
      if (event.animationName === 'sheet-enter') align();
    };
    root.addEventListener('animationstart', started);
    preference.addEventListener('change', settle);
    window.addEventListener('resize', settle);
    // Scroll restoration can update this effect after the camera has already started.
    queueMicrotask(align);
    return () => {
      disposed = true;
      root.removeEventListener('animationstart', started);
      preference.removeEventListener('change', settle);
      window.removeEventListener('resize', settle);
      driver?.removeEventListener('finish', settle);
      driver?.removeEventListener('cancel', settle);
      const ticks = ruler.querySelector('.cutting-mat__ticks-y');
      if (ticks && movements.length > 0) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(ticks).transform);
        pose.current = { scale: matrix.d, scroll: -matrix.f };
      }
      for (const movement of movements) movement.cancel();
    };
  }, [scale, scrollTop]);

  return (
    <div ref={rulerRef} className="cutting-mat__rulers">
      <div className="cutting-mat__ruler-x">
        <div
          className="cutting-mat__ticks-x"
          data-ruler-axis="x"
          style={{
            width: `${String(width / minimumScale)}px`,
            transform: rulerTransform(false, undefined, target),
          }}
        />
        {Array.from({ length: columnCount }, (_, index) => index + 1).map((step) => (
          <span
            key={step}
            className="cutting-mat__measure"
            data-ruler-axis="x"
            data-ruler-position={step * MAJOR}
            style={{ transform: rulerTransform(false, step * MAJOR, target) }}
          >
            {step * 5}
          </span>
        ))}
      </div>
      <div className="cutting-mat__ruler-y">
        <div
          className="cutting-mat__ticks-y"
          data-ruler-axis="y"
          style={{
            height: `${String(lastRow * MAJOR)}px`,
            transform: rulerTransform(true, undefined, target),
          }}
        />
        {Array.from(
          { length: Math.max(0, lastRow - firstRow + 1) },
          (_, index) => firstRow + index,
        ).map((step) => (
          <span
            key={step}
            className="cutting-mat__measure"
            data-ruler-axis="y"
            data-ruler-position={step * MAJOR}
            style={{ transform: rulerTransform(true, step * MAJOR, target) }}
          >
            {step * 5}
          </span>
        ))}
      </div>
      <span className="cutting-mat__corner">0</span>
    </div>
  );
}
