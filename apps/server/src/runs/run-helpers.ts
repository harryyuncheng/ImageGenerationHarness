import { randomInt } from 'node:crypto';
import { jobDtoSchema } from '@harness/contracts';
import type { LocalJob, LocalRun, SeedPlan } from '@harness/domain';
import { z } from 'zod';
import { safeSlug } from '../repository/slug.js';

export function validateSeedPlan(seedPlan: SeedPlan, seedMaximum: number | undefined): void {
  if (seedMaximum === undefined) {
    z.literal('provider-random', {
      error: 'This image service does not accept a seed parameter',
    }).parse(seedPlan.strategy);
    return;
  }
  const seedSchema = z
    .number()
    .int()
    .min(1, { error: 'Seed 0 requests provider randomness. Use a seed of at least 1.' })
    .max(seedMaximum);
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
      return randomInt(1, seedMaximum + 1);
    case 'fixed-repeat':
      return seedPlan.seed;
    case 'sequential':
      return ((seedPlan.start + index - 1) % seedMaximum) + 1;
    case 'explicit-list':
      return seedPlan.seeds[index % seedPlan.seeds.length] ?? null;
  }
}

export function requestedOutputCount(job: LocalJob): number {
  return jobDtoSchema.shape.requestedOutputCount.parse(
    job.request['n'] === undefined ? 1 : job.request['n'],
  );
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
