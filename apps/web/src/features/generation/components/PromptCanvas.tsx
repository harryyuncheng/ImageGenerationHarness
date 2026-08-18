import { Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEventHandler, RefObject } from 'react';
import type { Capability } from '../../../shared/types/domain.js';
import { supportsPrompt, usesToolbarSettings } from '../capabilities.js';
import { selectCreateGreeting } from '../greeting.js';

export function PromptCanvas({
  capability,
  inputRef,
  value,
  negativePrompt,
  onChange,
  onNegativePromptChange,
  onKeyDown,
}: {
  capability: Capability;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  negativePrompt: string;
  onChange: (value: string) => void;
  onNegativePromptChange: (value: string) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  const [greeting] = useState(() => selectCreateGreeting(new Date()));
  const [negativeRequested, setNegativeRequested] = useState(false);
  const negativeInput = useRef<HTMLTextAreaElement>(null);
  const negativeToggle = useRef<HTMLButtonElement>(null);
  const moveFocusOnToggle = useRef(false);
  const placeholder = supportsPrompt(capability)
    ? greeting
    : 'This tool only needs a source image.';
  const offersNegativePrompt = usesToolbarSettings(capability);
  const showNegativePrompt = negativeRequested || negativePrompt.length > 0;

  // Expanding and collapsing swaps the focused control, so focus has to follow it.
  useEffect(() => {
    if (!moveFocusOnToggle.current) return;
    moveFocusOnToggle.current = false;
    if (showNegativePrompt) negativeInput.current?.focus();
    else negativeToggle.current?.focus();
  }, [showNegativePrompt]);

  return (
    <div className="prompt-canvas">
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
      {offersNegativePrompt &&
        (showNegativePrompt ? (
          <div className="prompt-negative">
            <div className="prompt-negative-header">
              <span className="prompt-negative-label">Negative prompt</span>
              <button
                type="button"
                className="prompt-negative-remove"
                title="Remove negative prompt"
                aria-label="Remove negative prompt"
                onClick={() => {
                  moveFocusOnToggle.current = true;
                  onNegativePromptChange('');
                  setNegativeRequested(false);
                }}
              >
                <X size={13} />
              </button>
            </div>
            <textarea
              ref={negativeInput}
              className="prompt-negative-input"
              value={negativePrompt}
              onChange={(event) => {
                onNegativePromptChange(event.target.value);
              }}
              rows={2}
              maxLength={10_000}
              placeholder="What should not appear?"
              aria-label="Negative prompt"
              spellCheck="true"
            />
          </div>
        ) : (
          <button
            ref={negativeToggle}
            type="button"
            className="prompt-negative-toggle"
            onClick={() => {
              moveFocusOnToggle.current = true;
              setNegativeRequested(true);
            }}
          >
            <Plus size={13} />
            Add negative prompt
          </button>
        ))}
    </div>
  );
}
