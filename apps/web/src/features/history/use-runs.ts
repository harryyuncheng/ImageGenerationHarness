import type { QueuedRunResponse } from '@harness/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { runMutation } from '../../shared/api/mutation.js';
import { queryKeys } from '../../shared/api/query-keys.js';
import { useAlert } from '../../shared/hooks/use-alert.js';
import type { Capability } from '../../shared/types/domain.js';
import { cancelRun, getRuns } from './api.js';
import { collectRunFailures, mergeRuns, toStudioRuns, type StudioRun } from './run-presentation.js';

const pollingIntervalMs = 3000;

interface RunsOptions {
  activeRepositoryId: string | undefined;
  capabilities: readonly Capability[];
  focusedRunId: string | undefined;
  onFocusedRunFailed: () => void;
}

/**
 * Polling stays authoritative for durable run state. Optimistic tiles only cover
 * the gap between submitting a run and seeing it in a poll.
 */
export function useRuns(options: RunsOptions) {
  const { activeRepositoryId, capabilities, focusedRunId } = options;
  const feedback = useAlert();
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

  const { reportError } = feedback;
  useEffect(() => {
    if (runsQuery.error) reportError(`Run status unavailable: ${runsQuery.error.message}`);
  }, [runsQuery.error, reportError]);

  const runFailures = useMemo(() => collectRunFailures(runsQuery.data), [runsQuery.data]);
  const durableRuns = useMemo(
    () => toStudioRuns(runsQuery.data, capabilities),
    [capabilities, runsQuery.data],
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
    if (focusedRunId !== undefined && failedIds.has(focusedRunId)) options.onFocusedRunFailed();
    if (unhandled.length > 0) {
      feedback.reportError(unhandled.map((failure) => failure.error).join('\n'));
    }
  }, [runFailures, focusedRunId, optimisticRuns]);

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
    submittedRunIds.current.clear();
    submittedRunIds.current.add(run.id);
    setOptimisticRuns((current) => [run, ...current].slice(0, 20));
  }

  function markRunQueued(localId: string, queued: QueuedRunResponse) {
    if (submittedRunIds.current.has(localId)) submittedRunIds.current.add(queued.runId);
    setOptimisticRuns((current) =>
      current.map((run) =>
        run.id === localId
          ? {
              ...run,
              remoteId: queued.runId,
              status: 'queued',
              jobs: queued.jobs.map((job) => ({
                id: job.jobId,
                status: 'queued',
                requestedOutputCount: job.requestedOutputCount,
                outputImageIds: [],
              })),
            }
          : run,
      ),
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
    feedback.clearAlert();
    const result = await runMutation(
      () => cancelRun(run.remoteId ?? ''),
      'Could not cancel the run.',
      feedback.reportError,
    );
    if (!result.ok) return;
    await invalidateRuns();
  }

  return {
    feedback,
    runsQuery,
    allRuns,
    addOptimisticRun,
    markRunQueued,
    wasSubmittedHere,
    releaseDraft: () => {
      submittedRunIds.current.clear();
    },
    discardOptimisticRun,
    invalidateRuns,
    cancel,
  };
}

export type RunsController = ReturnType<typeof useRuns>;
