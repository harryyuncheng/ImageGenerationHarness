import { MAX_REQUEST_IMAGES } from '@harness/contracts';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  readAsData,
  revokeUploadPreviews,
  supportedImageFiles,
} from '../../shared/images/files.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { Attachment, LibraryAttachment } from '../../shared/types/attachments.js';
import type { ReferenceImage } from '../../shared/types/domain.js';
import { referenceImageContentUrl } from '../references/api.js';

export function useAttachments(notify: Notify) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const latestAttachments = useRef(attachments);
  latestAttachments.current = attachments;

  useEffect(
    () => () => {
      revokeUploadPreviews(latestAttachments.current);
    },
    [],
  );

  async function addFiles(files: File[]) {
    const accepted = supportedImageFiles(files);
    if (accepted.length !== files.length) {
      notify('Use PNG, JPEG, or WebP images up to 10 MB.', 'error');
    }
    const remainingSlots = Math.max(0, MAX_REQUEST_IMAGES - attachments.length);
    try {
      const loaded = await Promise.all(accepted.slice(0, remainingSlots).map(readAsData));
      setAttachments((current) => [...current, ...loaded]);
      if (accepted.length > remainingSlots) notify('A prompt can contain up to four images.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not read the image.', 'error');
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    void addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragActive(false);
    void addFiles(Array.from(event.dataTransfer.files));
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const attachment = current.find((item) => item.id === id);
      if (attachment?.source === 'upload') URL.revokeObjectURL(attachment.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function hasLibraryImage(imageId: string): boolean {
    return attachments.some(
      (attachment) => attachment.source === 'library' && attachment.imageId === imageId,
    );
  }

  const isFull = attachments.length >= MAX_REQUEST_IMAGES;

  function addLibraryImage(image: ReferenceImage) {
    setAttachments((current) => [
      ...current,
      {
        source: 'library',
        id: `library:${image.imageId}`,
        folderId: image.folderId,
        imageId: image.imageId,
        name: image.name,
        mediaType: image.mediaType,
        byteLength: image.byteLength,
        previewUrl: referenceImageContentUrl(image.folderId, image.imageId),
      },
    ]);
  }

  /** Drops library attachments whose reference record no longer exists. */
  function removeLibraryImages(matches: (attachment: LibraryAttachment) => boolean) {
    setAttachments((current) =>
      current.filter((attachment) => attachment.source !== 'library' || !matches(attachment)),
    );
  }

  return {
    attachments,
    dragActive,
    setDragActive,
    fileInput,
    addFiles,
    handleFiles,
    handleDrop,
    removeAttachment,
    hasLibraryImage,
    isFull,
    addLibraryImage,
    removeLibraryImages,
  };
}

export type AttachmentsController = ReturnType<typeof useAttachments>;
