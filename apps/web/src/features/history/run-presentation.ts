import type { RunStatus as DurableRunStatus, RunsResponse } from '@harness/contracts';
import type { Capability } from '../../shared/types/domain.js';
import { capabilityLabel, resolveCapability } from '../generation/capabilities.js';

export type RunStatus = DurableRunStatus | 'submitting';

export function isTerminalWithoutOutputStatus(status: RunStatus): boolean {
  return status === 'failed' || status === 'cancelled' || status === 'interrupted';
}

export interface StudioRun {
  id: string;
  remoteId?: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  targetId: string;
  targetName: string;
  aspectRatio?: number;
  outputCount: number;
  attachmentNames: string[];
  jobs: {
    id: string;
    status: RunStatus;
    requestedOutputCount: number;
    outputImageIds: string[];
  }[];
  status: RunStatus;
  error?: string;
}

interface RunFailure {
  runId: string;
  error: string;
  discarded: boolean;
}

/**
 * Server-reported failures plus failed run snapshots. A failed snapshot is always
 * treated as discarded so failed optimistic tiles never become gallery entries.
 */
export function collectRunFailures(data: RunsResponse | undefined): RunFailure[] {
  const failures = new Map<string, { error: string; discarded: boolean }>();
  for (const failure of data?.failures ?? []) {
    failures.set(failure.runId, { error: failure.error, discarded: failure.discarded });
  }
  for (const { run, jobs } of data?.runs ?? []) {
    if (run.status !== 'failed') continue;
    failures.set(run.runId, {
      error: jobs.find((job) => job.errorMessage)?.errorMessage ?? 'Generation failed.',
      discarded: true,
    });
  }
  return [...failures].map(([runId, failure]) => ({ runId, ...failure }));
}

export function toStudioRuns(
  data: RunsResponse | undefined,
  capabilities: readonly Capability[],
): StudioRun[] {
  return (data?.runs ?? [])
    .filter(({ run }) => run.status !== 'failed')
    .map(({ run, jobs }) => {
      const capability = resolveCapability(capabilities, run.targetId);
      const error = jobs.find((job) => job.errorMessage)?.errorMessage;
      return {
        id: run.runId,
        remoteId: run.runId,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        prompt: run.prompt ?? '',
        targetId: run.targetId,
        targetName: capabilityLabel(capability),
        ...(run.aspectRatio === undefined ? {} : { aspectRatio: run.aspectRatio }),
        outputCount: run.requestedJobCount,
        attachmentNames: [],
        jobs: jobs.map((job) => ({
          id: job.jobId,
          status: job.status,
          requestedOutputCount: job.requestedOutputCount,
          outputImageIds: job.outputImageIds,
        })),
        status: run.status,
        ...(error ? { error } : {}),
      };
    });
}

/** Durable snapshots always win over the optimistic tile that produced them. */
export function mergeRuns(
  optimisticRuns: readonly StudioRun[],
  durableRuns: readonly StudioRun[],
): StudioRun[] {
  const durableIds = new Set(durableRuns.map((run) => run.remoteId));
  return [...optimisticRuns.filter((run) => !durableIds.has(run.remoteId)), ...durableRuns].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}
