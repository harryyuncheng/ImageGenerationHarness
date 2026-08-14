import { randomInt } from 'node:crypto';
import type { Destination, LocalJob, LocalRun, SeedPlan } from '@harness/domain';
import { z } from 'zod';
import { safeSlug } from '../repository/slug.js';

export function validateSeedPlan(seedPlan: SeedPlan, seedMaximum: number | undefined): void {
  if (seedMaximum === undefined) {
    z.literal('provider-random', {
      error: 'This image service does not accept a seed parameter',
    }).parse(seedPlan.strategy);
    return;
  }
  const seedSchema = z.number().int().min(0).max(seedMaximum);
  if (seedPlan.strategy === 'fixed-repeat') seedSchema.parse(seedPlan.seed);
  if (seedPlan.strategy === 'sequential') seedSchema.parse(seedPlan.start);
  if (seedPlan.strategy === 'explicit-list') {
    seedPlan.seeds.forEach((seed) => seedSchema.parse(seed));
  }
}

export function plannedSeed(
  seedPlan: SeedPlan,
  index: number,
  seedMaximum: number | undefined,
): number | null {
  if (seedMaximum === undefined) return null;
  switch (seedPlan.strategy) {
    case 'provider-random':
      return null;
    case 'harness-random':
      return randomInt(0, seedMaximum + 1);
    case 'fixed-repeat':
      return seedPlan.seed;
    case 'sequential':
      return (seedPlan.start + index) % (seedMaximum + 1);
    case 'explicit-list':
      return seedPlan.seeds[index % seedPlan.seeds.length] ?? null;
  }
}

export function runRecordPath(runId: string): string {
  return `.image-harness/runs/${runId}.json`;
}

export function jobRecordPath(jobId: string): string {
  return `.image-harness/jobs/${jobId}.json`;
}

export function promptSlug(request: Record<string, unknown>): string {
  const prompt = typeof request['prompt'] === 'string' ? request['prompt'] : 'generated-image';
  return safeSlug(prompt).slice(0, 48);
}

export function summarizeRunStatus(jobs: LocalJob[]): LocalRun['status'] {
  if (jobs.some((job) => job.status === 'running')) return 'running';
  if (jobs.some((job) => job.status === 'queued')) return 'queued';
  if (jobs.some((job) => job.status === 'interrupted')) return 'interrupted';
  if (jobs.every((job) => job.status === 'cancelled')) return 'cancelled';
  if (jobs.some((job) => job.status === 'failed')) return 'failed';
  return 'completed';
}

export function destinationMatches(
  record: { projectId?: string | undefined; projectAssetId?: string | undefined },
  destination: Destination,
): boolean {
  if (destination.kind === 'main') return !record.projectId && !record.projectAssetId;
  if (destination.kind === 'project') {
    return record.projectId === destination.projectId && !record.projectAssetId;
  }
  return (
    record.projectId === destination.projectId &&
    record.projectAssetId === destination.projectAssetId
  );
}

export function sameDestination(left: Destination, right: Destination): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'main' || right.kind === 'main') return true;
  if (left.projectId !== right.projectId) return false;
  return (
    left.kind !== 'project-asset' ||
    right.kind !== 'project-asset' ||
    left.projectAssetId === right.projectAssetId
  );
}
