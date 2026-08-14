import { referenceFolderDtoSchema, referenceImageDtoSchema } from '@harness/contracts';
import type { ReferenceFolder, ReferenceImage } from '@harness/domain';

export function referenceImageDto(image: ReferenceImage) {
  return referenceImageDtoSchema.parse({
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

export function referenceFolderDto(folder: ReferenceFolder, images: ReferenceImage[] = []) {
  return referenceFolderDtoSchema.parse({
    folderId: folder.folderId,
    name: folder.name,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
    images: images.map(referenceImageDto),
  });
}
