import type { ZodType } from 'zod';
import type { LocalImageRepository } from './local-repository.js';

export interface DirectoryManifestCollection<T> {
  root: string;
  manifestName: string;
  schema: ZodType<T>;
  identifier: (record: T) => string;
  validateBinding: (record: T, directory: string, directoryName: string) => void;
}

export async function loadDirectoryManifests<T>(
  repository: LocalImageRepository,
  collection: DirectoryManifestCollection<T>,
): Promise<T[]> {
  const records: T[] = [];
  for (const directoryName of await repository.listDirectories(collection.root)) {
    const directory = `${collection.root}/${directoryName}`;
    const manifestPath = `${directory}/${collection.manifestName}`;
    if (!(await repository.exists(manifestPath))) continue;
    const record = await repository.readJson(manifestPath, collection.schema);
    collection.validateBinding(record, directory, directoryName);
    records.push(record);
  }
  return records;
}

export async function findDirectoryManifest<T>(
  repository: LocalImageRepository,
  collection: DirectoryManifestCollection<T>,
  identifier: string,
): Promise<T | undefined> {
  return (await loadDirectoryManifests(repository, collection)).find(
    (record) => collection.identifier(record) === identifier,
  );
}

export async function requireDirectoryManifest<T>(
  repository: LocalImageRepository,
  collection: DirectoryManifestCollection<T>,
  identifier: string,
  notFound: () => Error,
): Promise<T> {
  const record = await findDirectoryManifest(repository, collection, identifier);
  if (!record) throw notFound();
  return record;
}

export function sameRecordName(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}

export function hasActiveNameConflict<T extends { name: string; archivedAt?: string | undefined }>(
  records: readonly T[],
  name: string,
  ignore: (record: T) => boolean = () => false,
): boolean {
  return records.some(
    (record) => !record.archivedAt && !ignore(record) && sameRecordName(record.name, name),
  );
}
