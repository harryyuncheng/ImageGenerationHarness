import { useCallback, useMemo } from 'react';
import { usePersistentState } from '../../shared/hooks/use-persistent-state.js';

/** Favorites are a browser-local marker, never part of repository data. */
export function useFavorites() {
  const [favoriteRunIds, setFavoriteRunIds] = usePersistentState<string[]>(
    'harness-favorite-runs',
    [],
  );
  const favoriteRuns = useMemo(() => new Set(favoriteRunIds), [favoriteRunIds]);

  function toggleFavorite(runId: string) {
    setFavoriteRunIds((current) =>
      current.includes(runId)
        ? current.filter((candidate) => candidate !== runId)
        : [runId, ...current],
    );
  }

  const dropFavorites = useCallback(
    (runIds: ReadonlySet<string>) => {
      setFavoriteRunIds((current) => {
        const remaining = current.filter((runId) => !runIds.has(runId));
        return remaining.length === current.length ? current : remaining;
      });
    },
    [setFavoriteRunIds],
  );

  return { favoriteRuns, toggleFavorite, dropFavorites };
}

export type FavoritesController = ReturnType<typeof useFavorites>;
