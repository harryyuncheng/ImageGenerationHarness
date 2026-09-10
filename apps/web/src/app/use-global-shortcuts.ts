import { useEffect } from 'react';
import type { RefObject } from 'react';
import { matchesShortcut, type ShortcutBindings } from '../shared/shortcuts.js';

interface GlobalShortcutOptions {
  bindings: ShortcutBindings;
  closeOverlays: () => void;
  openSettings: () => void;
  chooseImages: () => void;
  promptInput: RefObject<HTMLTextAreaElement | null>;
}

export function useGlobalShortcuts(options: GlobalShortcutOptions) {
  useEffect(() => {
    const handleGlobalKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (event.key === 'Escape') {
        options.closeOverlays();
        return;
      }
      if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return;
      if (matchesShortcut(event, options.bindings.openSettings)) {
        event.preventDefault();
        options.openSettings();
      }
      if (matchesShortcut(event, options.bindings.addImages)) {
        event.preventDefault();
        options.chooseImages();
      }
      if (matchesShortcut(event, options.bindings.focusPrompt)) {
        event.preventDefault();
        options.promptInput.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
    };
  }, [
    options.bindings,
    options.closeOverlays,
    options.openSettings,
    options.chooseImages,
    options.promptInput,
  ]);
}
