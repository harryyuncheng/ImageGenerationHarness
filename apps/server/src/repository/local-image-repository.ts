import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, lstat, mkdir, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import {
  assertSafeRepositoryRelativePath,
  repositoryDescriptorSchema,
  REPOSITORY_SCHEMA_VERSION,
  styleGuideFolderSchema,
  styleGuideImageSchema,
  type RepositoryDescriptor,
} from '@harness/domain';
import type { ZodType } from 'zod';
import { assertImageBinding, styleGuideSidecarPath } from '../style-guide/style-guide-records.js';
import {
  atomicWriteAbsolute,
  cleanupTempsRecursively,
  isMissing,
  isTemporaryName,
  syncDirectory,
  writeImmutableAbsolute,
} from './atomic-files.js';
import { RepositoryUnavailableError } from './errors.js';

const REQUIRED_DIRECTORIES = [
  '.image-harness/runs',
  '.image-harness/jobs',
  '.image-harness/inputs',
  'images',
  'style-guide',
  'presets',
] as const;
const REPOSITORY_DESCRIPTOR_PATH = '.image-harness/repository.json';
const LEGACY_STYLE_GUIDE_DIRECTORY = 'references';
const STYLE_GUIDE_DIRECTORY = 'style-guide';

export function isContained(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

export async function canonicalWritableDirectory(selectedRoot: string): Promise<string> {
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(resolve(selectedRoot));
    const metadata = await lstat(canonicalRoot);
    if (!metadata.isDirectory()) {
      throw new RepositoryUnavailableError('The selected repository must be a directory.');
    }
    await access(canonicalRoot, constants.R_OK | constants.W_OK);
  } catch (error) {
    if (error instanceof RepositoryUnavailableError) throw error;
    throw new RepositoryUnavailableError('The selected repository is not available or writable.');
  }
  return canonicalRoot;
}

async function assertDescriptorPathIsNotSymlink(canonicalRoot: string): Promise<void> {
  for (const relativePath of ['.image-harness', REPOSITORY_DESCRIPTOR_PATH]) {
    const absolutePath = join(canonicalRoot, ...relativePath.split('/'));
    try {
      if ((await lstat(absolutePath)).isSymbolicLink()) {
        throw new RepositoryUnavailableError('Repository control paths cannot be symbolic links.');
      }
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
}

export class LocalImageRepository {
  static readonly #repositories = new Map<string, LocalImageRepository>();
  readonly #canonicalRoot: string;
  #descriptor: RepositoryDescriptor;
  #mutationTail: Promise<void> = Promise.resolve();
  readonly #mutationContext = new AsyncLocalStorage<symbol>();
  readonly #mutationToken = Symbol('local-image-repository-mutation');

  private constructor(canonicalRoot: string, descriptor: RepositoryDescriptor) {
    this.#canonicalRoot = canonicalRoot;
    this.#descriptor = descriptor;
  }

  static async initialize(selectedRoot: string): Promise<LocalImageRepository> {
    const canonicalRoot = await canonicalWritableDirectory(selectedRoot);
    await assertDescriptorPathIsNotSymlink(canonicalRoot);
    let descriptor: RepositoryDescriptor;
    const descriptorPath = join(canonicalRoot, ...REPOSITORY_DESCRIPTOR_PATH.split('/'));
    try {
      descriptor = repositoryDescriptorSchema.parse(
        JSON.parse(await readFile(descriptorPath, 'utf8')),
      );
    } catch (error) {
      if (!isMissing(error)) throw error;
      const now = new Date().toISOString();
      descriptor = repositoryDescriptorSchema.parse({
        schemaVersion: REPOSITORY_SCHEMA_VERSION,
        repositoryId: randomUUID(),
        name: (basename(canonicalRoot).trim() || 'Image Repository').slice(0, 120),
        createdAt: now,
        updatedAt: now,
      });
    }

    return LocalImageRepository.#prepare(canonicalRoot, descriptor, true);
  }

  static async open(selectedRoot: string): Promise<LocalImageRepository> {
    const canonicalRoot = await canonicalWritableDirectory(selectedRoot);
    await assertDescriptorPathIsNotSymlink(canonicalRoot);
    const descriptorPath = join(canonicalRoot, ...REPOSITORY_DESCRIPTOR_PATH.split('/'));
    let descriptor: RepositoryDescriptor;
    try {
      descriptor = repositoryDescriptorSchema.parse(
        JSON.parse(await readFile(descriptorPath, 'utf8')),
      );
    } catch (error) {
      throw new RepositoryUnavailableError(
        isMissing(error)
          ? 'The directory is not an initialized image repository.'
          : 'The image repository descriptor is invalid.',
      );
    }
    return LocalImageRepository.#prepare(canonicalRoot, descriptor, false);
  }

  static async #prepare(
    canonicalRoot: string,
    descriptor: RepositoryDescriptor,
    ensureDescriptor: boolean,
  ): Promise<LocalImageRepository> {
    const existing = this.#repositories.get(canonicalRoot);
    if (existing && existing.#descriptor.repositoryId !== descriptor.repositoryId) {
      throw new RepositoryUnavailableError('The repository identity changed while it was open.');
    }
    const previousRepositories = [...this.#repositories.values()];
    const repository = existing ?? new LocalImageRepository(canonicalRoot, descriptor);
    this.#repositories.set(canonicalRoot, repository);
    try {
      // Reused instances must still honor earlier owners while their first open is in flight.
      for (const previous of previousRepositories) {
        if (previous === repository) break;
        if (previous.#descriptor.repositoryId !== descriptor.repositoryId) continue;
        if (
          (await previous.exists(REPOSITORY_DESCRIPTOR_PATH)) &&
          (await previous.readJson(REPOSITORY_DESCRIPTOR_PATH, repositoryDescriptorSchema))
            .repositoryId === descriptor.repositoryId
        ) {
          throw new RepositoryUnavailableError(
            'Another available folder already uses this repository identity. Choose the original repository instead.',
          );
        }
        if (this.#repositories.get(previous.#canonicalRoot) === previous) {
          this.#repositories.delete(previous.#canonicalRoot);
        }
      }
      await repository.withMutation(async () => {
        await repository.#migrateLegacyStyleGuideUnlocked();
        for (const directory of REQUIRED_DIRECTORIES) {
          await repository.#ensureDirectoryUnlocked(directory);
        }
        if (ensureDescriptor && !(await repository.exists(REPOSITORY_DESCRIPTOR_PATH))) {
          await repository.writeJson(
            REPOSITORY_DESCRIPTOR_PATH,
            descriptor,
            repositoryDescriptorSchema,
          );
        }
        for (const directory of ['.image-harness', 'images', 'style-guide', 'presets']) {
          const absoluteDirectory = await repository.#resolveExisting(directory);
          await cleanupTempsRecursively(absoluteDirectory);
        }
        repository.#descriptor = descriptor;
      });
    } catch (error) {
      if (!existing) this.#repositories.delete(canonicalRoot);
      throw error;
    }
    return repository;
  }

  get canonicalRoot(): string {
    return this.#canonicalRoot;
  }

  get descriptor(): RepositoryDescriptor {
    return { ...this.#descriptor };
  }

  async withMutation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#mutationContext.getStore() === this.#mutationToken) return operation();

    const previous = this.#mutationTail;
    let release = (): void => undefined;
    const current = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    this.#mutationTail = previous.then(() => current);
    await previous;
    try {
      return await this.#mutationContext.run(this.#mutationToken, operation);
    } finally {
      release();
    }
  }

  async ensureDirectory(relativePath: string): Promise<void> {
    await this.withMutation(() => this.#ensureDirectoryUnlocked(relativePath));
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await this.#resolveExisting(relativePath);
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async listDirectories(relativePath: string): Promise<string[]> {
    return this.#listEntries(relativePath, 'directory');
  }

  async listFiles(relativePath: string): Promise<string[]> {
    return this.#listEntries(relativePath, 'file');
  }

  async #listEntries(relativePath: string, kind: 'directory' | 'file'): Promise<string[]> {
    const absoluteDirectory = await this.#resolveExisting(relativePath);
    const metadata = await lstat(absoluteDirectory);
    if (!metadata.isDirectory()) throw new Error('The repository path is not a directory.');
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    if (entries.some((entry) => entry.isSymbolicLink())) {
      throw new Error('Symbolic links are not allowed in repository directories.');
    }
    return entries
      .filter(
        (entry) =>
          (kind === 'directory' ? entry.isDirectory() : entry.isFile()) &&
          !isTemporaryName(entry.name),
      )
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  }

  async readJson<T>(relativePath: string, schema: ZodType<T>): Promise<T> {
    const bytes = await this.readBytes(relativePath);
    return schema.parse(JSON.parse(new TextDecoder().decode(bytes)));
  }

  async writeJson<T>(relativePath: string, value: T, schema: ZodType<T>): Promise<T> {
    const validated = schema.parse(value);
    await this.withMutation(async () => {
      const absolutePath = await this.#resolveForWrite(relativePath);
      const bytes = new TextEncoder().encode(`${JSON.stringify(validated, null, 2)}\n`);
      await atomicWriteAbsolute(absolutePath, bytes, 0o600);
    });
    return validated;
  }

  async writeImmutable(relativePath: string, bytes: Uint8Array): Promise<void> {
    await this.withMutation(async () => {
      const absolutePath = await this.#resolveForWrite(relativePath);
      await writeImmutableAbsolute(absolutePath, bytes, 0o600);
    });
  }

  async publishImmutableWithSidecar<T>(
    imagePath: string,
    bytes: Uint8Array,
    sidecarPath: string,
    sidecar: T,
    schema: ZodType<T>,
  ): Promise<T> {
    const validated = schema.parse(sidecar);
    await this.withMutation(async () => {
      let wroteImage = false;
      try {
        await this.writeImmutable(imagePath, bytes);
        wroteImage = true;
        await this.writeImmutable(
          sidecarPath,
          new TextEncoder().encode(`${JSON.stringify(validated, null, 2)}\n`),
        );
      } catch (error) {
        if (wroteImage) await this.removeRelative(imagePath, { missingOk: true });
        throw error;
      }
    });
    return validated;
  }

  async readBytes(relativePath: string): Promise<Uint8Array> {
    const absolutePath = await this.#resolveExisting(relativePath);
    const metadata = await lstat(absolutePath);
    if (!metadata.isFile()) throw new Error('The repository path is not a file.');
    return Uint8Array.from(await readFile(absolutePath));
  }

  async removeRelative(
    relativePath: string,
    options: { recursive?: boolean; missingOk?: boolean } = {},
  ): Promise<void> {
    await this.withMutation(async () => {
      let absolutePath: string;
      try {
        absolutePath = await this.#resolveExisting(relativePath);
      } catch (error) {
        if (options.missingOk && isMissing(error)) return;
        throw error;
      }
      const metadata = await lstat(absolutePath);
      if (metadata.isDirectory() && !options.recursive) {
        throw new Error('Recursive removal must be explicitly requested for directories.');
      }
      await rm(absolutePath, { recursive: options.recursive ?? false, force: false });
      await syncDirectory(dirname(absolutePath));
    });
  }

  async cleanupStaleTempFiles(relativeDirectory: string): Promise<void> {
    await this.withMutation(async () => {
      const absoluteDirectory = await this.#resolveExisting(relativeDirectory);
      await cleanupTempsRecursively(absoluteDirectory);
    });
  }

  /** Repositories created before the style guide rename keep their folders under `references/`. */
  async #migrateLegacyStyleGuideUnlocked(): Promise<void> {
    if (!(await this.exists(LEGACY_STYLE_GUIDE_DIRECTORY))) return;
    const legacyRoot = await this.#resolveExisting(LEGACY_STYLE_GUIDE_DIRECTORY);
    if (!(await lstat(legacyRoot)).isDirectory()) return;
    await this.#ensureDirectoryUnlocked(STYLE_GUIDE_DIRECTORY);
    for (const folderName of await this.listDirectories(LEGACY_STYLE_GUIDE_DIRECTORY)) {
      const source = `${LEGACY_STYLE_GUIDE_DIRECTORY}/${folderName}`;
      const destination = `${STYLE_GUIDE_DIRECTORY}/${folderName}`;
      const manifestPath = `${source}/folder.json`;
      if (!(await this.exists(manifestPath))) continue;
      const folder = await this.readJson(manifestPath, styleGuideFolderSchema);
      if (
        (folder.directory !== source && folder.directory !== destination) ||
        !folderName.endsWith(`--${folder.folderId}`)
      ) {
        throw new Error('A legacy style guide has an invalid directory binding.');
      }
      if (await this.exists(destination)) {
        throw new Error('A legacy style guide conflicts with an existing style guide directory.');
      }
      const images = [];
      for (const fileName of await this.listFiles(source)) {
        if (!fileName.endsWith('.image.json')) continue;
        const image = await this.readJson(`${source}/${fileName}`, styleGuideImageSchema);
        const directory = image.repositoryRelativePath.startsWith(`${source}/`)
          ? source
          : destination;
        assertImageBinding(image, { ...folder, directory });
        if (styleGuideSidecarPath(image.repositoryRelativePath) !== `${directory}/${fileName}`) {
          throw new Error('A legacy style guide image has an invalid sidecar binding.');
        }
        images.push({
          path: `${source}/${fileName}`,
          image: {
            ...image,
            repositoryRelativePath: `${destination}/${image.repositoryRelativePath.slice(directory.length + 1)}`,
          },
        });
      }
      for (const { path, image } of images)
        await this.writeJson(path, image, styleGuideImageSchema);
      await this.writeJson(
        manifestPath,
        { ...folder, directory: destination },
        styleGuideFolderSchema,
      );
      await rename(await this.#resolveExisting(source), await this.#resolveForWrite(destination));
    }
    await syncDirectory(legacyRoot);
    if ((await readdir(legacyRoot)).length === 0) await rm(legacyRoot, { recursive: true });
    await syncDirectory(await this.#resolveExisting(STYLE_GUIDE_DIRECTORY));
    await syncDirectory(this.#canonicalRoot);
  }

  #lexicalPath(relativePath: string): { relativePath: string; absolutePath: string } {
    if (LocalImageRepository.#repositories.get(this.#canonicalRoot) !== this) {
      throw new RepositoryUnavailableError(
        'The repository moved. Select its current folder again.',
      );
    }
    const validated = assertSafeRepositoryRelativePath(relativePath);
    const absolutePath = resolve(this.#canonicalRoot, ...validated.split('/'));
    if (!isContained(this.#canonicalRoot, absolutePath) || absolutePath === this.#canonicalRoot) {
      throw new Error('Repository path escapes the selected root.');
    }
    return { relativePath: validated, absolutePath };
  }

  async #assertNoSymlinkComponents(relativePath: string, allowMissing: boolean): Promise<void> {
    let current = this.#canonicalRoot;
    for (const segment of relativePath.split('/')) {
      current = join(current, segment);
      try {
        const metadata = await lstat(current);
        if (metadata.isSymbolicLink()) {
          throw new Error('Symbolic links are not allowed in repository paths.');
        }
      } catch (error) {
        if (allowMissing && isMissing(error)) return;
        throw error;
      }
    }
  }

  async #resolveExisting(relativePath: string): Promise<string> {
    const resolved = this.#lexicalPath(relativePath);
    await this.#assertNoSymlinkComponents(resolved.relativePath, false);
    const canonicalPath = await realpath(resolved.absolutePath);
    if (!isContained(this.#canonicalRoot, canonicalPath)) {
      throw new Error('Repository path resolves outside the selected root.');
    }
    return canonicalPath;
  }

  async #resolveForWrite(relativePath: string): Promise<string> {
    const resolved = this.#lexicalPath(relativePath);
    const relativeParent = relative(this.#canonicalRoot, dirname(resolved.absolutePath))
      .split(sep)
      .join('/');
    if (relativeParent) await this.#ensureDirectoryUnlocked(relativeParent);
    await this.#assertNoSymlinkComponents(resolved.relativePath, true);
    const canonicalParent = await realpath(dirname(resolved.absolutePath));
    if (!isContained(this.#canonicalRoot, canonicalParent)) {
      throw new Error('Repository write resolves outside the selected root.');
    }
    return resolved.absolutePath;
  }

  async #ensureDirectoryUnlocked(relativePath: string): Promise<void> {
    const resolved = this.#lexicalPath(relativePath);
    let current = this.#canonicalRoot;
    for (const segment of resolved.relativePath.split('/')) {
      current = join(current, segment);
      try {
        const metadata = await lstat(current);
        if (metadata.isSymbolicLink()) {
          throw new Error('Symbolic links are not allowed in repository paths.');
        }
        if (!metadata.isDirectory()) throw new Error('A repository directory path is a file.');
      } catch (error) {
        if (!isMissing(error)) throw error;
        await mkdir(current, { mode: 0o700 });
      }
    }
    const canonicalDirectory = await realpath(resolved.absolutePath);
    if (!isContained(this.#canonicalRoot, canonicalDirectory)) {
      throw new Error('Repository directory resolves outside the selected root.');
    }
  }
}
