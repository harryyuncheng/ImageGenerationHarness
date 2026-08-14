import { AsyncLocalStorage } from 'node:async_hooks';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  access,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  assertSafeRepositoryRelativePath,
  repositoryDescriptorSchema,
  repositoryStatusSchema,
  REPOSITORY_SCHEMA_VERSION,
  type RepositoryDescriptor,
  type RepositoryStatus,
} from '@harness/domain';
import { z, type ZodType } from 'zod';

const REQUIRED_DIRECTORIES = [
  '.image-harness/runs',
  '.image-harness/jobs',
  '.image-harness/inputs',
  'images',
  'references',
  'projects',
] as const;
const REPOSITORY_DESCRIPTOR_PATH = '.image-harness/repository.json';
const MAX_RECENT_REPOSITORIES = 10;
const applicationConfigSchema = z
  .object({
    activeRoot: z.string().nullable(),
    recentRoots: z.array(z.string()).max(MAX_RECENT_REPOSITORIES),
  })
  .strict();

type ApplicationConfig = z.infer<typeof applicationConfigSchema>;

export interface DirectorySelector {
  selectDirectory(): Promise<string | undefined>;
}

interface ExecFileFailure extends Error {
  stderr?: string;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

function isMissing(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT';
}

function isContained(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function isTemporaryName(name: string): boolean {
  return name.includes('.tmp-');
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function cleanupTargetTemps(directory: string, targetName?: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  const targetPrefix = targetName ? `.${targetName}.tmp-` : undefined;
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile() && !entry.isSymbolicLink()) return;
      if (!(targetPrefix ? entry.name.startsWith(targetPrefix) : isTemporaryName(entry.name)))
        return;
      await rm(join(directory, entry.name), { force: true });
    }),
  );
}

async function cleanupTempsRecursively(directory: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return;
    throw error;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await cleanupTempsRecursively(absolutePath);
      } else if (isTemporaryName(entry.name)) {
        await rm(absolutePath, { force: true });
      }
    }),
  );
}

async function atomicWriteAbsolute(
  targetPath: string,
  bytes: Uint8Array,
  mode: number,
): Promise<void> {
  const parent = dirname(targetPath);
  const targetName = basename(targetPath);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await cleanupTargetTemps(parent, targetName);
  const temporaryPath = join(parent, `.${targetName}.tmp-${randomUUID()}`);
  let handle;
  try {
    handle = await open(temporaryPath, 'wx', mode);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, targetPath);
    await syncDirectory(parent);
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(temporaryPath).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
  }
}

function executeAppleScript(args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile('/usr/bin/osascript', args, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        reject(error instanceof Error ? error : new Error('The directory chooser failed.'));
        return;
      }
      resolvePromise(stdout);
    });
  });
}

class MacOSDirectorySelector implements DirectorySelector {
  async selectDirectory(): Promise<string | undefined> {
    const script = [
      'set selectedDirectory to choose folder with prompt "Choose an ImageGenerationHarness repository"',
      'POSIX path of selectedDirectory',
    ].join('\n');
    try {
      const output = await executeAppleScript(['-e', script]);
      const selectedPath = output.trim();
      return selectedPath || undefined;
    } catch (error) {
      const failure = error as ExecFileFailure;
      if (`${failure.message}\n${failure.stderr ?? ''}`.includes('User canceled')) return undefined;
      throw error;
    }
  }
}

export class RepositoryUnavailableError extends Error {
  constructor(message = 'No local image repository is active.') {
    super(message);
    this.name = 'RepositoryUnavailableError';
  }
}

export class ApplicationConfigStore {
  readonly configPath: string;

  constructor(
    configPath = join(
      homedir(),
      'Library',
      'Application Support',
      'ImageGenerationHarness',
      'config.json',
    ),
  ) {
    this.configPath = resolve(configPath);
  }

  async load(): Promise<ApplicationConfig> {
    await cleanupTargetTemps(dirname(this.configPath), basename(this.configPath));
    try {
      const contents = await readFile(this.configPath, 'utf8');
      return applicationConfigSchema.parse(JSON.parse(contents));
    } catch (error) {
      if (isMissing(error)) return { activeRoot: null, recentRoots: [] };
      throw error;
    }
  }

  async save(config: ApplicationConfig): Promise<void> {
    const validated = applicationConfigSchema.parse(config);
    const bytes = new TextEncoder().encode(`${JSON.stringify(validated, null, 2)}\n`);
    await atomicWriteAbsolute(this.configPath, bytes, 0o600);
  }
}

function safeRelativePath(value: string): string {
  const validated = assertSafeRepositoryRelativePath(value);
  if (
    validated.includes('\\') ||
    validated.includes('\0') ||
    isAbsolute(validated) ||
    /^[A-Za-z]:\//u.test(validated)
  ) {
    throw new Error('Repository paths must use safe forward-slash relative paths.');
  }
  return validated;
}

export function safeSlug(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64)
    .replace(/-+$/gu, '');
  return slug || 'untitled';
}

async function canonicalWritableDirectory(selectedRoot: string): Promise<string> {
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(resolve(selectedRoot));
    const metadata = await stat(canonicalRoot);
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
      const directoryName = basename(canonicalRoot).trim() || 'Image Repository';
      descriptor = repositoryDescriptorSchema.parse({
        schemaVersion: REPOSITORY_SCHEMA_VERSION,
        repositoryId: randomUUID(),
        name: directoryName.slice(0, 120),
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
    const repository = new LocalImageRepository(canonicalRoot, descriptor);
    await repository.withMutation(async () => {
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
      await repository.#cleanupManagedTempsUnlocked();
    });
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
      const parent = dirname(absolutePath);
      const targetName = basename(absolutePath);
      await cleanupTargetTemps(parent, targetName);
      const temporaryPath = join(parent, `.${targetName}.tmp-${randomUUID()}`);
      let handle;
      try {
        handle = await open(temporaryPath, 'wx', 0o600);
        await handle.writeFile(bytes);
        await handle.sync();
        await handle.close();
        handle = undefined;
        await link(temporaryPath, absolutePath);
        await syncDirectory(parent);
      } finally {
        if (handle) await handle.close().catch(() => undefined);
        await unlink(temporaryPath).catch((error: unknown) => {
          if (!isMissing(error)) throw error;
        });
      }
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
        await this.writeJson(sidecarPath, validated, schema);
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

  async #cleanupManagedTempsUnlocked(): Promise<void> {
    for (const directory of ['.image-harness', 'images', 'references', 'projects'] as const) {
      const absoluteDirectory = await this.#resolveExisting(directory);
      await cleanupTempsRecursively(absoluteDirectory);
    }
  }

  #lexicalPath(relativePath: string): { relativePath: string; absolutePath: string } {
    const validated = safeRelativePath(relativePath);
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
