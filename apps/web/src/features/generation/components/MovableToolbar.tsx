import { GripVertical } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';

interface ToolbarPosition {
  left: number;
  top: number;
}

interface DragState extends ToolbarPosition {
  pointerId: number;
  pointerX: number;
  pointerY: number;
  samples: PointerSample[];
}

interface PointerSample {
  x: number;
  y: number;
  time: number;
}

interface MovableToolbarProps {
  children: ReactNode;
  onMoveStart: () => void;
}

const toolbarSnapPoints = [
  { position: 'top', x: 0.5, y: 0 },
  { position: 'right', x: 1, y: 0.5 },
  { position: 'bottom', x: 0.5, y: 1 },
  { position: 'left', x: 0, y: 0.5 },
] as const;

type ToolbarSnapPosition = (typeof toolbarSnapPoints)[number]['position'];
type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

const boundaryGap = 3;
const snapDuration = 300;
const momentumWindow = 140;
const momentumSpeedThreshold = 0.12;
const momentumDistanceThreshold = 8;
const maximumShortGestureDistance = 160;
const relativeShortGestureDistance = 0.24;

function constrainedPosition(
  toolbar: HTMLDivElement,
  boundary: HTMLElement,
  position: ToolbarPosition,
): ToolbarPosition {
  const toolbarBounds = toolbar.getBoundingClientRect();
  const boundaryBounds = boundary.getBoundingClientRect();
  const maximumLeft = Math.max(
    boundaryGap,
    boundaryBounds.width - toolbarBounds.width - boundaryGap,
  );
  const maximumTop = Math.max(
    boundaryGap,
    boundaryBounds.height - toolbarBounds.height - boundaryGap,
  );

  return {
    left: Math.min(Math.max(position.left, boundaryGap), maximumLeft),
    top: Math.min(Math.max(position.top, boundaryGap), maximumTop),
  };
}

function measuredPosition(toolbar: HTMLDivElement, boundary: HTMLElement): ToolbarPosition {
  const toolbarBounds = toolbar.getBoundingClientRect();
  const boundaryBounds = boundary.getBoundingClientRect();
  return {
    left: toolbarBounds.left - boundaryBounds.left,
    top: toolbarBounds.top - boundaryBounds.top,
  };
}

function withPointerSample(samples: PointerSample[], sample: PointerSample): PointerSample[] {
  const cutoff = sample.time - momentumWindow;
  return [...samples, sample].filter(({ time }) => time >= cutoff).slice(-8);
}

function momentumSnapPosition(
  drag: DragState,
  samples: PointerSample[],
  currentPosition: ToolbarSnapPosition,
): ToolbarSnapPosition {
  const latest = samples.at(-1);
  if (!latest) return currentPosition;
  const velocityStart =
    samples.find((sample) => Math.hypot(latest.x - sample.x, latest.y - sample.y) >= 4) ?? latest;
  const elapsed = Math.max(1, latest.time - velocityStart.time);
  const velocityX = (latest.x - velocityStart.x) / elapsed;
  const velocityY = (latest.y - velocityStart.y) / elapsed;
  const speed = Math.hypot(velocityX, velocityY);
  const displacementX = latest.x - drag.pointerX;
  const displacementY = latest.y - drag.pointerY;
  const displacement = Math.hypot(displacementX, displacementY);
  if (speed < momentumSpeedThreshold && displacement < momentumDistanceThreshold) {
    return currentPosition;
  }

  const directionX = speed >= momentumSpeedThreshold ? velocityX : displacementX;
  const directionY = speed >= momentumSpeedThreshold ? velocityY : displacementY;
  if (Math.abs(directionX) > Math.abs(directionY)) {
    return directionX > 0 ? 'right' : 'left';
  }
  return directionY > 0 ? 'bottom' : 'top';
}

function nearestSnapPosition(
  toolbar: HTMLDivElement,
  boundary: HTMLElement,
  position: ToolbarPosition,
): ToolbarSnapPosition {
  const toolbarBounds = toolbar.getBoundingClientRect();
  const bounds = boundary.getBoundingClientRect();
  const centerX = (position.left + toolbarBounds.width / 2) / Math.max(bounds.width, 1);
  const centerY = (position.top + toolbarBounds.height / 2) / Math.max(bounds.height, 1);
  return toolbarSnapPoints.reduce((nearest, point) => {
    const nearestDistance = Math.hypot(centerX - nearest.x, centerY - nearest.y);
    const pointDistance = Math.hypot(centerX - point.x, centerY - point.y);
    return pointDistance < nearestDistance ? point : nearest;
  }).position;
}

function releaseSnapPosition(
  toolbar: HTMLDivElement,
  boundary: HTMLElement,
  drag: DragState,
  samples: PointerSample[],
  pointerX: number,
  pointerY: number,
  currentPosition: ToolbarSnapPosition,
): ToolbarSnapPosition {
  const finalPosition = constrainedPosition(toolbar, boundary, {
    left: drag.left + pointerX - drag.pointerX,
    top: drag.top + pointerY - drag.pointerY,
  });
  const gestureDistance = Math.hypot(pointerX - drag.pointerX, pointerY - drag.pointerY);
  const boundaryBounds = boundary.getBoundingClientRect();
  const shortGestureDistance = Math.min(
    maximumShortGestureDistance,
    Math.min(boundaryBounds.width, boundaryBounds.height) * relativeShortGestureDistance,
  );
  return gestureDistance <= shortGestureDistance
    ? momentumSnapPosition(drag, samples, currentPosition)
    : nearestSnapPosition(toolbar, boundary, finalPosition);
}

function isArrowKey(key: string): key is ArrowKey {
  return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key);
}

function nextSnapPosition(
  currentPosition: ToolbarSnapPosition,
  key: ArrowKey,
): ToolbarSnapPosition {
  const current = toolbarSnapPoints.find((point) => point.position === currentPosition);
  if (!current) return currentPosition;
  const candidates = toolbarSnapPoints.filter((point) => {
    if (key === 'ArrowLeft') return point.x < current.x;
    if (key === 'ArrowRight') return point.x > current.x;
    if (key === 'ArrowUp') return point.y < current.y;
    return point.y > current.y;
  });
  let next = current;
  let nextScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const crossAxisDistance =
      key === 'ArrowLeft' || key === 'ArrowRight'
        ? Math.abs(candidate.y - current.y)
        : Math.abs(candidate.x - current.x);
    const primaryAxisDistance =
      key === 'ArrowLeft' || key === 'ArrowRight'
        ? Math.abs(candidate.x - current.x)
        : Math.abs(candidate.y - current.y);
    const score = crossAxisDistance * 10 + primaryAxisDistance;
    if (score < nextScore) {
      next = candidate;
      nextScore = score;
    }
  }
  return next.position;
}

export function MovableToolbar({ children, onMoveStart }: MovableToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
  const snapOrigin = useRef<ToolbarPosition | null>(null);
  const snapAnimation = useRef<Animation | null>(null);
  const [snapPosition, setSnapPosition] = useState<ToolbarSnapPosition>('bottom');
  const [dragPosition, setDragPosition] = useState<ToolbarPosition | null>(null);
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const boundary = toolbar?.parentElement;
    if (!toolbar || !boundary) return;

    const keepInsideBoundary = () => {
      setDragPosition((current) => {
        if (!current) return current;
        const next = constrainedPosition(toolbar, boundary, current);
        return next.left === current.left && next.top === current.top ? current : next;
      });
    };
    const resizeObserver = new ResizeObserver(keepInsideBoundary);
    resizeObserver.observe(toolbar);
    resizeObserver.observe(boundary);
    window.addEventListener('resize', keepInsideBoundary);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', keepInsideBoundary);
      snapAnimation.current?.cancel();
    };
  }, []);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const origin = snapOrigin.current;
    if (!toolbar || !origin || dragPosition) return;
    snapOrigin.current = null;
    snapAnimation.current?.cancel();
    delete toolbar.dataset['snapping'];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const destination = toolbar.getBoundingClientRect();
    const translateX = origin.left - destination.left;
    const translateY = origin.top - destination.top;
    if (Math.abs(translateX) < 0.5 && Math.abs(translateY) < 0.5) return;

    toolbar.dataset['snapping'] = 'true';
    const animation = toolbar.animate(
      [
        {
          opacity: 0.96,
          transform: `translate3d(${String(translateX)}px, ${String(translateY)}px, 0) scale(0.985)`,
        },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
      ],
      {
        duration: snapDuration,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    );
    snapAnimation.current = animation;
    const finish = () => {
      if (snapAnimation.current !== animation) return;
      snapAnimation.current = null;
      delete toolbar.dataset['snapping'];
    };
    void animation.finished.then(finish, finish);
  }, [dragPosition, snapPosition]);

  function captureSnapOrigin() {
    const bounds = toolbarRef.current?.getBoundingClientRect();
    snapOrigin.current = bounds ? { left: bounds.left, top: bounds.top } : null;
  }

  function snapTo(position: ToolbarSnapPosition) {
    if (position === snapPosition && !dragPosition) return;
    captureSnapOrigin();
    setSnapPosition(position);
    setDragPosition(null);
  }

  function beginPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const toolbar = toolbarRef.current;
    const boundary = toolbar?.parentElement;
    if (!toolbar || !boundary) return;

    event.preventDefault();
    onMoveStart();
    snapAnimation.current?.cancel();
    snapAnimation.current = null;
    delete toolbar.dataset['snapping'];
    const start = measuredPosition(toolbar, boundary);
    dragState.current = {
      ...start,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      samples: [{ x: event.clientX, y: event.clientY, time: event.timeStamp }],
    };
    setDragPosition(constrainedPosition(toolbar, boundary, start));
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continuePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    const toolbar = toolbarRef.current;
    const boundary = toolbar?.parentElement;
    if (drag?.pointerId !== event.pointerId || !toolbar || !boundary) return;

    dragState.current = {
      ...drag,
      samples: withPointerSample(drag.samples, {
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
      }),
    };
    setDragPosition(
      constrainedPosition(toolbar, boundary, {
        left: drag.left + event.clientX - drag.pointerX,
        top: drag.top + event.clientY - drag.pointerY,
      }),
    );
  }

  function endPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (drag?.pointerId !== event.pointerId) return;
    const toolbar = toolbarRef.current;
    const boundary = toolbar?.parentElement;
    if (toolbar && boundary) {
      const samples = withPointerSample(drag.samples, {
        x: event.clientX,
        y: event.clientY,
        time: event.timeStamp,
      });
      snapTo(
        releaseSnapPosition(
          toolbar,
          boundary,
          drag,
          samples,
          event.clientX,
          event.clientY,
          snapPosition,
        ),
      );
    }
    dragState.current = null;
    setDragPosition(null);
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Home') {
      event.preventDefault();
      onMoveStart();
      snapTo('bottom');
      return;
    }
    if (!isArrowKey(event.key)) return;

    event.preventDefault();
    onMoveStart();
    snapTo(nextSnapPosition(snapPosition, event.key));
  }

  const orientation =
    snapPosition === 'top' || snapPosition === 'bottom' ? 'horizontal' : 'vertical';
  const style: CSSProperties | undefined = dragPosition
    ? { left: dragPosition.left, top: dragPosition.top }
    : undefined;

  return (
    <div
      ref={toolbarRef}
      className={`generation-toolbar ${orientation === 'vertical' ? 'is-vertical' : ''} ${dragPosition ? 'is-positioned' : ''} ${dragging ? 'is-dragging' : ''}`}
      role="toolbar"
      aria-label="Generation toolbar"
      data-position={snapPosition}
      data-orientation={orientation}
      data-snap-duration={snapDuration}
      style={style}
    >
      <span id="generation-toolbar-move-instructions" className="visually-hidden">
        Flick toward an edge for a quick snap, or drag near an edge for direct placement. Use the
        arrow keys to move between positions, or press Home to reset to the bottom.
      </span>
      <button
        type="button"
        className="toolbar-drag-handle"
        aria-label="Move generation toolbar"
        aria-describedby="generation-toolbar-move-instructions"
        title="Flick or drag toward an edge · Home to reset"
        onPointerDown={beginPointerMove}
        onPointerMove={continuePointerMove}
        onPointerUp={endPointerMove}
        onPointerCancel={endPointerMove}
        onKeyDown={moveWithKeyboard}
        onDoubleClick={() => {
          onMoveStart();
          snapTo('bottom');
        }}
      >
        <GripVertical size={16} />
      </button>
      <div className="generation-toolbar-controls">{children}</div>
    </div>
  );
}
