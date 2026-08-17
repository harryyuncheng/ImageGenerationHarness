import { useState } from 'react';
import type { KeyboardEventHandler, RefObject } from 'react';
import type { Capability } from '../../../shared/types/domain.js';
import { supportsPrompt } from '../capabilities.js';
import { selectCreateGreeting } from '../greeting.js';

export function PromptCanvas({
  capability,
  inputRef,
  value,
  onChange,
  onKeyDown,
}: {
  capability: Capability;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  const [greeting] = useState(() => selectCreateGreeting(new Date()));
  const placeholder = supportsPrompt(capability)
    ? greeting
    : 'This tool only needs a source image.';

  return (
    <div className={`prompt-canvas-field ${value.length === 0 ? 'is-empty' : ''}`}>
      <span className="prompt-canvas-placeholder" aria-hidden="true">
        {placeholder}
      </span>
      <textarea
        ref={inputRef}
        className="prompt-canvas-input"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        rows={5}
        maxLength={10_000}
        placeholder={placeholder}
        aria-label="Image prompt"
        spellCheck="true"
      />
    </div>
  );
}
