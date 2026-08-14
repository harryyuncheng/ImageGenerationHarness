import { Check } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import type { Capability } from '../../../shared/types/domain.js';
import { capabilityLabel } from '../capabilities.js';
import { categoryMeta, modelCategories, modelPromptSummary } from '../model-presentation.js';

/** Anchored to the composer picker and continuously repositioned while open. */
export function ModelMenu({
  capabilities,
  selectedId,
  onSelect,
}: {
  capabilities: readonly Capability[];
  selectedId: string;
  onSelect: (capability: Capability) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const anchor = menu?.parentElement;
    if (!menu || !anchor) return;

    const viewportMargin = 12;
    const menuGap = 7;
    const preferredWidth = 430;
    const preferredHeight = 360;
    let animationFrame = 0;
    let lastLayout = '';

    const positionMenu = () => {
      const anchorBounds = anchor.getBoundingClientRect();
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = visualViewport?.height ?? document.documentElement.clientHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const width = Math.min(preferredWidth, Math.max(0, viewportWidth - viewportMargin * 2));
      const left = Math.min(
        Math.max(anchorBounds.left, viewportLeft + viewportMargin),
        viewportRight - width - viewportMargin,
      );
      const spaceAbove = Math.max(0, anchorBounds.top - menuGap - viewportTop - viewportMargin);
      const spaceBelow = Math.max(
        0,
        viewportBottom - anchorBounds.bottom - menuGap - viewportMargin,
      );
      const openAbove = spaceAbove > spaceBelow;
      const availableHeight = openAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.min(preferredHeight, availableHeight);
      const top = openAbove ? 'auto' : `${String(anchorBounds.bottom + menuGap)}px`;
      const bottom = openAbove
        ? `${String(document.documentElement.clientHeight - anchorBounds.top + menuGap)}px`
        : 'auto';
      const layout = [openAbove, left, width, maxHeight, top, bottom].join(':');

      if (layout !== lastLayout) {
        lastLayout = layout;
        menu.dataset['placement'] = openAbove ? 'above' : 'below';
        Object.assign(menu.style, {
          position: 'fixed',
          left: `${String(left)}px`,
          width: `${String(width)}px`,
          maxHeight: `${String(maxHeight)}px`,
          top,
          bottom,
        });
      }
      animationFrame = window.requestAnimationFrame(positionMenu);
    };
    const schedulePosition = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(positionMenu);
    };

    positionMenu();
    const resizeObserver = new ResizeObserver(schedulePosition);
    resizeObserver.observe(anchor);
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
    };
  }, []);

  return (
    <div ref={menuRef} className="model-menu popover surface-enter">
      <div className="model-menu-header">
        <strong>Choose a tool</strong>
        <small>Stability AI on Amazon Bedrock</small>
      </div>
      {modelCategories.map((category) => {
        const group = capabilities.filter((capability) => capability.category === category);
        const Icon = categoryMeta[category].Icon;
        return group.length > 0 ? (
          <div className="model-group" key={category}>
            <p>
              <Icon size={14} /> {categoryMeta[category].label}
            </p>
            {group.map((capability) => (
              <button
                type="button"
                key={capability.canonicalId}
                className={selectedId === capability.canonicalId ? 'selected' : ''}
                onClick={() => {
                  onSelect(capability);
                }}
              >
                <span>
                  <strong>{capabilityLabel(capability)}</strong>
                  <small>{modelPromptSummary(capability)}</small>
                </span>
                {selectedId === capability.canonicalId && <Check size={16} />}
              </button>
            ))}
          </div>
        ) : null;
      })}
    </div>
  );
}
