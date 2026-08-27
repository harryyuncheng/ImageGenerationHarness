import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { runMutation, type MutationOutcome } from '../../shared/api/mutation.js';
import { queryKeys } from '../../shared/api/query-keys.js';
import { usePersistentState } from '../../shared/hooks/use-persistent-state.js';
import {
  readAsData,
  revokeUploadPreviews,
  supportedImageFiles,
} from '../../shared/images/files.js';
import type { Confirm, Prompt } from '../../shared/hooks/use-dialogs.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type { UploadAttachment } from '../../shared/types/attachments.js';
import type { StyleGuideFolder, StyleGuideImage } from '../../shared/types/domain.js';
import type { AttachmentsController } from '../generation/use-attachments.js';
import type { GenerationSettingsController } from '../generation/use-generation-settings.js';
import * as api from './api.js';

interface StyleGuideOptions {
  activeRepositoryId: string | undefined;
  notify: Notify;
  confirm: Confirm;
  prompt: Prompt;
  requireRepository: (action: string) => boolean;
  attachments: AttachmentsController;
  settings: GenerationSettingsController;
}

export function useStyleGuide({
  activeRepositoryId,
  notify,
  confirm,
  prompt,
  requireRepository,
  attachments,
  settings,
}: StyleGuideOptions) {
  const [isMutating, setIsMutating] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const [activeFolderId, setActiveFolderId] = usePersistentState<string | null>(
    `harness-active-style-guide:${activeRepositoryId ?? 'none'}`,
    null,
  );

  const styleGuideQuery = useQuery({
    queryKey: queryKeys.styleGuide(activeRepositoryId),
    queryFn: api.getStyleGuide,
    enabled: Boolean(activeRepositoryId),
    retry: false,
  });

  const folders = styleGuideQuery.data?.folders ?? [];
  const activeFolder = folders.find((folder) => folder.folderId === activeFolderId);
  const activeImages = activeFolder?.images;
  const { setStyleGuideImages } = attachments;

  useEffect(() => {
    setStyleGuideImages(activeImages ?? []);
  }, [activeImages, setStyleGuideImages]);

  /**
   * Only Create-tab models consume a style guide image, and Core is text-only, so
   * activating a guide moves the studio to the closest image-capable model.
   */
  function toggleActiveFolder(folder: StyleGuideFolder) {
    if (folder.folderId === activeFolderId) {
      setActiveFolderId(null);
      notify(`“${folder.name}” is no longer applied.`);
      return;
    }
    setActiveFolderId(folder.folderId);
    if (settings.selectedCapability.canonicalId === 'generation/core') {
      settings.updateSettings('targetId', 'generation/sd3.5-large');
    }
    notify(`“${folder.name}” is now your active style guide.`, 'success');
  }

  async function refresh() {
    await styleGuideQuery.refetch();
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

  async function createFolder() {
    if (!requireRepository('create a style guide')) return;
    const name = await prompt({
      title: 'New style guide',
      label: 'Name',
      placeholder: 'Editorial lighting',
      confirmLabel: 'Create style guide',
    });
    if (!name) return;
    const result = await performLibraryMutation(async () => {
      await api.createStyleGuideFolder(name);
      await refresh();
    }, 'Could not create the guide.');
    if (result.ok) notify('Style guide created.', 'success');
  }

  async function renameFolder(folder: StyleGuideFolder, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) return;
    await performLibraryMutation(async () => {
      await api.renameStyleGuideRecord(
        api.styleGuideFolderEndpoint(folder.folderId),
        trimmed,
        'Could not rename the guide.',
      );
      await refresh();
    }, 'Could not rename the guide.');
  }

  async function deleteFolder(folder: StyleGuideFolder) {
    const confirmed = await confirm({
      title: `Delete “${folder.name}”?`,
      body: 'This permanently deletes the guide and every image inside it from this repository. This cannot be undone.',
      confirmLabel: 'Delete guide',
      danger: true,
    });
    if (!confirmed) return;
    const result = await performLibraryMutation(async () => {
      await api.deleteStyleGuideFolder(folder.folderId);
      await refresh();
    }, 'Could not delete the guide.');
    if (!result.ok) return;
    if (folder.folderId === activeFolderId) setActiveFolderId(null);
    notify('Style guide deleted.', 'success');
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
          await api.uploadStyleGuideImage(folderId, upload);
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
      `${String(accepted.length)} style guide image${accepted.length === 1 ? '' : 's'} added.`,
      'success',
    );
  }

  async function renameImage(image: StyleGuideImage) {
    const name = await prompt({
      title: 'Rename image',
      label: 'Name',
      initialValue: image.name,
      confirmLabel: 'Rename',
    });
    if (!name || name === image.name) return;
    await performLibraryMutation(async () => {
      await api.renameStyleGuideRecord(
        api.styleGuideImageEndpoint(image.folderId, image.imageId),
        name,
        'Could not rename the image.',
      );
      await refresh();
    }, 'Could not rename the image.');
  }

  async function deleteImage(image: StyleGuideImage) {
    const confirmed = await confirm({
      title: `Delete “${image.name}”?`,
      body: 'This permanently deletes the image file from this repository, not just from this guide. This cannot be undone.',
      confirmLabel: 'Delete image',
      danger: true,
    });
    if (!confirmed) return;
    const result = await performLibraryMutation(async () => {
      await api.deleteStyleGuideImage(image.folderId, image.imageId);
      await refresh();
    }, 'Could not delete the image.');
    if (!result.ok) return;
    notify('Image deleted.', 'success');
  }

  return {
    styleGuideQuery,
    folders,
    activeFolderId,
    ...(activeFolder ? { activeFolder } : {}),
    toggleActiveFolder,
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

export type StyleGuideController = ReturnType<typeof useStyleGuide>;
