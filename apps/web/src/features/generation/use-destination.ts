import { useEffect, useState } from 'react';
import type { Destination } from '../../shared/types/domain.js';

/** The destination a queued run writes into. It always resets with the repository. */
export function useDestination(activeRepositoryId: string | undefined) {
  const [destination, setDestination] = useState<Destination>({ kind: 'main' });

  useEffect(() => {
    setDestination({ kind: 'main' });
  }, [activeRepositoryId]);

  function resetDestination() {
    setDestination({ kind: 'main' });
  }

  return { destination, setDestination, resetDestination };
}

export type DestinationController = ReturnType<typeof useDestination>;
