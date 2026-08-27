import { MEDIA_TYPES } from '@harness/contracts';
import type { ChangeEvent, RefObject } from 'react';

/** The studio's file pickers stay mounted so shortcuts can open them at any time. */
export function HiddenFileInputs({
  promptInput,
  styleGuideInput,
  onPromptFiles,
  onStyleGuideFiles,
}: {
  promptInput: RefObject<HTMLInputElement | null>;
  styleGuideInput: RefObject<HTMLInputElement | null>;
  onPromptFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onStyleGuideFiles: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <input
        ref={promptInput}
        className="visually-hidden"
        type="file"
        accept={MEDIA_TYPES.join(',')}
        multiple
        onChange={onPromptFiles}
      />
      <input
        ref={styleGuideInput}
        className="visually-hidden"
        type="file"
        accept={MEDIA_TYPES.join(',')}
        multiple
        onChange={onStyleGuideFiles}
      />
    </>
  );
}
