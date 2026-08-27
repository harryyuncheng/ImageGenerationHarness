import {
  styleGuideFolderSchema,
  type StyleGuideFolder,
  type StyleGuideImage,
} from '@harness/domain';
import { imageSidecarPath, outputFileForMediaType } from '@harness/image';
import type { DirectoryManifestCollection } from '../repository/manifest-collection.js';
import { safeSlug } from '../repository/slug.js';

export class StyleGuideError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'StyleGuideError';
  }
}

export function imageSlug(name: string): string {
  return safeSlug(name.replace(/\.(?:jpe?g|png|webp)$/iu, ''));
}

export function styleGuideSidecarPath(repositoryRelativePath: string): string {
  try {
    return imageSidecarPath(repositoryRelativePath);
  } catch {
    throw new StyleGuideError('Style guide image record has an invalid path.', 409);
  }
}

export function assertImageBinding(image: StyleGuideImage, folder: StyleGuideFolder): void {
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
    throw new StyleGuideError(
      'A style guide image manifest has an invalid guide or file binding.',
      409,
    );
  }
}

export const styleGuideFoldersCollection: DirectoryManifestCollection<StyleGuideFolder> = {
  root: 'style-guide',
  manifestName: 'folder.json',
  schema: styleGuideFolderSchema,
  identifier: (folder) => folder.folderId,
  validateBinding: (folder, directory, directoryName) => {
    if (folder.directory !== directory || !directoryName.endsWith(`--${folder.folderId}`)) {
      throw new StyleGuideError('A style guide manifest has an invalid directory binding.', 409);
    }
  },
};
