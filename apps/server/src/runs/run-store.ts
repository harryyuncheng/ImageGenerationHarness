import { localJobSchema, localRunSchema, type LocalJob, type LocalRun } from '@harness/domain';
import { imageSidecarPath } from '@harness/image';
import type { GeneratedImageStore } from '../images/generated-image-store.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import { jobRecordPath, runRecordPath, summarizeRunStatus } from './run-helpers.js';
import type { PublishedOutput, RunSnapshot } from './run-types.js';

export class RunStore {
  constructor(private readonly images: GeneratedImageStore) {}

  /** Streams job records so callers can stop before reading the whole directory. */
  async forEachJob(
    repository: LocalImageRepository,
    visit: (job: LocalJob) => Promise<boolean> | boolean,
  ): Promise<void> {
    for (const file of await repository.listFiles('.image-harness/jobs')) {
      if (!file.endsWith('.json')) continue;
      const job = await repository.readJson(`.image-harness/jobs/${file}`, localJobSchema);
      if (!(await visit(job))) return;
    }
  }

  async listJobs(repository: LocalImageRepository): Promise<LocalJob[]> {
    const jobs: LocalJob[] = [];
    await this.forEachJob(repository, (job) => {
      jobs.push(job);
      return true;
    });
    return jobs;
  }

  /** Reads job records only for the runs a caller actually wants. */
  async listSnapshots(
    repository: LocalImageRepository,
    matches: (run: LocalRun) => boolean = () => true,
  ): Promise<RunSnapshot[]> {
    const snapshots: RunSnapshot[] = [];
    for (const file of await repository.listFiles('.image-harness/runs')) {
      if (!file.endsWith('.json')) continue;
      const run = await repository.readJson(`.image-harness/runs/${file}`, localRunSchema);
      if (!matches(run)) continue;
      const jobs: LocalJob[] = [];
      let complete = true;
      for (const jobId of run.jobIds) {
        const path = jobRecordPath(jobId);
        if (!(await repository.exists(path))) {
          complete = false;
          break;
        }
        jobs.push(await repository.readJson(path, localJobSchema));
      }
      if (complete) snapshots.push({ run, jobs });
    }
    return snapshots;
  }

  async getSnapshot(
    repository: LocalImageRepository,
    runId: string,
  ): Promise<RunSnapshot | undefined> {
    const path = runRecordPath(runId);
    if (!(await repository.exists(path))) return undefined;
    const run = await repository.readJson(path, localRunSchema);
    const jobs: LocalJob[] = [];
    for (const jobId of run.jobIds) {
      const path = jobRecordPath(jobId);
      if (!(await repository.exists(path))) return undefined;
      jobs.push(await repository.readJson(path, localJobSchema));
    }
    return { run, jobs };
  }

  async refreshRun(repository: LocalImageRepository, runId: string): Promise<void> {
    const snapshot = await this.getSnapshot(repository, runId);
    if (!snapshot) return;
    const updated = localRunSchema.parse({
      ...snapshot.run,
      status: summarizeRunStatus(snapshot.jobs),
      updatedAt: new Date().toISOString(),
    });
    await repository.writeJson(runRecordPath(runId), updated, localRunSchema);
  }

  async discardFailedJob(
    repository: LocalImageRepository,
    job: LocalJob,
    publishedOutputs: readonly PublishedOutput[] = [],
  ): Promise<boolean> {
    const inputPaths = new Set(job.inputs.map((input) => input.repositoryRelativePath));
    let discarded = true;
    await repository.withMutation(async () => {
      const outputs = new Map(
        publishedOutputs.map((output) => [output.imagePath, output] as const),
      );
      await this.images.walk(repository, (sidecar) => {
        if (sidecar.jobId !== job.jobId) return;
        outputs.set(sidecar.repositoryRelativePath, {
          imagePath: sidecar.repositoryRelativePath,
          sidecarPath: imageSidecarPath(sidecar.repositoryRelativePath),
        });
      });
      for (const output of [...outputs.values()].reverse()) {
        await repository.removeRelative(output.sidecarPath, { missingOk: true });
        await repository.removeRelative(output.imagePath, { missingOk: true });
      }

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
