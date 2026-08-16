import { randomUUID } from 'node:crypto';
import { link, mkdir, open, readdir, rename, rm, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

export function isMissing(error: unknown): boolean {
  return isNodeError(error) && error.code === 'ENOENT';
}

export function isTemporaryName(name: string): boolean {
  return name.includes('.tmp-');
}

export async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function cleanupTargetTemps(directory: string, targetName?: string): Promise<void> {
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
      if (!(targetPrefix ? entry.name.startsWith(targetPrefix) : isTemporaryName(entry.name))) {
        return;
      }
      await rm(join(directory, entry.name), { force: true });
    }),
  );
}

export async function cleanupTempsRecursively(directory: string): Promise<void> {
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

export async function atomicWriteAbsolute(
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

export async function writeImmutableAbsolute(
  targetPath: string,
  bytes: Uint8Array,
  mode: number,
): Promise<void> {
  const parent = dirname(targetPath);
  const targetName = basename(targetPath);
  await cleanupTargetTemps(parent, targetName);
  const temporaryPath = join(parent, `.${targetName}.tmp-${randomUUID()}`);
  let handle;
  try {
    handle = await open(temporaryPath, 'wx', mode);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporaryPath, targetPath);
    await syncDirectory(parent);
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(temporaryPath).catch((error: unknown) => {
      if (!isMissing(error)) throw error;
    });
  }
}
