import { useEffect } from 'react';
import type { RefObject } from 'react';

interface GlobalShortcutOptions {
  closeOverlays: () => void;
  openSettings: () => void;
  fileInput: RefObject<HTMLInputElement | null>;
  promptInput: RefObject<HTMLTextAreaElement | null>;
}

/** Global keyboard shortcuts, documented in Settings. */
export function useGlobalShortcuts(options: GlobalShortcutOptions) {
  useEffect(() => {
    const handleGlobalKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        options.closeOverlays();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        options.openSettings();
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        options.fileInput.current?.click();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        options.promptInput.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => {
      window.removeEventListener('keydown', handleGlobalKey);
    };
  }, []);
}
