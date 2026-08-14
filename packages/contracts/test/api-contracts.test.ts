import { describe, expect, it } from 'vitest';
import {
  SCHEMA_VERSION,
  generationFailureSchema,
  jobDtoSchema,
  projectDtoSchema,
  runsResponseSchema,
} from '../src/index.js';

const NOW = '2026-08-10T12:00:00.000Z';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const RUN_ID = '22222222-2222-4222-8222-222222222222';
const JOB_ID = '33333333-3333-4333-8333-333333333333';

describe('public API contracts', () => {
  it('rejects internal project paths instead of silently exposing them', () => {
    expect(
      projectDtoSchema.safeParse({
        projectId: PROJECT_ID,
        name: 'Project',
        description: '',
        createdAt: NOW,
        updatedAt: NOW,
        directory: `projects/project--${PROJECT_ID}`,
      }).success,
    ).toBe(false);
  });

  it('rejects the retired generated-asset identifier alias', () => {
    expect(
      jobDtoSchema.safeParse({
        schemaVersion: SCHEMA_VERSION,
        runId: RUN_ID,
        jobId: JOB_ID,
        status: 'queued',
        targetId: 'generation/core',
        destination: { kind: 'main' },
        plannedSeed: null,
        providerSeed: null,
        outputImageIds: [],
        outputAssetIds: [],
        attempts: [],
        createdAt: NOW,
        updatedAt: NOW,
      }).success,
    ).toBe(false);
  });

  it('keeps discarded generation errors minimal and defaults polling failures to empty', () => {
    expect(
      generationFailureSchema.parse({
        runId: RUN_ID,
        error: 'Provider rejected the request',
        discarded: true,
      }),
    ).toEqual({ runId: RUN_ID, error: 'Provider rejected the request', discarded: true });
    expect(
      generationFailureSchema.safeParse({
        runId: RUN_ID,
        error: 'Provider rejected the request',
        discarded: true,
        prompt: 'must not be retained in the failure event',
      }).success,
    ).toBe(false);
    expect(runsResponseSchema.parse({ runs: [] })).toEqual({ runs: [], failures: [] });
  });
});
