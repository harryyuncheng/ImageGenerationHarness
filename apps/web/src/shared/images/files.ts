import { MAX_IMAGE_BYTES, isMediaType } from '@harness/contracts';
import { requestResponse } from '../api/http.js';
import type { Attachment, UploadAttachment } from '../types/attachments.js';
import type { GalleryImage } from '../types/domain.js';

export function generatedImageContentUrl(imageId: string): string {
  return `/api/images/${imageId}/content`;
}

export function readAsData(file: File): Promise<UploadAttachment> {
  return new Promise((resolve, reject) => {
    if (!isMediaType(file.type)) {
      reject(new Error(`${file.name} is not a supported image type`));
      return;
    }
    const mediaType = file.type;
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error(`Could not read ${file.name}`));
    };
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`Could not read ${file.name}`));
        return;
      }
      const comma = reader.result.indexOf(',');
      resolve({
        source: 'upload',
        id: crypto.randomUUID(),
        name: file.name,
        mediaType,
        byteLength: file.size,
        data: reader.result.slice(comma + 1),
        previewUrl: URL.createObjectURL(file),
      });
    };
    reader.readAsDataURL(file);
  });
}

export function supportedImageFiles(files: readonly File[]): File[] {
  return files.filter((file) => isMediaType(file.type) && file.size <= MAX_IMAGE_BYTES);
}

function imageFileExtension(mediaType: GalleryImage['mediaType']): string {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  return 'png';
}

export async function readGalleryImageAsData(image: GalleryImage): Promise<UploadAttachment> {
  if (image.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('This image is too large to use as an editing source.');
  }
  const response = await requestResponse(
    generatedImageContentUrl(image.imageId),
    {},
    'Could not load the Baroque image.',
  );
  const blob = await response.blob();
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error('This image is too large to use as an editing source.');
  }
  const file = new File([blob], `baroque-${image.imageId}.${imageFileExtension(image.mediaType)}`, {
    type: image.mediaType,
  });
  return readAsData(file);
}

export function revokeUploadPreviews(attachments: readonly Attachment[]): void {
  for (const attachment of attachments) {
    if (attachment.source === 'upload') URL.revokeObjectURL(attachment.previewUrl);
  }
}
