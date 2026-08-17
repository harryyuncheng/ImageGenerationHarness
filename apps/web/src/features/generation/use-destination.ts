import { useState } from 'react';
import type { Destination } from '../../shared/types/domain.js';

/** The destination a queued run writes into. */
export function useDestination() {
  const [destination, setDestination] = useState<Destination>({ kind: 'main' });

  function resetDestination() {
    setDestination({ kind: 'main' });
  }

  return { destination, setDestination, resetDestination };
}

export type DestinationController = ReturnType<typeof useDestination>;
