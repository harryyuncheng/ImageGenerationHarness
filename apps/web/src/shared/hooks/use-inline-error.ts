import { useCallback, useState } from 'react';

export function useInlineError() {
  const [error, reportError] = useState<string>();
  const clearError = useCallback(() => {
    reportError(undefined);
  }, []);

  return { error, reportError, clearError };
}

export type InlineErrorController = ReturnType<typeof useInlineError>;
