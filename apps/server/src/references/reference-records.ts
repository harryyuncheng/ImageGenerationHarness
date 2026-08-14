import { referenceFolderSchema, type ReferenceFolder, type ReferenceImage } from '@harness/domain';
import { imageSidecarPath, outputFileForMediaType } from '@harness/image';
import type { DirectoryManifestCollection } from '../repository/manifest-collection.js';
import { safeSlug } from '../repository/slug.js';

export class ReferenceLibraryError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'ReferenceLibraryError';
  }
}

export function imageSlug(name: string): string {
  return safeSlug(name.replace(/\.(?:jpe?g|png|webp)$/iu, ''));
}

export function referenceSidecarPath(repositoryRelativePath: string): string {
  try {
    return imageSidecarPath(repositoryRelativePath);
  } catch {
    throw new ReferenceLibraryError('Reference image record has an invalid path.', 409);
  }
}

export function assertImageBinding(image: ReferenceImage, folder: ReferenceFolder): void {
  const expectedPrefix = `${folder.directory}/`;
  const fileName = image.repositoryRelativePath.slice(expectedPrefix.length);
  const extension = outputFileForMediaType(image.mediaType).extension;
  if (
    image.folderId !== folder.folderId ||
    !image.repositoryRelativePath.startsWith(expectedPrefix) ||
    fileName.includes('/') ||
    !fileName.includes(`--${image.imageId}.`) ||
    !image.repositoryRelativePath.endsWith(`.${extension}`)
  ) {
    throw new ReferenceLibraryError(
      'A reference image manifest has an invalid folder or file binding.',
      409,
    );
  }
}

export const referenceFoldersCollection: DirectoryManifestCollection<ReferenceFolder> = {
  root: 'references',
  manifestName: 'folder.json',
  schema: referenceFolderSchema,
  identifier: (folder) => folder.folderId,
  validateBinding: (folder, directory, directoryName) => {
    if (folder.directory !== directory || !directoryName.endsWith(`--${folder.folderId}`)) {
      throw new ReferenceLibraryError(
        'A reference folder manifest has an invalid directory binding.',
        409,
      );
    }
  },
};
