import { useLayoutEffect, useRef, type RefObject } from 'react';

interface PromptFrame {
  x: number;
  y: number;
  hasImages: boolean;
}

export function usePromptLayout(
  inputRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  placeholder: string,
  hasImages: boolean,
) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const previousFrame = useRef<PromptFrame | undefined>(undefined);
  const motion = useRef<Animation | undefined>(undefined);

  useLayoutEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      motion.current?.cancel();
    };
    preference.addEventListener('change', stop);
    return () => {
      preference.removeEventListener('change', stop);
      stop();
    };
  }, []);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    const input = inputRef.current;
    const editor = field?.closest<HTMLElement>('.prompt-editor');
    const stage = field?.closest<HTMLElement>('.prompt-stage');
    const workspace = stage?.parentElement;
    if (!field || !input || !editor || !stage || !workspace) return;

    let scheduled = 0;
    let lastSize = '';
    const areaSize = () =>
      [stage.clientWidth, stage.clientHeight, editor.clientWidth, editor.clientHeight].join(':');

    const update = () => {
      const visible = field.getBoundingClientRect();
      const animation = motion.current;
      const elapsed = animation?.currentTime;
      const timing = animation?.effect?.getTiming().duration;
      const remaining =
        typeof elapsed === 'number' && typeof timing === 'number'
          ? Math.max(0, timing - elapsed)
          : 0;
      animation?.cancel();
      motion.current = undefined;
      if (field.clientWidth === 0) {
        previousFrame.current = undefined;
        lastSize = areaSize();
        return;
      }

      const untransformed = field.getBoundingClientRect();
      const previous = previousFrame.current;
      const scrollTop = input.scrollTop;
      const stageStyle = getComputedStyle(stage);
      const availableHeight =
        stage.clientHeight -
        Number.parseFloat(stageStyle.paddingTop) -
        Number.parseFloat(stageStyle.paddingBottom) -
        (editor.clientHeight - field.offsetHeight);
      field.style.removeProperty('font-size');
      input.style.removeProperty('--prompt-height-limit');
      const style = getComputedStyle(field);
      const maximum = Number.parseFloat(style.fontSize);
      const heightLimit = Math.max(
        1,
        Math.min(
          Number.parseFloat(getComputedStyle(input).maxHeight),
          // Narrow layouts stack images below the prompt and grow with their content.
          window.matchMedia('(max-width: 780px)').matches ? Infinity : availableHeight,
        ),
      );
      input.style.setProperty('--prompt-height-limit', `${String(heightLimit)}px`);
      input.style.overflowY = 'hidden';
      input.style.height = `${String(heightLimit)}px`;

      const fits = (size: number) => {
        field.style.fontSize = `${String(size)}px`;
        return input.scrollHeight <= input.clientHeight;
      };
      if (!fits(maximum)) {
        let low = 24;
        let high = Math.floor(maximum);
        while (low < high) {
          const candidate = Math.ceil((low + high) / 2);
          if (fits(candidate)) low = candidate;
          else high = candidate - 1;
        }
        field.style.fontSize = `${String(low)}px`;
      }

      input.style.height = '0px';
      input.style.height = `${String(Math.min(input.scrollHeight, heightLimit))}px`;
      const scrollable = input.scrollHeight > input.clientHeight;
      input.style.overflowY = scrollable ? 'auto' : 'hidden';
      input.scrollTop = scrollable ? scrollTop : 0;

      const target = field.getBoundingClientRect();
      const origin = workspace.getBoundingClientRect();
      const next = {
        x: target.x - origin.x,
        y: target.y - origin.y,
        hasImages,
      };
      const duration = previous?.hasImages !== hasImages ? 360 : remaining;
      if (
        previous &&
        duration > 0 &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        // Carry the current visual position through a reversal without measuring each frame.
        const x = previous.x + visible.x - untransformed.x - next.x;
        const y = previous.y + visible.y - untransformed.y - next.y;
        motion.current = field.animate(
          [{ transform: `translate3d(${String(x)}px, ${String(y)}px, 0)` }, { transform: 'none' }],
          { duration, easing: style.getPropertyValue('--motion-surface-easing').trim() },
        );
      }
      previousFrame.current = next;
      lastSize = areaSize();
    };

    function schedule() {
      window.cancelAnimationFrame(scheduled);
      scheduled = window.requestAnimationFrame(update);
    }

    update();
    const resize = new ResizeObserver(() => {
      if (areaSize() !== lastSize) update();
    });
    resize.observe(stage);
    resize.observe(editor);
    const font = new MutationObserver(schedule);
    font.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font'] });
    document.fonts.addEventListener('loadingdone', schedule);
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(scheduled);
      resize.disconnect();
      font.disconnect();
      document.fonts.removeEventListener('loadingdone', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [hasImages, inputRef, placeholder, value]);

  return fieldRef;
}
