import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApplicationConfigStore } from '../repository/application-config-store.js';
import type { DirectorySelector } from '../repository/directory-selector.js';
import { LocalRepositoryManager } from '../repository/repository-manager.js';

export const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

export class FixedDirectorySelector implements DirectorySelector {
  constructor(private readonly root: string) {}

  selectDirectory(): Promise<string> {
    return Promise.resolve(this.root);
  }
}

export class QueueDirectorySelector implements DirectorySelector {
  constructor(private readonly selections: (string | undefined)[]) {}

  selectDirectory(): Promise<string | undefined> {
    return Promise.resolve(this.selections.shift());
  }
}

export class TemporaryDirectoryScope {
  readonly #roots: string[] = [];

  async createDirectory(name: string, prefix = 'image-harness-'): Promise<string> {
    const parent = await mkdtemp(join(tmpdir(), prefix));
    this.#roots.push(parent);
    const directory = join(parent, name);
    await mkdir(directory);
    return directory;
  }

  async createSelectedRepository(prefix: string): Promise<{
    parent: string;
    root: string;
    configPath: string;
    manager: LocalRepositoryManager;
  }> {
    const parent = await mkdtemp(join(tmpdir(), prefix));
    this.#roots.push(parent);
    const root = join(parent, 'repository');
    const configPath = join(parent, 'application', 'config.json');
    await mkdir(root);
    const manager = new LocalRepositoryManager(
      new FixedDirectorySelector(root),
      new ApplicationConfigStore(configPath),
    );
    await manager.choose();
    return { parent, root, configPath, manager };
  }

  async cleanup(): Promise<void> {
    await Promise.all(
      this.#roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  }
}
