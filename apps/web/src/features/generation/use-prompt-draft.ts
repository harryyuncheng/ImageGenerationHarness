import { useRef, useState } from 'react';

/** The prompt text area and the focus behaviour shared by every surface that jumps back to it. */
export function usePromptDraft() {
  const [prompt, setPrompt] = useState('');
  const promptInput = useRef<HTMLTextAreaElement>(null);

  function focusPrompt() {
    promptInput.current?.focus();
  }

  /** Focus after the create view has been rendered again. */
  function focusPromptSoon() {
    window.setTimeout(() => promptInput.current?.focus(), 0);
  }

  return { prompt, setPrompt, promptInput, focusPrompt, focusPromptSoon };
}

export type PromptDraftController = ReturnType<typeof usePromptDraft>;
