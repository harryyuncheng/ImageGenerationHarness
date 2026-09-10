import { useEffect, useRef, useState, type RefObject } from 'react';
import { SheetRulers } from './SheetRulers.js';

const CELL = 48;
const MAJOR = CELL * 5;
const GUIDE_RADII = [MAJOR * 1.5, MAJOR * 2.5, MAJOR * 3.5];

export function CuttingMat({
  overview,
  viewportRef,
}: {
  overview: boolean;
  viewportRef: RefObject<HTMLElement | null>;
}) {
  const matRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const scrollTop = overview ? scroll : 0;
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const scale = overview ? 0.1 : 1;
  // At 10%, draw every fifth unit rather than a dense, unreadable fine grid.
  const unitsPerCell = overview ? 5 : 1;
  const cell = CELL * scale * unitsPerCell;
  const major = cell * 5;

  useEffect(() => {
    const mat = matRef.current;
    const viewport = viewportRef.current;
    if (!mat || !viewport) return;
    const readScroll = () => {
      setScroll(viewport.scrollTop);
    };
    readScroll();
    viewport.addEventListener('scroll', readScroll, { passive: true });
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(mat);
    return () => {
      observer.disconnect();
      viewport.removeEventListener('scroll', readScroll);
    };
  }, [viewportRef]);

  return (
    <div ref={matRef} className="cutting-mat" aria-hidden="true">
      <svg className="cutting-mat__grid" focusable="false">
        <defs>
          <pattern
            id="cutting-mat-cell"
            width={cell}
            height={cell}
            y={-scrollTop}
            patternUnits="userSpaceOnUse"
          >
            <path className="cutting-mat__cell" d={`M0.5 ${String(cell)}V0.5H${String(cell)}`} />
          </pattern>
          <pattern
            id="cutting-mat-major"
            width={major}
            height={major}
            y={-scrollTop}
            patternUnits="userSpaceOnUse"
          >
            <path className="cutting-mat__major" d={`M0.5 ${String(major)}V0.5H${String(major)}`} />
          </pattern>
          <pattern
            id="cutting-mat-bias"
            width={major}
            height={major}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(0 ${String(-scrollTop)}) rotate(45)`}
          >
            <path className="cutting-mat__bias" d={`M0.5 0V${String(major)}`} />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#cutting-mat-cell)" />
        <rect width="100%" height="100%" fill="url(#cutting-mat-major)" />
        <rect width="100%" height="100%" fill="url(#cutting-mat-bias)" />

        <g
          className="cutting-mat__guide"
          transform={`translate(0 ${String(-scrollTop)}) scale(${String(scale)})`}
        >
          {GUIDE_RADII.map((radius) => (
            <path
              key={radius}
              d={`M${String(radius)} 0A${String(radius)} ${String(radius)} 0 0 1 0 ${String(radius)}`}
            />
          ))}
        </g>
      </svg>
      <SheetRulers
        scale={cell / CELL}
        scrollTop={scrollTop}
        width={size.width}
        height={size.height}
      />
    </div>
  );
}
