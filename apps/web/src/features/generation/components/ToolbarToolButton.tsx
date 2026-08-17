import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Capability } from '../../../shared/types/domain.js';
import { capabilityDescription } from '../capabilities.js';
import { toolbarToolLabel } from '../model-presentation.js';

interface TooltipPosition {
  left: number;
  top: number;
  width: number;
}

const tooltipDelay = 180;
const tooltipGap = 9;
const viewportMargin = 12;
const tooltipMaximumWidth = 240;

function positionTooltip(button: HTMLButtonElement): TooltipPosition {
  const bounds = button.getBoundingClientRect();
  const visualViewport = window.visualViewport;
  const viewportLeft = visualViewport?.offsetLeft ?? 0;
  const viewportWidth = visualViewport?.width ?? document.documentElement.clientWidth;
  const viewportRight = viewportLeft + viewportWidth;
  const width = Math.min(tooltipMaximumWidth, viewportWidth - viewportMargin * 2);
  const centeredLeft = bounds.left + (bounds.width - width) / 2;
  const left = Math.min(
    Math.max(centeredLeft, viewportLeft + viewportMargin),
    viewportRight - width - viewportMargin,
  );
  return {
    left,
    top: bounds.top - tooltipGap,
    width,
  };
}

export function ToolbarToolButton({
  capability,
  selected,
  onSelect,
}: {
  capability: Capability;
  selected: boolean;
  onSelect: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const tooltipId = useId();
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const description = capabilityDescription(capability);

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    },
    [],
  );

  function showTooltip() {
    const button = buttonRef.current;
    if (button) setTooltipPosition(positionTooltip(button));
  }

  function scheduleTooltip() {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(showTooltip, tooltipDelay);
  }

  function hideTooltip() {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
    setTooltipPosition(null);
  }

  const tooltipStyle: CSSProperties | undefined = tooltipPosition
    ? {
        left: tooltipPosition.left,
        top: tooltipPosition.top,
        width: tooltipPosition.width,
      }
    : undefined;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`toolbar-tool-option ${selected ? 'selected' : ''}`}
        aria-pressed={selected}
        aria-describedby={tooltipPosition ? tooltipId : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') scheduleTooltip();
        }}
        onPointerLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        onClick={() => {
          hideTooltip();
          onSelect();
        }}
      >
        {toolbarToolLabel(capability)}
      </button>
      {tooltipPosition &&
        createPortal(
          <div id={tooltipId} role="tooltip" className="toolbar-tool-tooltip" style={tooltipStyle}>
            <strong>{capability.name}</strong>
            <span>{description}</span>
          </div>,
          document.body,
        )}
    </>
  );
}
