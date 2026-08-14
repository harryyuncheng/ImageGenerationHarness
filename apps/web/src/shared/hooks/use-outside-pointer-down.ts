import { useEffect } from 'react';
import type { RefObject } from 'react';

/** Closes a popover when a pointer press lands outside of its anchor. */
export function useOutsidePointerDown(
  anchor: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !anchor.current?.contains(event.target)) {
        onOutside();
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, [active]);
}
