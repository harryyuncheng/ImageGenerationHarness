import { useRef, useState } from 'react';

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
