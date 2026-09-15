import type { LocalImageRepository } from '../repository/local-image-repository.js';
import { ApiError } from '../app/api-error.js';
import type { RunQueueItem } from './run-types.js';

export class GenerationQueue {
  readonly #concurrency: number;
  readonly #maxQueuedJobs: number;
  readonly #process: (item: RunQueueItem) => Promise<void>;
  readonly #onError: (item: RunQueueItem, error: unknown) => void;
  readonly #onAvailable: () => void;
  readonly #queue: RunQueueItem[] = [];
  readonly #queuedKeys = new Set<string>();
  readonly #activeKeys = new Set<string>();
  #reserved = 0;
  #draining = false;

  constructor(options: {
    concurrency?: number;
    maxQueuedJobs?: number;
    process: (item: RunQueueItem) => Promise<void>;
    onError: (item: RunQueueItem, error: unknown) => void;
    onAvailable: () => void;
  }) {
    this.#concurrency = Math.max(1, Math.min(4, options.concurrency ?? 1));
    this.#maxQueuedJobs = Math.max(1, options.maxQueuedJobs ?? 64);
    this.#process = options.process;
    this.#onError = options.onError;
    this.#onAvailable = options.onAvailable;
  }

  get availableCapacity(): number {
    return this.#maxQueuedJobs - this.#queue.length - this.#activeKeys.size - this.#reserved;
  }

  reserve(requestedJobCount: number): void {
    if (requestedJobCount > this.availableCapacity) {
      throw new ApiError(
        429,
        'The local generation queue is full. Wait for a queued run to finish.',
      );
    }
    this.#reserved += requestedJobCount;
  }

  release(requestedJobCount: number): void {
    this.#reserved -= requestedJobCount;
    this.#onAvailable();
  }

  has(item: RunQueueItem): boolean {
    const key = this.#queueKey(item.repository, item.runId, item.jobId);
    return this.#queuedKeys.has(key) || this.#activeKeys.has(key);
  }

  enqueue(item: RunQueueItem): boolean {
    if (this.has(item)) return true;
    if (this.availableCapacity === 0) return false;
    const key = this.#queueKey(item.repository, item.runId, item.jobId);
    this.#queuedKeys.add(key);
    this.#queue.push(item);
    return true;
  }

  cancel(repository: LocalImageRepository, runId: string, jobId: string): void {
    const key = this.#queueKey(repository, runId, jobId);
    const index = this.#queue.findIndex(
      (item) => this.#queueKey(item.repository, item.runId, item.jobId) === key,
    );
    if (index === -1) return;
    this.#queue.splice(index, 1);
    this.#queuedKeys.delete(key);
    this.#onAvailable();
  }

  drain(): void {
    if (this.#draining) return;
    this.#draining = true;
    queueMicrotask(() => {
      this.#draining = false;
      while (this.#activeKeys.size < this.#concurrency) {
        const item = this.#queue.shift();
        if (!item) break;
        const key = this.#queueKey(item.repository, item.runId, item.jobId);
        if (!this.#queuedKeys.delete(key)) continue;
        this.#activeKeys.add(key);
        void this.#process(item)
          .catch((error: unknown) => {
            this.#onError(item, error);
          })
          .finally(() => {
            this.#activeKeys.delete(key);
            this.#onAvailable();
            this.drain();
          });
      }
    });
  }

  #queueKey(repository: LocalImageRepository, runId: string, jobId: string): string {
    return `${repository.canonicalRoot}:${runId}:${jobId}`;
  }
}
