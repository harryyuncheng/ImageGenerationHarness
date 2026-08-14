import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { runMutation, type MutationOutcome } from '../../shared/api/mutation.js';
import { queryKeys } from '../../shared/api/query-keys.js';
import {
  readAsData,
  revokeUploadPreviews,
  supportedImageFiles,
} from '../../shared/images/files.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { LibraryAttachment, UploadAttachment } from '../../shared/types/attachments.js';
import type { ReferenceFolder, ReferenceImage } from '../../shared/types/domain.js';
import * as api from './api.js';

interface ReferenceLibraryOptions {
  activeRepositoryId: string | undefined;
  notify: Notify;
  requireRepository: (action: string) => boolean;
  removeLibraryImages: (matches: (attachment: LibraryAttachment) => boolean) => void;
}

export function useReferenceLibrary({
  activeRepositoryId,
  notify,
  requireRepository,
  removeLibraryImages,
}: ReferenceLibraryOptions) {
  const [isMutating, setIsMutating] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const referenceLibraryQuery = useQuery({
    queryKey: queryKeys.referenceLibrary(activeRepositoryId),
    queryFn: api.getReferenceLibrary,
    enabled: Boolean(activeRepositoryId),
    retry: false,
    refetchInterval: false,
  });

  async function refresh() {
    await referenceLibraryQuery.refetch();
  }

  async function performLibraryMutation<T>(
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<MutationOutcome<T>> {
    setIsMutating(true);
    try {
      return await runMutation(operation, fallback, (message) => {
        notify(message, 'error');
      });
    } finally {
      setIsMutating(false);
    }
  }

  async function renameRecord(options: {
    prompt: string;
    currentName: string;
    endpoint: string;
    fallback: string;
  }): Promise<void> {
    const name = window.prompt(options.prompt, options.currentName);
    if (!name?.trim() || name.trim() === options.currentName) return;
    await performLibraryMutation(async () => {
      await api.renameReferenceRecord(options.endpoint, name.trim(), options.fallback);
      await refresh();
    }, options.fallback);
  }

  async function createFolder() {
    if (!requireRepository('create a reference folder')) return;
    const name = window.prompt('Folder name, such as “Editorial lighting” or “Anime styles”');
    if (!name?.trim()) return;
    const result = await performLibraryMutation(async () => {
      await api.createReferenceFolder(name.trim());
      await refresh();
    }, 'Could not create the folder.');
    if (result.ok) notify('Reference folder created.', 'success');
  }

  async function renameFolder(folder: ReferenceFolder) {
    await renameRecord({
      prompt: 'Rename folder',
      currentName: folder.name,
      endpoint: api.referenceFolderEndpoint(folder.folderId),
      fallback: 'Could not rename the folder.',
    });
  }

  async function deleteFolder(folder: ReferenceFolder) {
    if (!window.confirm(`Delete “${folder.name}” and remove its images from the library?`)) return;
    const result = await performLibraryMutation(async () => {
      await api.deleteReferenceFolder(folder.folderId);
      await refresh();
    }, 'Could not remove the folder.');
    if (!result.ok) return;
    removeLibraryImages((attachment) => attachment.folderId === folder.folderId);
    notify('Reference folder removed.', 'success');
  }

  function chooseUploads(folderId: string) {
    setUploadFolderId(folderId);
    fileInput.current?.click();
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    const folderId = uploadFolderId;
    if (!folderId || files.length === 0) return;
    const accepted = supportedImageFiles(files);
    if (accepted.length !== files.length) {
      notify('Use PNG, JPEG, or WebP images up to 10 MB.', 'error');
    }
    if (accepted.length === 0) return;
    const result = await performLibraryMutation(async () => {
      const uploads: UploadAttachment[] = [];
      try {
        for (const file of accepted) {
          const upload = await readAsData(file);
          uploads.push(upload);
          await api.uploadReferenceImage(folderId, upload);
        }
      } finally {
        revokeUploadPreviews(uploads);
      }
      await refresh();
    }, 'Could not upload the images.');
    if (!result.ok) {
      await refresh();
      return;
    }
    notify(
      `${String(accepted.length)} reference image${accepted.length === 1 ? '' : 's'} added.`,
      'success',
    );
  }

  async function renameImage(image: ReferenceImage) {
    await renameRecord({
      prompt: 'Rename reference image',
      currentName: image.name,
      endpoint: api.referenceImageEndpoint(image.folderId, image.imageId),
      fallback: 'Could not rename the image.',
    });
  }

  async function deleteImage(image: ReferenceImage) {
    if (!window.confirm(`Remove “${image.name}” from the reference library?`)) return;
    const result = await performLibraryMutation(async () => {
      await api.deleteReferenceImage(image.folderId, image.imageId);
      await refresh();
    }, 'Could not remove the image.');
    if (!result.ok) return;
    removeLibraryImages((attachment) => attachment.imageId === image.imageId);
    notify('Reference image removed.', 'success');
  }

  return {
    referenceLibraryQuery,
    isMutating,
    fileInput,
    refresh,
    createFolder,
    renameFolder,
    deleteFolder,
    chooseUploads,
    handleFiles,
    renameImage,
    deleteImage,
  };
}

export type ReferenceLibraryController = ReturnType<typeof useReferenceLibrary>;
