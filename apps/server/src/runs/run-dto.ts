import { jobDtoSchema, runDtoSchema, runSnapshotSchema } from '@harness/contracts';
import type { LocalJob, LocalRun } from '@harness/domain';
import type { RunSnapshot } from './run-types.js';

function localRunDto(run: LocalRun) {
  return runDtoSchema.parse({
    schemaVersion: run.schemaVersion,
    runId: run.runId,
    status: run.status,
    registryVersion: run.registryVersion,
    targetId: run.targetId,
    destination: run.destination,
    requestedJobCount: run.requestedJobCount,
    seedPlan: run.seedPlan,
    ...(run.prompt === undefined ? {} : { prompt: run.prompt }),
    jobIds: run.jobIds,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  });
}

function localJobDto(job: LocalJob) {
  return jobDtoSchema.parse({
    schemaVersion: job.schemaVersion,
    runId: job.runId,
    jobId: job.jobId,
    status: job.status,
    targetId: job.targetId,
    destination: job.destination,
    plannedSeed: job.plannedSeed,
    providerSeed: job.providerSeed,
    outputImageIds: job.outputImageIds,
    attempts: job.attempts.map((attempt) => ({
      attemptId: attempt.attemptId,
      ordinal: attempt.ordinal,
      status: attempt.status,
      startedAt: attempt.startedAt,
      ...(attempt.finishedAt === undefined ? {} : { finishedAt: attempt.finishedAt }),
      ...(attempt.providerRequestId === undefined
        ? {}
        : { providerRequestId: attempt.providerRequestId }),
      ...(attempt.errorCode === undefined ? {} : { errorCode: attempt.errorCode }),
      ...(attempt.errorMessage === undefined ? {} : { errorMessage: attempt.errorMessage }),
    })),
    ...(job.errorCode === undefined ? {} : { errorCode: job.errorCode }),
    ...(job.errorMessage === undefined ? {} : { errorMessage: job.errorMessage }),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  });
}

export function runSnapshotDto(snapshot: RunSnapshot) {
  return runSnapshotSchema.parse({
    run: localRunDto(snapshot.run),
    jobs: snapshot.jobs.map(localJobDto),
  });
}
