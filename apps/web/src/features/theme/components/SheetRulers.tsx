import { useLayoutEffect, useRef, useState } from 'react';

const MAJOR = 240;

interface RulerPose {
  scale: number;
  scroll: number;
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
  const [travel, setTravel] = useState<{ from: RulerPose; to: RulerPose }>({
    from: { scale, scroll: scrollTop },
    to: { scale, scroll: scrollTop },
  });
  const columnCount = Math.ceil(width / (MAJOR * Math.min(travel.from.scale, travel.to.scale)));
  const firstRow = Math.max(
    1,
    Math.floor(
      Math.min(travel.from.scroll / travel.from.scale, travel.to.scroll / travel.to.scale) / MAJOR,
    ),
  );
  const lastRow = Math.ceil(
    Math.max(
      (travel.from.scroll + height) / travel.from.scale,
      (travel.to.scroll + height) / travel.to.scale,
    ) / MAJOR,
  );

  useLayoutEffect(() => {
    const ruler = rulerRef.current;
    if (!ruler) return;
    const root = document.documentElement;
    const styles = getComputedStyle(ruler);
    const from = {
      scale: Number.parseFloat(styles.getPropertyValue('--ruler-scale')),
      scroll: -Number.parseFloat(styles.getPropertyValue('--ruler-offset-y')),
    };
    const to = { scale, scroll: scrollTop };
    const inTransition = () =>
      Boolean(root.dataset['sheetTransition']) ||
      (CSS.supports('selector(:active-view-transition)') &&
        root.matches(':active-view-transition'));
    const setTarget = () => {
      ruler.style.setProperty('--ruler-scale', String(scale));
      ruler.style.setProperty('--ruler-offset-y', `${String(-scrollTop)}px`);
    };
    if (!inTransition() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTarget();
      setTravel({ from: to, to });
      return;
    }

    setTravel({ from, to });
    let frame: number | undefined;
    let movement: Animation | undefined;
    const align = () => {
      const driver = document
        .getAnimations()
        .find(
          (animation) =>
            animation instanceof CSSAnimation &&
            animation.animationName === 'sheet-enter' &&
            animation.playState === 'running',
        );
      const duration = driver?.effect?.getTiming().duration;
      if (driver && typeof driver.startTime === 'number' && typeof duration === 'number') {
        movement = ruler.animate(
          [
            {
              '--ruler-scale': String(from.scale),
              '--ruler-offset-y': `${String(-from.scroll)}px`,
            },
            { '--ruler-scale': String(scale), '--ruler-offset-y': `${String(-scrollTop)}px` },
          ],
          {
            duration,
            easing: getComputedStyle(root).getPropertyValue('--motion-sheet-easing').trim(),
            fill: 'both',
          },
        );
        movement.id = 'sheet-ruler-motion';
        // Sharing the camera's clock avoids a delayed ruler animation after image decoding.
        movement.startTime = driver.startTime;
        setTarget();
        movement.onfinish = () => {
          movement?.cancel();
          setTravel({ from: to, to });
        };
      } else if (inTransition()) {
        frame = window.requestAnimationFrame(align);
      } else {
        setTarget();
        setTravel({ from: to, to });
      }
    };
    frame = window.requestAnimationFrame(align);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      if (movement) {
        movement.onfinish = null;
        movement.cancel();
      }
    };
  }, [scale, scrollTop]);

  return (
    <div ref={rulerRef} className="cutting-mat__rulers">
      <div className="cutting-mat__ruler-x">
        {Array.from({ length: columnCount }, (_, index) => index + 1).map((step) => (
          <span
            key={step}
            className="cutting-mat__measure"
            style={{
              transform: `translateX(calc(${String(step * MAJOR)}px * var(--ruler-scale)))`,
            }}
          >
            {step * 5}
          </span>
        ))}
      </div>
      <div className="cutting-mat__ruler-y">
        {Array.from(
          { length: Math.max(0, lastRow - firstRow + 1) },
          (_, index) => firstRow + index,
        ).map((step) => (
          <span
            key={step}
            className="cutting-mat__measure"
            style={{
              transform: `translateY(calc(${String(step * MAJOR)}px * var(--ruler-scale) + var(--ruler-offset-y)))`,
            }}
          >
            {step * 5}
          </span>
        ))}
      </div>
      <span className="cutting-mat__corner">0</span>
    </div>
  );
}
