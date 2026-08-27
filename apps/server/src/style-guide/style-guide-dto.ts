import { styleGuideFolderDtoSchema, styleGuideImageDtoSchema } from '@harness/contracts';
import type { StyleGuideFolder, StyleGuideImage } from '@harness/domain';

export function styleGuideImageDto(image: StyleGuideImage) {
  return styleGuideImageDtoSchema.parse({
    folderId: image.folderId,
    imageId: image.imageId,
    name: image.name,
    mediaType: image.mediaType,
    byteLength: image.byteLength,
    width: image.width,
    height: image.height,
    createdAt: image.createdAt,
    updatedAt: image.updatedAt,
  });
}

export function styleGuideFolderDto(folder: StyleGuideFolder, images: StyleGuideImage[] = []) {
  return styleGuideFolderDtoSchema.parse({
    folderId: folder.folderId,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    images: images.map(styleGuideImageDto),
  });
}
