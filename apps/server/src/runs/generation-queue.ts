import type { LocalImageRepository } from '../repository/local-image-repository.js';
import type { RunQueueItem } from './run-types.js';

export class GenerationQueue {
  readonly #concurrency: number;
  readonly #maxQueuedJobs: number;
  readonly #process: (item: RunQueueItem) => Promise<void>;
  readonly #queue: RunQueueItem[] = [];
  readonly #queuedKeys = new Set<string>();
  #active = 0;
  #draining = false;

  constructor(options: {
    concurrency?: number;
    maxQueuedJobs?: number;
    process: (item: RunQueueItem) => Promise<void>;
  }) {
    this.#concurrency = Math.max(1, Math.min(4, options.concurrency ?? 1));
    this.#maxQueuedJobs = Math.max(1, options.maxQueuedJobs ?? 64);
    this.#process = options.process;
  }

  assertCapacity(requestedJobCount: number): void {
    if (this.#queue.length + this.#active + requestedJobCount > this.#maxQueuedJobs) {
      throw new Error('The local generation queue is full. Wait for a queued run to finish.');
    }
  }

  enqueue(item: RunQueueItem): void {
    const key = this.#queueKey(item.repository, item.runId, item.jobId);
    if (this.#queuedKeys.has(key)) return;
    this.#queuedKeys.add(key);
    this.#queue.push(item);
  }

  cancel(repository: LocalImageRepository, runId: string, jobId: string): void {
    this.#queuedKeys.delete(this.#queueKey(repository, runId, jobId));
  }

  drain(): void {
    if (this.#draining) return;
    this.#draining = true;
    queueMicrotask(() => {
      this.#draining = false;
      while (this.#active < this.#concurrency) {
        const item = this.#queue.shift();
        if (!item) break;
        const key = this.#queueKey(item.repository, item.runId, item.jobId);
        if (!this.#queuedKeys.delete(key)) continue;
        this.#active += 1;
        void this.#process(item).finally(() => {
          this.#active -= 1;
          this.drain();
        });
      }
    });
  }

  #queueKey(repository: LocalImageRepository, runId: string, jobId: string): string {
    return `${repository.descriptor.repositoryId}:${runId}:${jobId}`;
  }
}
