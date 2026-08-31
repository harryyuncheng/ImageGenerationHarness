const CELL = 48;
const MAJOR = CELL * 5;
const RULER = 21;
const TICK = 5;
const MAJOR_TICK = 11;
// Labels are over-drawn past any plausible viewport and clipped by the svg edge.
const COLUMN_LABELS = 16;
const ROW_LABELS = 10;
const GUIDE_RADII = [MAJOR * 1.5, MAJOR * 2.5, MAJOR * 3.5];

function majorSteps(count: number) {
  return Array.from({ length: count }, (_, index) => index + 1);
}

/**
 * The gridded sheet behind the create canvas. Sized by CSS with no viewBox, so
 * every coordinate below is a CSS pixel and the mat never stretches.
 */
export function CuttingMat() {
  return (
    <svg className="cutting-mat" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="cutting-mat-cell" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <path className="cutting-mat__cell" d={`M0.5 ${String(CELL)}V0.5H${String(CELL)}`} />
        </pattern>
        <pattern id="cutting-mat-major" width={MAJOR} height={MAJOR} patternUnits="userSpaceOnUse">
          <path className="cutting-mat__major" d={`M0.5 ${String(MAJOR)}V0.5H${String(MAJOR)}`} />
        </pattern>
        <pattern
          id="cutting-mat-bias"
          width={MAJOR}
          height={MAJOR}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path className="cutting-mat__bias" d={`M0.5 0V${String(MAJOR)}`} />
        </pattern>
        <pattern id="cutting-mat-tick-x" width={CELL} height={RULER} patternUnits="userSpaceOnUse">
          <path className="cutting-mat__tick" d={`M0.5 ${String(RULER)}V${String(RULER - TICK)}`} />
        </pattern>
        <pattern id="cutting-mat-tick-y" width={RULER} height={CELL} patternUnits="userSpaceOnUse">
          <path className="cutting-mat__tick" d={`M${String(RULER)} 0.5H${String(RULER - TICK)}`} />
        </pattern>
        <pattern id="cutting-mat-step-x" width={MAJOR} height={RULER} patternUnits="userSpaceOnUse">
          <path
            className="cutting-mat__tick"
            d={`M0.5 ${String(RULER)}V${String(RULER - MAJOR_TICK)}`}
          />
        </pattern>
        <pattern id="cutting-mat-step-y" width={RULER} height={MAJOR} patternUnits="userSpaceOnUse">
          <path
            className="cutting-mat__tick"
            d={`M${String(RULER)} 0.5H${String(RULER - MAJOR_TICK)}`}
          />
        </pattern>
      </defs>

      <rect className="cutting-mat__sheet" width="100%" height="100%" />
      <rect width="100%" height="100%" fill="url(#cutting-mat-cell)" />
      <rect width="100%" height="100%" fill="url(#cutting-mat-major)" />
      <rect width="100%" height="100%" fill="url(#cutting-mat-bias)" />

      <g className="cutting-mat__guide">
        {GUIDE_RADII.map((radius) => (
          <path
            key={radius}
            d={`M${String(radius)} 0A${String(radius)} ${String(radius)} 0 0 1 0 ${String(radius)}`}
          />
        ))}
      </g>

      <g className="cutting-mat__ruler">
        <rect className="cutting-mat__band" width="100%" height={RULER} />
        <rect className="cutting-mat__band" width={RULER} height="100%" />
        <rect width="100%" height={RULER} fill="url(#cutting-mat-tick-x)" />
        <rect width={RULER} height="100%" fill="url(#cutting-mat-tick-y)" />
        <rect width="100%" height={RULER} fill="url(#cutting-mat-step-x)" />
        <rect width={RULER} height="100%" fill="url(#cutting-mat-step-y)" />
        <line
          className="cutting-mat__band-edge"
          x1={0}
          y1={RULER - 0.5}
          x2="100%"
          y2={RULER - 0.5}
        />
        <line
          className="cutting-mat__band-edge"
          x1={RULER - 0.5}
          y1={0}
          x2={RULER - 0.5}
          y2="100%"
        />
        {majorSteps(COLUMN_LABELS).map((step) => (
          <text
            key={step}
            className="cutting-mat__measure"
            x={step * MAJOR + 3}
            y={RULER - MAJOR_TICK - 3}
          >
            {step * 5}
          </text>
        ))}
        {majorSteps(ROW_LABELS).map((step) => (
          <text key={step} className="cutting-mat__measure" x={3} y={step * MAJOR + 10}>
            {step * 5}
          </text>
        ))}
      </g>
    </svg>
  );
}
