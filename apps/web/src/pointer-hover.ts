const hoverTargetSelector = 'button, a[href], [role="button"]';
const hoverClass = 'is-pointer-hover';

interface PointerPosition {
  x: number;
  y: number;
}

export function installPointerHoverTracking(): () => void {
  let pointer: PointerPosition | undefined;
  let hovered = new Set<HTMLElement>();
  let animationFrame: number | undefined;
  let activeTransitions = 0;

  const clearHovered = () => {
    for (const element of hovered) element.classList.remove(hoverClass);
    hovered = new Set();
  };

  const reconcileHovered = () => {
    if (!pointer || document.visibilityState !== 'visible') {
      clearHovered();
      return;
    }

    const nextHovered = new Set<HTMLElement>();
    let element: Element | null = document.elementFromPoint(pointer.x, pointer.y);
    while (element) {
      if (element instanceof HTMLElement && element.matches(hoverTargetSelector)) {
        nextHovered.add(element);
      }
      element = element.parentElement;
    }

    for (const previous of hovered) {
      if (!nextHovered.has(previous)) previous.classList.remove(hoverClass);
    }
    for (const current of nextHovered) {
      if (!hovered.has(current)) current.classList.add(hoverClass);
    }
    hovered = nextHovered;
  };

  const runFrame = () => {
    animationFrame = undefined;
    reconcileHovered();
    if (activeTransitions > 0) animationFrame = window.requestAnimationFrame(runFrame);
  };

  const scheduleReconciliation = () => {
    animationFrame ??= window.requestAnimationFrame(runFrame);
  };

  const updatePointer = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      pointer = undefined;
      clearHovered();
      return;
    }
    pointer = { x: event.clientX, y: event.clientY };
    scheduleReconciliation();
  };

  const clearPointer = () => {
    pointer = undefined;
    clearHovered();
  };

  const transitionStarted = () => {
    activeTransitions += 1;
    scheduleReconciliation();
  };

  const transitionFinished = () => {
    activeTransitions = Math.max(0, activeTransitions - 1);
    scheduleReconciliation();
  };

  const mutations = new MutationObserver(scheduleReconciliation);
  mutations.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('pointermove', updatePointer, { passive: true });
  document.addEventListener('pointerdown', updatePointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', clearPointer);
  document.addEventListener('transitionrun', transitionStarted, true);
  document.addEventListener('transitionend', transitionFinished, true);
  document.addEventListener('transitioncancel', transitionFinished, true);
  document.addEventListener('visibilitychange', scheduleReconciliation);
  window.addEventListener('blur', clearPointer);
  window.addEventListener('resize', scheduleReconciliation);
  window.addEventListener('scroll', scheduleReconciliation, true);

  return () => {
    mutations.disconnect();
    if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
    clearHovered();
    document.removeEventListener('pointermove', updatePointer);
    document.removeEventListener('pointerdown', updatePointer);
    document.documentElement.removeEventListener('pointerleave', clearPointer);
    document.removeEventListener('transitionrun', transitionStarted, true);
    document.removeEventListener('transitionend', transitionFinished, true);
    document.removeEventListener('transitioncancel', transitionFinished, true);
    document.removeEventListener('visibilitychange', scheduleReconciliation);
    window.removeEventListener('blur', clearPointer);
    window.removeEventListener('resize', scheduleReconciliation);
    window.removeEventListener('scroll', scheduleReconciliation, true);
  };
}
