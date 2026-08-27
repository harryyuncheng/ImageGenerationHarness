import { useCallback, useState } from 'react';

interface DialogCopy {
  title: string;
  body?: string;
  confirmLabel: string;
}

export interface ConfirmOptions extends DialogCopy {
  danger?: boolean;
}

export interface PromptOptions extends DialogCopy {
  label: string;
  placeholder?: string;
  initialValue?: string;
  /** Descriptions may legitimately be cleared, unlike names. */
  allowEmpty?: boolean;
}

export type DialogRequest =
  | (ConfirmOptions & { kind: 'confirm'; resolve: (confirmed: boolean) => void })
  | (PromptOptions & { kind: 'prompt'; resolve: (value: string | null) => void });

export type Confirm = (options: ConfirmOptions) => Promise<boolean>;
export type Prompt = (options: PromptOptions) => Promise<string | null>;

export interface DialogController {
  request: DialogRequest | undefined;
  confirm: Confirm;
  prompt: Prompt;
  submit: (value: string) => void;
  cancel: () => void;
}

/** Replaces the browser's blocking dialogs with an in-app surface the studio can style. */
export function useDialogs(): DialogController {
  const [request, setRequest] = useState<DialogRequest>();

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise((resolve) => {
        setRequest({ ...options, kind: 'confirm', resolve });
      }),
    [],
  );

  const prompt = useCallback<Prompt>(
    (options) =>
      new Promise((resolve) => {
        setRequest({ ...options, kind: 'prompt', resolve });
      }),
    [],
  );

  function submit(value: string) {
    if (!request) return;
    if (request.kind === 'confirm') request.resolve(true);
    else request.resolve(value);
    setRequest(undefined);
  }

  function cancel() {
    if (!request) return;
    if (request.kind === 'confirm') request.resolve(false);
    else request.resolve(null);
    setRequest(undefined);
  }

  return { request, confirm, prompt, submit, cancel };
}
