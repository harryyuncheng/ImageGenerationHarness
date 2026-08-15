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
}

const toolbarSnapPoints = [
  { position: 'top', x: 0.5, y: 0 },
  { position: 'right', x: 1, y: 0.5 },
  { position: 'bottom', x: 0.5, y: 1 },
  { position: 'left', x: 0, y: 0.5 },
] as const;

type ToolbarSnapPosition = (typeof toolbarSnapPoints)[number]['position'];
type ToolbarSnapPoint = (typeof toolbarSnapPoints)[number];
type ArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

const boundaryGap = 10;

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

function nearestSnapPosition(
  boundary: HTMLElement,
  pointerX: number,
  pointerY: number,
): ToolbarSnapPosition {
  const boundaryBounds = boundary.getBoundingClientRect();
  const normalizedX = (pointerX - boundaryBounds.left) / Math.max(boundaryBounds.width, 1);
  const normalizedY = (pointerY - boundaryBounds.top) / Math.max(boundaryBounds.height, 1);
  let nearest: ToolbarSnapPoint = toolbarSnapPoints[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const point of toolbarSnapPoints) {
    const distance = Math.hypot(normalizedX - point.x, normalizedY - point.y);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }
  return nearest.position;
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

export function MovableToolbar({
  children,
  onMoveStart,
}: {
  children: ReactNode;
  onMoveStart: () => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<DragState | null>(null);
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
    };
  }, []);

  function beginPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const toolbar = toolbarRef.current;
    const boundary = toolbar?.parentElement;
    if (!toolbar || !boundary) return;

    event.preventDefault();
    onMoveStart();
    const start = measuredPosition(toolbar, boundary);
    dragState.current = {
      ...start,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
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
      setSnapPosition(nearestSnapPosition(boundary, event.clientX, event.clientY));
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
      setSnapPosition('bottom');
      setDragPosition(null);
      return;
    }
    if (!isArrowKey(event.key)) return;

    event.preventDefault();
    onMoveStart();
    const key = event.key;
    setSnapPosition((current) => nextSnapPosition(current, key));
    setDragPosition(null);
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
      style={style}
    >
      <span id="generation-toolbar-move-instructions" className="visually-hidden">
        Drag to snap to an edge or corner. Use the arrow keys to move between positions, or press
        Home to reset to the bottom.
      </span>
      <button
        type="button"
        className="toolbar-drag-handle"
        aria-label="Move generation toolbar"
        aria-describedby="generation-toolbar-move-instructions"
        title="Drag to snap · Home to reset"
        onPointerDown={beginPointerMove}
        onPointerMove={continuePointerMove}
        onPointerUp={endPointerMove}
        onPointerCancel={endPointerMove}
        onKeyDown={moveWithKeyboard}
        onDoubleClick={() => {
          onMoveStart();
          setSnapPosition('bottom');
          setDragPosition(null);
        }}
      >
        <GripVertical size={16} />
      </button>
      <div className="generation-toolbar-controls">{children}</div>
    </div>
  );
}
