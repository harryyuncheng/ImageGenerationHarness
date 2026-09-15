import { localJobSchema, localRunSchema, type LocalJob } from '@harness/domain';
import type { GeneratedImageStore } from '../images/generated-image-store.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import { jobRecordPath, runRecordPath, summarizeRunStatus } from './run-helpers.js';
import type { RunSnapshot } from './run-types.js';

export class RunStore {
  constructor(private readonly images: GeneratedImageStore) {}

  /** Streams job records so callers can stop before reading the whole directory. */
  async forEachJob(
    repository: LocalImageRepository,
    visit: (job: LocalJob) => Promise<boolean> | boolean,
  ): Promise<boolean> {
    for (const file of await repository.listFiles('.image-harness/jobs')) {
      if (!file.endsWith('.json')) continue;
      const path = `.image-harness/jobs/${file}`;
      const job = await repository.readJson(path, localJobSchema);
      if (jobRecordPath(job.jobId) !== path) {
        throw new Error('A job record has an invalid file binding.');
      }
      if (!(await visit(job))) return false;
    }
    return true;
  }

  async listJobs(repository: LocalImageRepository): Promise<LocalJob[]> {
    const jobs: LocalJob[] = [];
    await this.forEachJob(repository, (job) => {
      jobs.push(job);
      return true;
    });
    return jobs;
  }

  async listSnapshots(repository: LocalImageRepository): Promise<RunSnapshot[]> {
    const snapshots: RunSnapshot[] = [];
    for (const file of await repository.listFiles('.image-harness/runs')) {
      if (!file.endsWith('.json')) continue;
      const snapshot = await this.getSnapshot(repository, file.slice(0, -5));
      if (snapshot) snapshots.push(snapshot);
    }
    return snapshots;
  }

  async getSnapshot(
    repository: LocalImageRepository,
    runId: string,
  ): Promise<RunSnapshot | undefined> {
    return repository.withMutation(async () => {
      const path = runRecordPath(runId);
      if (!(await repository.exists(path))) return undefined;
      const run = await repository.readJson(path, localRunSchema);
      if (run.runId !== runId || new Set(run.jobIds).size !== run.jobIds.length) {
        throw new Error('A run record has an invalid file or job binding.');
      }
      const jobs: LocalJob[] = [];
      for (const jobId of run.jobIds) {
        const path = jobRecordPath(jobId);
        if (!(await repository.exists(path))) return undefined;
        const job = await repository.readJson(path, localJobSchema);
        if (job.jobId !== jobId || job.runId !== runId || job.targetId !== run.targetId) {
          throw new Error('A job record has an invalid run or file binding.');
        }
        jobs.push(job);
      }
      const updatedAt = jobs.reduce(
        (latest, job) => (Date.parse(job.updatedAt) > Date.parse(latest) ? job.updatedAt : latest),
        run.updatedAt,
      );
      return { run: { ...run, status: summarizeRunStatus(jobs), updatedAt }, jobs };
    });
  }

  async refreshRun(repository: LocalImageRepository, runId: string): Promise<void> {
    await repository.withMutation(async () => {
      const snapshot = await this.getSnapshot(repository, runId);
      if (!snapshot) return;
      const updated = localRunSchema.parse({
        ...snapshot.run,
        updatedAt: new Date().toISOString(),
      });
      await repository.writeJson(runRecordPath(runId), updated, localRunSchema);
    });
  }

  async interruptJob(repository: LocalImageRepository, jobId: string): Promise<void> {
    await repository.withMutation(async () => {
      const path = jobRecordPath(jobId);
      if (!(await repository.exists(path))) return;
      const job = await repository.readJson(path, localJobSchema);
      if (job.jobId !== jobId) throw new Error('A job record has an invalid file binding.');
      if (job.status === 'running') {
        const now = new Date().toISOString();
        const errorMessage =
          'Processing stopped before the attempt could be finalized. The provider outcome and billing may be ambiguous. Retry explicitly.';
        const interrupted = localJobSchema.parse({
          ...job,
          status: 'interrupted',
          attempts: job.attempts.map((attempt) =>
            attempt.status === 'started'
              ? {
                  ...attempt,
                  status: 'ambiguous',
                  finishedAt: now,
                  errorCode: 'Interrupted',
                  errorMessage,
                }
              : attempt,
          ),
          errorCode: 'Interrupted',
          errorMessage,
          updatedAt: now,
        });
        await repository.writeJson(path, interrupted, localJobSchema);
      }
      await this.refreshRun(repository, job.runId);
    });
  }

  async discardFailedJob(repository: LocalImageRepository, job: LocalJob): Promise<boolean> {
    const inputPaths = new Set(
      job.inputs
        .map((input) => input.repositoryRelativePath)
        .filter((path) => path.startsWith('.image-harness/inputs/')),
    );
    let discarded = true;
    await repository.withMutation(async () => {
      const runPath = runRecordPath(job.runId);
      if (await repository.exists(runPath)) {
        const run = await repository.readJson(runPath, localRunSchema);
        const remainingJobs: LocalJob[] = [];
        for (const jobId of run.jobIds.filter((candidate) => candidate !== job.jobId)) {
          const path = jobRecordPath(jobId);
          if (await repository.exists(path)) {
            remainingJobs.push(await repository.readJson(path, localJobSchema));
          }
        }
        if (remainingJobs.length === 0) {
          await repository.removeRelative(runPath, { missingOk: true });
        } else {
          discarded = false;
          const updated = localRunSchema.parse({
            ...run,
            status: summarizeRunStatus(remainingJobs),
            requestedJobCount: remainingJobs.length,
            jobIds: remainingJobs.map((candidate) => candidate.jobId),
            updatedAt: new Date().toISOString(),
          });
          await repository.writeJson(runPath, updated, localRunSchema);
        }
      }
      await repository.removeRelative(jobRecordPath(job.jobId), { missingOk: true });
      await this.#removeUnreferencedInputs(repository, inputPaths);
    });
    return discarded;
  }

  async #removeUnreferencedInputs(
    repository: LocalImageRepository,
    candidates: Set<string>,
  ): Promise<void> {
    if (candidates.size === 0) return;
    await this.forEachJob(repository, (job) => {
      for (const input of job.inputs) candidates.delete(input.repositoryRelativePath);
      return candidates.size > 0;
    });
    if (candidates.size === 0) return;
    await this.images.walk(repository, (sidecar) => {
      for (const input of sidecar.inputs) candidates.delete(input.repositoryRelativePath);
    });
    for (const path of candidates) {
      await repository.removeRelative(path, { missingOk: true });
    }
  }
}
