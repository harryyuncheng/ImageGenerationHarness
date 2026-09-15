import { useQuery } from '@tanstack/react-query';
import type { GenerationStyleGuide } from '@harness/contracts';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { runMutation, type MutationOutcome } from '../../shared/api/mutation.js';
import { queryKeys } from '../../shared/api/query-keys.js';
import { usePersistentState } from '../../shared/hooks/use-persistent-state.js';
import {
  readAsData,
  revokeUploadPreviews,
  supportedImageFiles,
  unsupportedImageMessage,
} from '../../shared/images/files.js';
import type { Confirm, Prompt } from '../../shared/hooks/use-dialogs.js';
import { useAlert } from '../../shared/hooks/use-alert.js';
import type { StyleGuideAttachment, UploadAttachment } from '../../shared/types/attachments.js';
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
  const feedback = useAlert();
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
  const [restoredGuide, setRestoredGuide] = useState<GenerationStyleGuide | null>();

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
  const appliedImages = [attachments.inputs.source, ...attachments.inputs.references].filter(
    (input): input is StyleGuideAttachment => input?.source === 'style-guide',
  );

  useEffect(() => {
    if (restoredGuide === undefined) setStyleGuideImages(activeImages ?? []);
  }, [activeImages, restoredGuide, setStyleGuideImages]);

  useEffect(() => {
    if (attachments.styleGuideFolderId === activeFolderId && appliedImages.length === 0) {
      setActiveFolderId(null);
      setRestoredGuide(undefined);
    }
  }, [activeFolderId, attachments.styleGuideFolderId, appliedImages.length, setActiveFolderId]);

  function toggleGuide(guide: StyleGuideFolder | StyleGuideImage): boolean {
    feedback.clearAlert();
    if ('images' in guide && guide.folderId === activeFolderId) {
      setRestoredGuide(undefined);
      setActiveFolderId(null);
      return true;
    }
    try {
      if ('images' in guide) attachments.applyStyleGuide(guide.images, guideCapability);
      else attachments.toggleStyleGuideImage(guide, guideCapability);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      feedback.reportError(error.message);
      return false;
    }
    if ('images' in guide || guide.folderId !== activeFolderId) setRestoredGuide(undefined);
    setActiveFolderId(guide.folderId);
    if (guideCapability.canonicalId !== settings.selectedCapability.canonicalId) {
      settings.updateSettings('targetId', guideCapability.canonicalId);
    }
    return true;
  }

  async function refresh() {
    await styleGuideQuery.refetch();
  }

  async function performLibraryMutation<T>(
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<MutationOutcome<T>> {
    feedback.clearAlert();
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
    if (folder.folderId === activeFolderId) {
      setActiveFolderId(null);
      setRestoredGuide(undefined);
    }
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
      feedback.reportWarning(unsupportedImageMessage);
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
      feedback.reportWarning(`Some files were not added. ${unsupportedImageMessage}`);
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
    activeFolder: restoredGuide ?? activeFolder,
    restoreGuide: (guide: GenerationStyleGuide | null) => {
      feedback.clearAlert();
      setRestoredGuide(guide);
      setActiveFolderId(guide?.folderId ?? null);
    },
    toggleActiveFolder: toggleGuide,
    toggleImage: toggleGuide,
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
