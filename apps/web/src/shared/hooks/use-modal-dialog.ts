import { useEffect, useRef, type KeyboardEvent } from 'react';

const focusableSelector = [
  'button:not(:disabled)',
  'a[href]',
  'input:not(:disabled):not([type="hidden"])',
  'textarea:not(:disabled)',
  'select:not(:disabled)',
  '[tabindex]',
]
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(',');

export function useModalDialog<T extends HTMLElement = HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const previouslyFocused = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => {
    const restoreFocus = previouslyFocused.current;
    if (!ref.current?.contains(document.activeElement)) {
      ref.current?.querySelector<HTMLElement>(focusableSelector)?.focus({ preventScroll: true });
    }
    return () => {
      if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.metaKey || event.ctrlKey) event.stopPropagation();
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => element.getClientRects().length > 0);
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    if (
      event.shiftKey &&
      (document.activeElement === first || !event.currentTarget.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !event.currentTarget.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  return { ref, onKeyDown, tabIndex: -1 };
}
