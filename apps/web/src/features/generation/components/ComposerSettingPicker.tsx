import { Check } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { GenerationSettingsController } from '../use-generation-settings.js';

/** Identifies the single open chip menu; keys match the setting each chip edits. */
export type ComposerSettingMenu = string | null;

export interface ComposerSettingGroupProps {
  settings: GenerationSettingsController;
  settingMenu: ComposerSettingMenu;
  onSettingMenuChange: (menu: Exclude<ComposerSettingMenu, null>, open: boolean) => void;
}

type ComposerSettingVariant =
  'canvas' | 'count' | 'dimensions' | 'format' | 'range' | 'seed' | 'style' | 'text';

interface ComposerSettingPickerProps {
  menuId: string;
  label: string;
  menuLabel: string;
  menuDescription: string;
  value: string;
  open: boolean;
  variant: ComposerSettingVariant;
  triggerContent: ReactNode;
  onOpenChange: (open: boolean) => void;
  children: (close: () => void) => ReactNode;
}

/**
 * A composer chip whose menu is portalled to the body and kept inside the
 * visual viewport, above or below the trigger depending on available space.
 */
export function ComposerSettingPicker({
  menuId,
  label,
  menuLabel,
  menuDescription,
  value,
  open,
  variant,
  triggerContent,
  onOpenChange,
  children,
}: ComposerSettingPickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const viewportMargin = 12;
    const menuGap = 8;
    const positionMenu = () => {
      const triggerBounds = trigger.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      const visualViewport = window.visualViewport;
      const viewportLeft = visualViewport?.offsetLeft ?? 0;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportWidth = visualViewport?.width ?? document.documentElement.clientWidth;
      const viewportHeight = visualViewport?.height ?? document.documentElement.clientHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const viewportBottom = viewportTop + viewportHeight;
      const centeredLeft = triggerBounds.left + (triggerBounds.width - menuWidth) / 2;
      const left = Math.min(
        Math.max(centeredLeft, viewportLeft + viewportMargin),
        viewportRight - menuWidth - viewportMargin,
      );
      const spaceAbove = triggerBounds.top - viewportTop;
      const spaceBelow = viewportBottom - triggerBounds.bottom;
      const openAbove = spaceAbove >= menuHeight + menuGap || spaceAbove >= spaceBelow;
      const top = openAbove
        ? Math.max(viewportTop + viewportMargin, triggerBounds.top - menuHeight - menuGap)
        : Math.min(triggerBounds.bottom + menuGap, viewportBottom - menuHeight - viewportMargin);

      menu.dataset['placement'] = openAbove ? 'above' : 'below';
      menu.dataset['positioned'] = 'true';
      Object.assign(menu.style, {
        left: `${String(left)}px`,
        maxHeight: `${String(viewportHeight - viewportMargin * 2)}px`,
        top: `${String(top)}px`,
      });
    };
    const closeFromOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !trigger.contains(event.target) &&
        !menu.contains(event.target)
      ) {
        onOpenChange(false);
      }
    };
    const closeFromEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onOpenChange(false);
      trigger.focus();
    };

    positionMenu();
    const initialFocus =
      menu.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ??
      menu.querySelector<HTMLElement>('input:not([disabled]), button:not([disabled])') ??
      menu;
    initialFocus.focus({ preventScroll: true });
    const resizeObserver = new ResizeObserver(positionMenu);
    resizeObserver.observe(trigger);
    resizeObserver.observe(menu);
    document.addEventListener('pointerdown', closeFromOutside);
    window.addEventListener('keydown', closeFromEscape);
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    window.visualViewport?.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('scroll', positionMenu);
    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('pointerdown', closeFromOutside);
      window.removeEventListener('keydown', closeFromEscape);
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
      window.visualViewport?.removeEventListener('resize', positionMenu);
      window.visualViewport?.removeEventListener('scroll', positionMenu);
    };
  }, [open]);

  function close() {
    onOpenChange(false);
    triggerRef.current?.focus();
  }

  return (
    <span className="composer-setting-picker">
      <button
        ref={triggerRef}
        type="button"
        className={`composer-setting composer-setting--${variant} ${open ? 'is-open' : ''}`}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-describedby={`${menuId}-current-value`}
        onClick={() => {
          onOpenChange(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        <span id={`${menuId}-current-value`} className="visually-hidden">
          Current value: {value}
        </span>
        {triggerContent}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="dialog"
            aria-label={menuLabel}
            tabIndex={-1}
            className={`composer-setting-menu composer-setting-menu--${variant} popover surface-enter`}
          >
            <div className="composer-setting-menu-header">
              <strong>{menuLabel}</strong>
              <small>{menuDescription}</small>
            </div>
            {children(close)}
          </div>,
          document.body,
        )}
    </span>
  );
}

interface ComposerSettingOption<Value extends string> {
  value: Value;
  label: string;
  description?: string;
  preview?: ReactNode;
  disabled?: boolean;
}

/** The list body shared by every chip menu that picks one value from a fixed set. */
export function ComposerSettingOptions<Value extends string>({
  label,
  variant,
  value,
  options,
  onSelect,
}: {
  label: string;
  variant: ComposerSettingVariant;
  value: Value;
  options: readonly ComposerSettingOption<Value>[];
  onSelect: (value: Value) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function moveOptionFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const optionElements = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not([disabled])') ?? [],
    );
    if (optionElements.length === 0) return;
    event.preventDefault();
    const focusedIndex = optionElements.findIndex((option) => option === document.activeElement);
    let nextIndex = focusedIndex;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = optionElements.length - 1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = focusedIndex < 0 ? 0 : (focusedIndex + 1) % optionElements.length;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex =
        focusedIndex < 0
          ? optionElements.length - 1
          : (focusedIndex - 1 + optionElements.length) % optionElements.length;
    }
    optionElements[nextIndex]?.focus();
  }

  return (
    <div
      ref={listRef}
      className={`composer-setting-options composer-setting-options--${variant}`}
      role="listbox"
      aria-label={label}
      onKeyDown={moveOptionFocus}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`composer-setting-option composer-setting-option--${variant} ${selected ? 'selected' : ''}`}
            role="option"
            aria-label={
              option.description === undefined
                ? option.label
                : variant === 'count'
                  ? `${option.label} ${option.description}`
                  : `${option.label}, ${option.description}`
            }
            aria-selected={selected}
            disabled={option.disabled}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onSelect(option.value);
            }}
          >
            <span className="composer-setting-option-preview">{option.preview}</span>
            <span className="composer-setting-option-copy">
              <strong>{option.label}</strong>
              {option.description !== undefined && <small>{option.description}</small>}
            </span>
            {selected && variant !== 'count' && (
              <Check className="composer-setting-option-check" size={14} />
            )}
          </button>
        );
      })}
    </div>
  );
}
