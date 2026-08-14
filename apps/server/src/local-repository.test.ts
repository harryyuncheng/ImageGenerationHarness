import { access, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApplicationConfigStore, LocalRepositoryManager } from './local-repository.js';
import { QueueDirectorySelector, TemporaryDirectoryScope } from './test-support.js';

async function temporaryDirectory(name: string): Promise<string> {
  return temporaryDirectories.createDirectory(name);
}

const temporaryDirectories = new TemporaryDirectoryScope();

afterEach(async () => {
  await temporaryDirectories.cleanup();
});

describe('local image repository manager', () => {
  it('chooses, reopens, and activates recent repositories without exposing paths', async () => {
    const firstRoot = await temporaryDirectory('First Repository');
    const secondRoot = await temporaryDirectory('Second Repository');
    const configPath = join(firstRoot, '..', 'application', 'config.json');
    const selector = new QueueDirectorySelector([firstRoot, secondRoot]);
    const manager = new LocalRepositoryManager(selector, new ApplicationConfigStore(configPath));

    const firstStatus = await manager.choose();
    const firstId = firstStatus.active?.repositoryId;
    expect(firstStatus.active?.name).toBe('First Repository');
    expect(firstId).toBeTruthy();
    const secondStatus = await manager.choose();
    expect(secondStatus.active?.name).toBe('Second Repository');
    expect(secondStatus.recent).toHaveLength(2);
    expect(JSON.stringify(secondStatus)).not.toContain(firstRoot);
    expect(JSON.stringify(secondStatus)).not.toContain(secondRoot);

    const reopened = new LocalRepositoryManager(
      new QueueDirectorySelector([]),
      new ApplicationConfigStore(configPath),
    );
    expect((await reopened.initialize()).active?.name).toBe('Second Repository');
    if (!firstId) throw new Error('Missing first repository identifier');
    expect((await reopened.activateRepository(firstId)).active?.name).toBe('First Repository');

    const persisted = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
    const canonicalFirstRoot = await realpath(firstRoot);
    const canonicalSecondRoot = await realpath(secondRoot);
    expect(persisted).toEqual({
      activeRoot: canonicalFirstRoot,
      recentRoots: [canonicalFirstRoot, canonicalSecondRoot],
    });
  });

  it('rejects traversal and symlink escapes for reads and writes', async () => {
    const root = await temporaryDirectory('Repository');
    const outside = await temporaryDirectory('Outside');
    const manager = new LocalRepositoryManager(
      new QueueDirectorySelector([root]),
      new ApplicationConfigStore(join(root, '..', 'config.json')),
    );
    await manager.choose();
    const repository = manager.getActiveRepository();
    await writeFile(join(outside, 'secret.txt'), 'not repository data');
    await symlink(outside, join(root, 'images', 'escape'));

    await expect(repository.readBytes('../Outside/secret.txt')).rejects.toThrow();
    await expect(repository.readBytes('images/escape/secret.txt')).rejects.toThrow(/Symbolic/u);
    await expect(
      repository.writeImmutable('images/escape/new.png', new Uint8Array([1, 2, 3])),
    ).rejects.toThrow(/Symbolic/u);
  });

  it('atomically writes validated JSON and cleans abandoned temporary files', async () => {
    const root = await temporaryDirectory('Repository');
    const configPath = join(root, '..', 'config.json');
    const manager = new LocalRepositoryManager(
      new QueueDirectorySelector([root]),
      new ApplicationConfigStore(configPath),
    );
    await manager.choose();
    const repository = manager.getActiveRepository();
    const schema = z.object({ value: z.string() }).strict();
    await repository.writeJson('.image-harness/runs/example.json', { value: 'complete' }, schema);
    await writeFile(join(root, 'projects', '.project.json.tmp-abandoned'), '{"partial":');

    const reopened = new LocalRepositoryManager(
      new QueueDirectorySelector([]),
      new ApplicationConfigStore(configPath),
    );
    await reopened.initialize();
    expect(
      await reopened.getActiveRepository().readJson('.image-harness/runs/example.json', schema),
    ).toEqual({ value: 'complete' });
    await expect(
      access(join(root, 'projects', '.project.json.tmp-abandoned')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
