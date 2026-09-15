import { repositoryStatusSchema, type RepositoryStatus } from '@harness/domain';
import { publicErrorMessage } from '../app/api-error.js';
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
  #selectionTail: Promise<unknown> = Promise.resolve();

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
    return this.#updateSelection(() => ({
      active: recent.find((entry) => entry.root === config.activeRoot) ?? recent.at(0),
      recent,
    }));
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
    return this.#activate(repository);
  }

  async activateRepository(repositoryId: string): Promise<RepositoryStatus> {
    const entry = this.#recent.find(
      (candidate) => candidate.repository.descriptor.repositoryId === repositoryId,
    );
    if (!entry) throw new RepositoryUnavailableError('The recent repository is not available.');
    let repository: LocalImageRepository;
    try {
      repository = await LocalImageRepository.open(entry.root);
    } catch (error) {
      await this.#updateSelection(() => ({
        active: this.#active === entry ? undefined : this.#active,
        recent: this.#recent.filter((candidate) => candidate !== entry),
      }));
      throw new RepositoryUnavailableError(publicErrorMessage(error));
    }
    return this.#activate(repository);
  }

  getActiveRepository(): LocalImageRepository {
    if (!this.#active) throw new RepositoryUnavailableError();
    return this.#active.repository;
  }

  getRecentRepositories(): LocalImageRepository[] {
    return this.#recent.map((entry) => entry.repository);
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

  #activate(repository: LocalImageRepository): Promise<RepositoryStatus> {
    return this.#updateSelection(() => {
      const entry = { root: repository.canonicalRoot, repository };
      return {
        active: entry,
        recent: [
          entry,
          ...this.#recent.filter(
            (candidate) =>
              candidate.root !== entry.root &&
              candidate.repository.descriptor.repositoryId !== repository.descriptor.repositoryId,
          ),
        ].slice(0, MAX_RECENT_REPOSITORIES),
      };
    });
  }

  #updateSelection(
    select: () => { active: RecentRepository | undefined; recent: RecentRepository[] },
  ): Promise<RepositoryStatus> {
    const update = this.#selectionTail.then(async () => {
      const selection = select();
      await this.#configStore.save({
        activeRoot: selection.active?.root ?? null,
        recentRoots: selection.recent.map(({ root }) => root),
      });
      this.#active = selection.active;
      this.#recent = selection.recent;
      return this.getStatus();
    });
    this.#selectionTail = update.catch(() => undefined);
    return update;
  }
}

let defaultLocalRepositoryManager: LocalRepositoryManager | undefined;

export function getDefaultLocalRepositoryManager(): LocalRepositoryManager {
  defaultLocalRepositoryManager ??= new LocalRepositoryManager();
  return defaultLocalRepositoryManager;
}
