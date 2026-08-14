import type { RunStatus as DurableRunStatus, RunsResponse } from '@harness/contracts';
import type {
  Capability,
  Destination,
  Project,
  ProjectDetailResponse,
} from '../../shared/types/domain.js';
import { capabilityLabel, resolveCapability } from '../generation/capabilities.js';

export type RunStatus = DurableRunStatus | 'submitting';

export interface StudioRun {
  id: string;
  remoteId?: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  targetId: string;
  targetName: string;
  aspectRatio: string;
  outputCount: number;
  attachmentNames: string[];
  outputImageIds?: string[];
  destination: Destination;
  status: RunStatus;
  error?: string;
  favorite: boolean;
}

export interface RunFailure {
  runId: string;
  error: string;
  discarded: boolean;
}

/**
 * Server-reported failures plus failed run snapshots. A failed snapshot is always
 * treated as discarded so the optimistic tile disappears with its toast.
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
  favoriteRuns: ReadonlySet<string>,
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
        aspectRatio: 'saved settings',
        outputCount: run.requestedJobCount,
        attachmentNames: [],
        outputImageIds: jobs.flatMap((job) => job.outputImageIds),
        destination: run.destination,
        status: run.status,
        ...(error ? { error } : {}),
        favorite: favoriteRuns.has(run.runId),
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

export function sortByRecentActivity(runs: readonly StudioRun[]): StudioRun[] {
  return [...runs].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.createdAt.localeCompare(left.createdAt),
  );
}

export function runDestinationLabel(
  value: Destination,
  projects: readonly Project[],
  detail: ProjectDetailResponse | undefined,
): string {
  if (value.kind === 'main') return 'Main repository';
  const project = projects.find((candidate) => candidate.projectId === value.projectId);
  if (value.kind === 'project') return project?.name ?? 'Project';
  const asset =
    detail?.project.projectId === value.projectId
      ? detail.assets.find((candidate) => candidate.assetId === value.projectAssetId)
      : undefined;
  return asset
    ? `${project?.name ?? 'Project'} / ${asset.name}`
    : (project?.name ?? 'Project asset');
}
