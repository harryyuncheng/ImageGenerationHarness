import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { runMutation } from '../../shared/api/mutation.js';
import { queryKeys } from '../../shared/api/query-keys.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { Capability } from '../../shared/types/domain.js';
import { cancelRun, getRuns } from './api.js';
import { collectRunFailures, mergeRuns, toStudioRuns, type StudioRun } from './run-presentation.js';
import type { FavoritesController } from './use-favorites.js';

const pollingIntervalMs = 3000;

interface RunsOptions {
  activeRepositoryId: string | undefined;
  capabilities: readonly Capability[];
  favorites: FavoritesController;
  notify: Notify;
  focusedRunId: string | undefined;
  onFocusedRunFailed: () => void;
}

/**
 * Polling stays authoritative for durable run state. Optimistic tiles only cover
 * the gap between submitting a run and seeing it in a poll.
 */
export function useRuns(options: RunsOptions) {
  const { activeRepositoryId, capabilities, favorites, notify, focusedRunId } = options;
  const queryClient = useQueryClient();
  const [optimisticRuns, setOptimisticRuns] = useState<StudioRun[]>([]);
  const handledFailureIds = useRef(new Set<string>());
  const discardedRunIds = useRef(new Set<string>());
  const submittedRunIds = useRef(new Set<string>());

  const runsQuery = useQuery({
    queryKey: queryKeys.allRuns(activeRepositoryId),
    queryFn: getRuns,
    enabled: Boolean(activeRepositoryId),
    retry: false,
    refetchInterval: pollingIntervalMs,
  });

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
    if (focusedRunId !== undefined && failedIds.has(focusedRunId)) options.onFocusedRunFailed();
    for (const failure of unhandled) notify(failure.error, 'error');
  }, [runFailures, focusedRunId, optimisticRuns, favorites.dropFavorites]);

  /**
   * Draft ownership lasts only while the submitted run stays focused, which is what
   * carries it across the local-to-remote identity change. Focusing anything else
   * hands the draft back, so reopening that run from the gallery restores it again.
   */
  useEffect(() => {
    if (focusedRunId !== undefined && submittedRunIds.current.has(focusedRunId)) return;
    submittedRunIds.current.clear();
  }, [focusedRunId]);

  function addOptimisticRun(run: StudioRun) {
    submittedRunIds.current.add(run.id);
    setOptimisticRuns((current) => [run, ...current].slice(0, 20));
  }

  function markRunQueued(localId: string, remoteId: string) {
    submittedRunIds.current.add(remoteId);
    setOptimisticRuns((current) =>
      current.map((run) => (run.id === localId ? { ...run, remoteId, status: 'queued' } : run)),
    );
  }

  /**
   * A run keeps the composer draft it was submitted with, so loading it must not
   * overwrite edits made while it was still in flight.
   */
  function wasSubmittedHere(run: StudioRun): boolean {
    return (
      submittedRunIds.current.has(run.id) ||
      (run.remoteId !== undefined && submittedRunIds.current.has(run.remoteId))
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

  return {
    runsQuery,
    allRuns,
    addOptimisticRun,
    markRunQueued,
    wasSubmittedHere,
    discardOptimisticRun,
    invalidateRuns,
    cancel,
  };
}

export type RunsController = ReturnType<typeof useRuns>;
