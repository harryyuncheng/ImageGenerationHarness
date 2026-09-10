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
import { useInlineError } from '../../shared/hooks/use-inline-error.js';
import type { UploadAttachment } from '../../shared/types/attachments.js';
import type { StyleGuideFolder, StyleGuideImage } from '../../shared/types/domain.js';
import type { AttachmentsController } from '../generation/use-attachments.js';
import type { GenerationSettingsController } from '../generation/use-generation-settings.js';
import { defaultCapabilities, resolveCapability } from '../generation/capabilities.js';
import * as api from './api.js';

interface StyleGuideOptions {
  activeRepositoryId: string | undefined;
  confirm: Confirm;
  prompt: Prompt;
  requireRepository: (action: string) => boolean;
  attachments: AttachmentsController;
  settings: GenerationSettingsController;
}

export function useStyleGuide({
  activeRepositoryId,
  confirm,
  prompt,
  requireRepository,
  attachments,
  settings,
}: StyleGuideOptions) {
  const feedback = useInlineError();
  const guideCapability =
    settings.selectedCapability.canonicalId === 'generation/core'
      ? resolveCapability(defaultCapabilities, 'generation/sd3.5-large')
      : settings.selectedCapability;
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
  const appliedImages =
    activeImages?.filter((image) =>
      [attachments.inputs.source, ...attachments.inputs.references].some(
        (input) => input?.source === 'style-guide' && input.imageId === image.imageId,
      ),
    ) ?? [];

  useEffect(() => {
    setStyleGuideImages(activeImages ?? []);
  }, [activeImages, setStyleGuideImages]);

  useEffect(() => {
    if (attachments.styleGuideFolderId === activeFolderId && appliedImages.length === 0)
      setActiveFolderId(null);
  }, [activeFolderId, attachments.styleGuideFolderId, appliedImages.length, setActiveFolderId]);

  function activateFolder(folderId: string) {
    setActiveFolderId(folderId);
    if (guideCapability.canonicalId !== settings.selectedCapability.canonicalId) {
      settings.updateSettings('targetId', guideCapability.canonicalId);
    }
  }

  function toggleActiveFolder(folder: StyleGuideFolder) {
    if (folder.folderId === activeFolderId) {
      setActiveFolderId(null);
      return;
    }
    attachments.applyStyleGuide(folder.images);
    activateFolder(folder.folderId);
  }

  function toggleImage(image: StyleGuideImage) {
    feedback.clearError();
    try {
      attachments.toggleStyleGuideImage(image, guideCapability);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      feedback.reportError(error.message);
      return;
    }
    activateFolder(image.folderId);
  }

  async function refresh() {
    await styleGuideQuery.refetch();
  }

  async function performLibraryMutation<T>(
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<MutationOutcome<T>> {
    feedback.clearError();
    setIsMutating(true);
    try {
      return await runMutation(operation, fallback, feedback.reportError);
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
    await performLibraryMutation(async () => {
      await api.createStyleGuideFolder(name);
      await refresh();
    }, 'Could not create the guide.');
  }

  async function renameRecord(record: StyleGuideFolder | StyleGuideImage, name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === record.name) return;
    const isImage = 'imageId' in record;
    const endpoint = isImage
      ? api.styleGuideImageEndpoint(record.folderId, record.imageId)
      : api.styleGuideFolderEndpoint(record.folderId);
    const fallback = `Could not rename the ${isImage ? 'image' : 'guide'}.`;
    await performLibraryMutation(async () => {
      await api.renameStyleGuideRecord(endpoint, trimmed, fallback);
      await refresh();
    }, fallback);
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
    if (accepted.length === 0) {
      feedback.reportError('Use PNG, JPEG, or WebP images up to 10 MB.');
      return;
    }
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
    if (accepted.length !== files.length) {
      feedback.reportError('Some files were not added. Use PNG, JPEG, or WebP images up to 10 MB.');
    }
  }

  async function deleteImage(image: StyleGuideImage) {
    const confirmed = await confirm({
      title: `Delete “${image.name}”?`,
      body: 'This permanently deletes the image file from this repository, not just from this guide. This cannot be undone.',
      confirmLabel: 'Delete image',
      danger: true,
    });
    if (!confirmed) return;
    await performLibraryMutation(async () => {
      await api.deleteStyleGuideImage(image.folderId, image.imageId);
      await refresh();
    }, 'Could not delete the image.');
  }

  return {
    feedback,
    styleGuideQuery,
    folders,
    activeFolderId,
    appliedImages,
    ...(activeFolder ? { activeFolder } : {}),
    toggleActiveFolder,
    toggleImage,
    isMutating,
    fileInput,
    refresh,
    createFolder,
    renameFolder: renameRecord,
    deleteFolder,
    chooseUploads,
    handleFiles,
    renameImage: renameRecord,
    deleteImage,
  };
}

export type StyleGuideController = ReturnType<typeof useStyleGuide>;
