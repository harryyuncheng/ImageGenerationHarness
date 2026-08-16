import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { runMutation } from '../../shared/api/mutation.js';
import { queryKeys } from '../../shared/api/query-keys.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { Capability } from '../../shared/types/domain.js';
import type { EditorSelectionController } from '../editor/use-editor-selection.js';
import { cancelRun, getRuns, retryRun } from './api.js';
import { collectRunFailures, mergeRuns, toStudioRuns, type StudioRun } from './run-presentation.js';
import type { FavoritesController } from './use-favorites.js';

const pollingIntervalMs = 3000;

interface RunsOptions {
  activeRepositoryId: string | undefined;
  capabilities: readonly Capability[];
  favorites: FavoritesController;
  editor: EditorSelectionController;
  notify: Notify;
  onFailedRunDismissed: () => void;
}

/**
 * Polling stays authoritative for durable run state. Optimistic tiles only cover
 * the gap between submitting a run and seeing it in a poll.
 */
export function useRuns(options: RunsOptions) {
  const { activeRepositoryId, capabilities, favorites, editor, notify } = options;
  const queryClient = useQueryClient();
  const [optimisticRuns, setOptimisticRuns] = useState<StudioRun[]>([]);
  const handledFailureIds = useRef(new Set<string>());
  const discardedRunIds = useRef(new Set<string>());

  const runsQuery = useQuery({
    queryKey: queryKeys.allRuns(activeRepositoryId),
    queryFn: getRuns,
    enabled: Boolean(activeRepositoryId),
    retry: false,
    refetchInterval: pollingIntervalMs,
  });

  useEffect(() => {
    setOptimisticRuns([]);
    handledFailureIds.current.clear();
    discardedRunIds.current.clear();
  }, [activeRepositoryId]);

  const runFailures = useMemo(() => collectRunFailures(runsQuery.data), [runsQuery.data]);
  const durableRuns = useMemo(
    () => toStudioRuns(runsQuery.data, capabilities, favorites.favoriteRuns),
    [capabilities, favorites.favoriteRuns, runsQuery.data],
  );
  const allRuns = mergeRuns(optimisticRuns, durableRuns);

  useEffect(() => {
    const unhandled = runFailures.filter(
      (failure) => !handledFailureIds.current.has(failure.runId),
    );
    for (const failure of runFailures) {
      if (failure.discarded) discardedRunIds.current.add(failure.runId);
    }
    for (const failure of unhandled) {
      handledFailureIds.current.add(failure.runId);
    }
    const failedIds = discardedRunIds.current;
    if (failedIds.size === 0 && unhandled.length === 0) return;
    setOptimisticRuns((current) => {
      const remaining = current.filter(
        (run) => !failedIds.has(run.id) && (!run.remoteId || !failedIds.has(run.remoteId)),
      );
      return remaining.length === current.length ? current : remaining;
    });
    favorites.dropFavorites(failedIds);
    if (editor.showsFailedRun(failedIds)) options.onFailedRunDismissed();
    for (const failure of unhandled) notify(failure.error, 'error');
  }, [runFailures, editor.selection, optimisticRuns, favorites.dropFavorites]);

  function addOptimisticRun(run: StudioRun) {
    setOptimisticRuns((current) => [run, ...current].slice(0, 20));
  }

  function markRunQueued(localId: string, remoteId: string) {
    setOptimisticRuns((current) =>
      current.map((run) => (run.id === localId ? { ...run, remoteId, status: 'queued' } : run)),
    );
  }

  function discardOptimisticRun(localId: string) {
    setOptimisticRuns((current) => current.filter((run) => run.id !== localId));
  }

  function invalidateRuns() {
    return queryClient.invalidateQueries({ queryKey: queryKeys.runs(activeRepositoryId) });
  }

  async function cancel(run: StudioRun) {
    if (!run.remoteId) return;
    const result = await runMutation(
      () => cancelRun(run.remoteId ?? ''),
      'Could not cancel the run.',
      (message) => {
        notify(message, 'error');
      },
    );
    if (!result.ok) return;
    await invalidateRuns();
    notify('Queued work cancelled. Active Bedrock calls may still finish.', 'success');
  }

  async function retry(run: StudioRun) {
    if (!run.remoteId) return;
    const result = await runMutation(
      () => retryRun(run.remoteId ?? ''),
      'Could not retry the run.',
      (message) => {
        notify(message, 'error');
      },
    );
    if (!result.ok) return;
    await invalidateRuns();
    notify('Run queued for an explicit retry.', 'success');
  }

  return {
    runsQuery,
    allRuns,
    addOptimisticRun,
    markRunQueued,
    discardOptimisticRun,
    invalidateRuns,
    cancel,
    retry,
  };
}

export type RunsController = ReturnType<typeof useRuns>;
