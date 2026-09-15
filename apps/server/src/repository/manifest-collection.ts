import type { ZodType } from 'zod';
import type { LocalImageRepository } from './local-image-repository.js';

export interface DirectoryManifestCollection<T> {
  root: string;
  manifestName: string;
  schema: ZodType<T>;
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

export function hasNameConflict<T extends { name: string }>(
  records: readonly T[],
  name: string,
  ignore: (record: T) => boolean = () => false,
): boolean {
  return records.some(
    (record) =>
      !ignore(record) &&
      record.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0,
  );
}
