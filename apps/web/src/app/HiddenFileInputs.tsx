import { MEDIA_TYPES } from '@harness/contracts';
import type { ChangeEvent, RefObject } from 'react';

/** The studio's file pickers stay mounted so shortcuts can open them at any time. */
export function HiddenFileInputs({
  promptInput,
  libraryInput,
  onPromptFiles,
  onLibraryFiles,
}: {
  promptInput: RefObject<HTMLInputElement | null>;
  libraryInput: RefObject<HTMLInputElement | null>;
  onPromptFiles: (event: ChangeEvent<HTMLInputElement>) => void;
  onLibraryFiles: (event: ChangeEvent<HTMLInputElement>) => void;
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
        ref={libraryInput}
        className="visually-hidden"
        type="file"
        accept={MEDIA_TYPES.join(',')}
        multiple
        onChange={onLibraryFiles}
      />
    </>
  );
}
