import { useCallback, useState } from 'react';

/**
 * Tones are drawn with ink and iconography rather than hue: the studio palettes
 * are monochrome, so a coloured severity scale would not survive a theme swap.
 */
export type AlertTone = 'error' | 'warning' | 'info';

export interface StudioAlert {
  tone: AlertTone;
  message: string;
}

export function useAlert() {
  const [alert, setAlert] = useState<StudioAlert>();

  const reportError = useCallback((message: string) => {
    setAlert({ tone: 'error', message });
  }, []);
  const reportWarning = useCallback((message: string) => {
    setAlert({ tone: 'warning', message });
  }, []);
  const reportNotice = useCallback((message: string) => {
    setAlert({ tone: 'info', message });
  }, []);
  const clearAlert = useCallback(() => {
    setAlert(undefined);
  }, []);

  return { alert, reportError, reportWarning, reportNotice, clearAlert };
}

export type AlertController = ReturnType<typeof useAlert>;
