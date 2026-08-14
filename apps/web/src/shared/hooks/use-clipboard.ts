import type { Notify } from './use-toasts.js';

export function useClipboard(notify: Notify) {
  return async function copyText(value: string, message = 'Copied to clipboard.') {
    await navigator.clipboard.writeText(value);
    notify(message, 'success');
  };
}
