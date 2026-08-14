import { repositoryStatusSchema, type RepositoryStatus } from '@harness/domain';
import { ApplicationConfigStore, MAX_RECENT_REPOSITORIES } from './application-config-store.js';
import { type DirectorySelector, MacOSDirectorySelector } from './directory-selector.js';
import { RepositoryUnavailableError } from './errors.js';
import {
  canonicalWritableDirectory,
  isContained,
  LocalImageRepository,
} from './local-image-repository.js';

interface RecentRepository {
  root: string;
  repository: LocalImageRepository;
}

export class LocalRepositoryManager {
  readonly #selector: DirectorySelector;
  readonly #configStore: ApplicationConfigStore;
  #active: RecentRepository | undefined;
  #recent: RecentRepository[] = [];

  constructor(
    selector: DirectorySelector = new MacOSDirectorySelector(),
    configStore: ApplicationConfigStore = new ApplicationConfigStore(),
  ) {
    this.#selector = selector;
    this.#configStore = configStore;
  }

  async initialize(): Promise<RepositoryStatus> {
    const config = await this.#configStore.load();
    const candidateRoots = [
      ...(config.activeRoot ? [config.activeRoot] : []),
      ...config.recentRoots,
    ].filter((root, index, roots) => roots.indexOf(root) === index);
    const recent: RecentRepository[] = [];
    const seenRepositoryIds = new Set<string>();
    for (const root of candidateRoots) {
      try {
        const canonicalRoot = await canonicalWritableDirectory(root);
        if (isContained(canonicalRoot, this.#configStore.configPath)) continue;
        const repository = await LocalImageRepository.open(canonicalRoot);
        if (seenRepositoryIds.has(repository.descriptor.repositoryId)) continue;
        seenRepositoryIds.add(repository.descriptor.repositoryId);
        recent.push({ root: repository.canonicalRoot, repository });
      } catch {
        // Missing, unreadable, and malformed recent repositories are not reopened.
      }
      if (recent.length === MAX_RECENT_REPOSITORIES) break;
    }
    this.#recent = recent;
    this.#active = recent.find((entry) => entry.root === config.activeRoot) ?? recent.at(0);
    await this.#persist();
    return this.getStatus();
  }

  async choose(): Promise<RepositoryStatus> {
    const selectedRoot = await this.#selector.selectDirectory();
    if (!selectedRoot) return this.getStatus();
    const canonicalRoot = await canonicalWritableDirectory(selectedRoot);
    if (isContained(canonicalRoot, this.#configStore.configPath)) {
      throw new RepositoryUnavailableError(
        'Choose a repository that does not contain the application configuration file.',
      );
    }
    const repository = await LocalImageRepository.initialize(canonicalRoot);
    this.#activate(repository);
    await this.#persist();
    return this.getStatus();
  }

  async activateRepository(repositoryId: string): Promise<RepositoryStatus> {
    const entry = this.#recent.find(
      (candidate) => candidate.repository.descriptor.repositoryId === repositoryId,
    );
    if (!entry) throw new RepositoryUnavailableError('The recent repository is not available.');
    try {
      const repository = await LocalImageRepository.open(entry.root);
      this.#activate(repository);
      await this.#persist();
      return this.getStatus();
    } catch (error) {
      this.#recent = this.#recent.filter((candidate) => candidate !== entry);
      if (this.#active === entry) this.#active = undefined;
      await this.#persist();
      throw new RepositoryUnavailableError(
        error instanceof Error ? error.message : 'The recent repository is not available.',
      );
    }
  }

  getActiveRepository(): LocalImageRepository {
    if (!this.#active) throw new RepositoryUnavailableError();
    return this.#active.repository;
  }

  getStatus(): RepositoryStatus {
    return repositoryStatusSchema.parse({
      active: this.#active
        ? {
            repositoryId: this.#active.repository.descriptor.repositoryId,
            name: this.#active.repository.descriptor.name,
          }
        : null,
      recent: this.#recent.map(({ repository }) => ({
        repositoryId: repository.descriptor.repositoryId,
        name: repository.descriptor.name,
      })),
    });
  }

  async withRepository<T>(operation: (repository: LocalImageRepository) => Promise<T>): Promise<T> {
    return operation(this.getActiveRepository());
  }

  #activate(repository: LocalImageRepository): void {
    const entry = { root: repository.canonicalRoot, repository };
    this.#active = entry;
    this.#recent = [
      entry,
      ...this.#recent.filter(
        (candidate) =>
          candidate.root !== entry.root &&
          candidate.repository.descriptor.repositoryId !== repository.descriptor.repositoryId,
      ),
    ].slice(0, MAX_RECENT_REPOSITORIES);
  }

  async #persist(): Promise<void> {
    await this.#configStore.save({
      activeRoot: this.#active?.root ?? null,
      recentRoots: this.#recent.map(({ root }) => root),
    });
  }
}

let defaultLocalRepositoryManager: LocalRepositoryManager | undefined;

export function getDefaultLocalRepositoryManager(): LocalRepositoryManager {
  defaultLocalRepositoryManager ??= new LocalRepositoryManager();
  return defaultLocalRepositoryManager;
}
