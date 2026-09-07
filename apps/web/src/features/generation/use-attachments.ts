import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  readAsData,
  revokeUploadPreviews,
  supportedImageFiles,
} from '../../shared/images/files.js';
import type { Notify } from '../../shared/hooks/use-toasts.js';
import type {
  Attachment,
  ImageInputRole,
  ImageInputs,
  UploadAttachment,
} from '../../shared/types/attachments.js';
import type { Capability, StyleGuideImage } from '../../shared/types/domain.js';
import { styleGuideImageContentUrl } from '../style-guide/api.js';
import { imageInputRoles } from './capabilities.js';
import { mainImageInputs } from './model-presentation.js';

interface InputSelection {
  source: Attachment | null | undefined;
  references: readonly Attachment[] | undefined;
  mask: UploadAttachment | undefined;
}

const emptySelection: InputSelection = {
  source: undefined,
  references: undefined,
  mask: undefined,
};

function revokeRemovedUploads(current: InputSelection, next: InputSelection): void {
  const retained = [next.source, ...(next.references ?? []), next.mask];
  revokeUploadPreviews(
    [current.source, ...(current.references ?? []), current.mask].filter(
      (image): image is Attachment =>
        image != null && !retained.some((candidate) => candidate?.id === image.id),
    ),
  );
}

function resolveInputs(
  capability: Capability,
  selection: InputSelection,
  styleGuideImages: readonly StyleGuideImage[],
) {
  const guideImages = styleGuideImages.map((image): Attachment => ({
    source: 'style-guide',
    id: `style-guide:${image.imageId}`,
    folderId: image.folderId,
    imageId: image.imageId,
    name: image.name,
    mediaType: image.mediaType,
    byteLength: image.byteLength,
    previewUrl: styleGuideImageContentUrl(image.folderId, image.imageId),
  }));
  const roles = imageInputRoles(capability);
  const availableReferences = (selection.references ?? guideImages).filter(
    (image) => image.source !== 'style-guide' || guideImages.some((guide) => guide.id === image.id),
  );
  const selectedSource =
    selection.source === undefined ? availableReferences[0] : (selection.source ?? undefined);
  const source =
    roles.includes('source') &&
    (selectedSource?.source !== 'style-guide' ||
      guideImages.some((guide) => guide.id === selectedSource.id))
      ? selectedSource
      : undefined;
  const referenceLimit =
    capability.maxInputImages === undefined
      ? 1
      : capability.maxInputImages - Number(roles.includes('source'));
  const selectedReferences = availableReferences.filter((image) => image.id !== source?.id);
  const references = roles.includes('references')
    ? capability.maxInputImages === undefined
      ? selectedReferences.slice(0, 1)
      : selectedReferences
    : [];
  const mask =
    roles.includes('mask') && selection.mask?.maskSourceId === source?.id
      ? selection.mask
      : undefined;
  const inputs: ImageInputs = { source, references, mask };
  const encoding = capability.providerId === 'azure-foundry' ? 'alpha' : 'luminance';
  const blockedReason =
    references.length > referenceLimit
      ? `Too many references. ${capability.name} accepts ${String(referenceLimit)} references${roles.includes('source') ? ' plus one source image' : ''}. Remove ${String(references.length - referenceLimit)} to continue.`
      : capability.providerId === 'azure-foundry' &&
          [source, ...references].some((image) => image?.mediaType === 'image/webp')
        ? `${capability.name} needs PNG or JPEG images. Remove or replace WebP inputs.`
        : mask?.maskEncoding !== undefined && mask.maskEncoding !== encoding
          ? 'Preparing the mask for this model.'
          : undefined;
  return { inputs, roles, referenceLimit, blockedReason };
}

function uploadRoles(
  capability: Capability,
  inputs: ImageInputs,
  role: ImageInputRole | undefined,
): readonly ImageInputRole[] {
  const roles = imageInputRoles(capability);
  if (roles.length === 0) throw new Error('Choose an image-based model before adding images.');
  const first =
    role ??
    (roles.includes('source') && (!inputs.source || inputs.source.source === 'style-guide')
      ? 'source'
      : roles.includes('references')
        ? 'references'
        : 'source');
  if (!roles.includes(first)) throw new Error(`This model does not accept a ${first} image.`);
  if (first === 'mask' && !inputs.source) {
    throw new Error('Choose a source image before adding a mask.');
  }
  if (capability.maxInputImages !== undefined && first !== 'mask') {
    const remaining = Math.max(
      0,
      capability.maxInputImages - Number(roles.includes('source')) - inputs.references.length,
    );
    const references = Array.from({ length: remaining }, () => 'references' as const);
    if (first === 'source') return ['source', ...references];
    if (remaining === 0) {
      throw new Error(
        `${capability.name} accepts ${String(capability.maxInputImages)} image inputs. Remove a reference first.`,
      );
    }
    return references;
  }
  return roles.slice(roles.indexOf(first));
}

export function useAttachments(capability: Capability, notify: Notify) {
  const [selection, setSelection] = useState<InputSelection>(emptySelection);
  const [styleGuideImages, setStyleGuideImages] = useState<readonly StyleGuideImage[]>([]);
  const [maskStatus, setMaskStatus] = useState<{ sourceId: string; message: string }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const pickerRole = useRef<ImageInputRole | undefined>(undefined);
  const mounted = useRef(true);
  const resolved = resolveInputs(capability, selection, styleGuideImages);
  const { inputs, roles, referenceLimit } = resolved;
  const { source } = inputs;
  const latest = useRef({ capability, selection, inputs, styleGuideImages });
  latest.current = { capability, selection, inputs, styleGuideImages };
  const ownedSelection = useRef(selection);
  const encoding = capability.providerId === 'azure-foundry' ? 'alpha' : 'luminance';
  const blockedReason =
    resolved.blockedReason ??
    (roles.includes('mask') &&
    mainImageInputs(inputs).some((input) => input.role === 'source') &&
    maskStatus?.sourceId === source?.id
      ? maskStatus?.message
      : undefined);

  useEffect(() => {
    revokeRemovedUploads(ownedSelection.current, selection);
    ownedSelection.current = selection;
  }, [selection]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revokeRemovedUploads(ownedSelection.current, emptySelection);
    };
  }, []);

  const setSource = useCallback((image: Attachment) => {
    setSelection((current) => {
      const state = latest.current;
      const { inputs } = resolveInputs(state.capability, current, state.styleGuideImages);
      return {
        ...current,
        source: image,
        references: inputs.source ? inputs.references : current.references,
        mask: current.mask?.maskSourceId === image.id ? current.mask : undefined,
      };
    });
  }, []);

  const setMask = useCallback((image: Attachment, nextMask: UploadAttachment | undefined) => {
    if (latest.current.inputs.source?.id !== image.id) return;
    setSelection((current) => ({
      ...current,
      mask: nextMask ? { ...nextMask, maskSourceId: image.id } : undefined,
    }));
    setMaskStatus(undefined);
  }, []);

  const reportMaskStatus = useCallback((sourceId: string, message: string | undefined) => {
    if (latest.current.inputs.source?.id !== sourceId) return;
    setMaskStatus((current) =>
      current?.sourceId === sourceId && current.message === message
        ? current
        : message === undefined
          ? undefined
          : { sourceId, message },
    );
  }, []);

  function chooseFiles(role?: ImageInputRole) {
    try {
      pickerRole.current = uploadRoles(capability, inputs, role)[0];
      fileInput.current?.click();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not choose an image.', 'error');
    }
  }

  async function addFiles(files: File[], role?: ImageInputRole) {
    if (files.length === 0) return;
    const accepted = supportedImageFiles(files);
    if (accepted.length !== files.length) {
      notify('Use PNG, JPEG, or WebP images up to 10 MB.', 'error');
    }
    const loaded: UploadAttachment[] = [];
    try {
      const targetRoles = uploadRoles(capability, inputs, role);
      for (const file of accepted.slice(0, targetRoles.length)) loaded.push(await readAsData(file));
      if (!mounted.current) {
        revokeUploadPreviews(loaded);
        return;
      }
      if (
        latest.current.capability.canonicalId !== capability.canonicalId ||
        latest.current.selection !== selection ||
        latest.current.styleGuideImages !== styleGuideImages
      ) {
        revokeUploadPreviews(loaded);
        notify('The inputs or model changed. Choose the images again.', 'error');
        return;
      }
      const valid = loaded.filter((image, index) => {
        if (
          capability.providerId === 'azure-foundry' &&
          (image.mediaType === 'image/webp' ||
            (targetRoles[index] === 'mask' && image.mediaType !== 'image/png'))
        ) {
          URL.revokeObjectURL(image.previewUrl);
          notify(
            targetRoles[index] === 'mask'
              ? 'GPT Image masks must be PNG images.'
              : 'GPT Image references and source images must be PNG or JPEG.',
            'error',
          );
          return false;
        }
        return true;
      });
      setSelection((current) => {
        const next = { ...current, source: inputs.source ?? current.source };
        for (const [index, image] of loaded.entries()) {
          if (!valid.includes(image)) continue;
          const slot = targetRoles[index];
          if (slot === 'source') {
            next.source = image;
            next.references = inputs.references;
            next.mask = undefined;
          } else if (slot === 'references') {
            next.references =
              capability.maxInputImages === undefined
                ? [image]
                : [...(next.references ?? inputs.references), image];
          } else if (slot === 'mask') {
            const sourceId = next.source?.id ?? source?.id;
            if (sourceId) next.mask = { ...image, maskSourceId: sourceId, maskEncoding: encoding };
          }
        }
        return next;
      });
      if (accepted.length > targetRoles.length) {
        notify(
          `Added files to ${String(targetRoles.length)} available image slots. Extra files were not added.`,
        );
      }
    } catch (error) {
      revokeUploadPreviews(loaded);
      notify(error instanceof Error ? error.message : 'Could not read the image.', 'error');
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    void addFiles(Array.from(event.target.files ?? []), pickerRole.current);
    pickerRole.current = undefined;
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLElement>, role?: ImageInputRole) {
    event.preventDefault();
    void addFiles(Array.from(event.dataTransfer.files), role);
  }

  function removeInput(role: 'source' | 'references', imageId?: string) {
    setSelection((current) => {
      const { inputs } = resolveInputs(capability, current, styleGuideImages);
      return {
        ...current,
        source: role === 'source' ? null : (inputs.source ?? current.source),
        references:
          role === 'references'
            ? inputs.references.filter((image) => imageId !== undefined && image.id !== imageId)
            : inputs.references,
        mask: role === 'source' ? undefined : current.mask,
      };
    });
  }

  return {
    inputs,
    roles,
    referenceLimit,
    blockedReason,
    fileInput,
    chooseFiles,
    handleFiles,
    handleDrop,
    removeInput,
    setSource,
    setMask,
    reportMaskStatus,
    setStyleGuideImages,
    styleGuideFolderId: styleGuideImages[0]?.folderId,
    applyStyleGuide: (images: readonly StyleGuideImage[]) => {
      setStyleGuideImages(images);
      setSelection((current) => {
        const { inputs } = resolveInputs(capability, current, styleGuideImages);
        const selectedSource = inputs.source ?? current.source;
        const source = selectedSource?.source === 'style-guide' ? undefined : selectedSource;
        return {
          source: source ?? undefined,
          references: undefined,
          mask: source ? current.mask : undefined,
        };
      });
    },
    reset: () => {
      setSelection({ source: null, references: [], mask: undefined });
      setMaskStatus(undefined);
    },
  };
}

export type AttachmentsController = ReturnType<typeof useAttachments>;
