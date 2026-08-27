import { MAX_REQUEST_IMAGES } from '@harness/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  readAsData,
  revokeUploadPreviews,
  supportedImageFiles,
} from '../../shared/images/files.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { Attachment, UploadAttachment } from '../../shared/types/attachments.js';
import type { StyleGuideImage } from '../../shared/types/domain.js';
import { styleGuideImageContentUrl } from '../style-guide/api.js';

export function useAttachments(notify: Notify) {
  const [uploads, setUploads] = useState<UploadAttachment[]>([]);
  const [styleGuideImages, setStyleGuideImages] = useState<readonly StyleGuideImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const latestUploads = useRef(uploads);
  latestUploads.current = uploads;

  useEffect(
    () => () => {
      revokeUploadPreviews(latestUploads.current);
    },
    [],
  );

  /** Uploads keep the leading slots so an uploaded source image always reaches the model. */
  const attachments = useMemo<Attachment[]>(
    () =>
      [
        ...uploads,
        ...styleGuideImages.map((image): Attachment => ({
          source: 'style-guide',
          id: `style-guide:${image.imageId}`,
          folderId: image.folderId,
          imageId: image.imageId,
          name: image.name,
          mediaType: image.mediaType,
          byteLength: image.byteLength,
          previewUrl: styleGuideImageContentUrl(image.folderId, image.imageId),
        })),
      ].slice(0, MAX_REQUEST_IMAGES),
    [uploads, styleGuideImages],
  );

  async function addFiles(files: File[]) {
    const accepted = supportedImageFiles(files);
    if (accepted.length !== files.length) {
      notify('Use PNG, JPEG, or WebP images up to 10 MB.', 'error');
    }
    const remainingSlots = Math.max(0, MAX_REQUEST_IMAGES - uploads.length);
    try {
      const loaded = await Promise.all(accepted.slice(0, remainingSlots).map(readAsData));
      setUploads((current) => [...current, ...loaded]);
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

  /** Style guide attachments belong to the active folder, so only uploads are removable. */
  function removeUpload(id: string) {
    setUploads((current) => {
      const upload = current.find((item) => item.id === id);
      if (upload) URL.revokeObjectURL(upload.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  return {
    attachments,
    dragActive,
    setDragActive,
    fileInput,
    addFiles,
    handleFiles,
    handleDrop,
    removeUpload,
    isFull: uploads.length >= MAX_REQUEST_IMAGES,
    setStyleGuideImages,
  };
}

export type AttachmentsController = ReturnType<typeof useAttachments>;
