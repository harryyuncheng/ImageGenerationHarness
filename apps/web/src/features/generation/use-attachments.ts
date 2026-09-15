import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { revokeUploadPreviews } from '../../shared/images/files.js';
import { useAlert } from '../../shared/hooks/use-alert.js';
import type {
  Attachment,
  ImageInputRole,
  ImageInputs,
  MaskAttachment,
  StyleGuideAttachment,
  UploadAttachment,
} from '../../shared/types/attachments.js';
import type { Capability, StyleGuideImage } from '../../shared/types/domain.js';
import { styleGuideImageContentUrl } from '../style-guide/api.js';
import { imageInputRoles } from './capabilities.js';
import { mainSourceImage } from './model-presentation.js';
import { addImageFiles, uploadRoles } from './attachment-uploads.js';

export interface InputSelection {
  source: Attachment | null | undefined;
  references: readonly Attachment[] | undefined;
  mask: MaskAttachment | undefined;
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

function styleGuideAttachment(image: StyleGuideImage): StyleGuideAttachment {
  return {
    source: 'style-guide',
    id: `style-guide:${image.imageId}`,
    folderId: image.folderId,
    imageId: image.imageId,
    name: image.name,
    mediaType: image.mediaType,
    byteLength: image.byteLength,
    previewUrl: styleGuideImageContentUrl(image.folderId, image.imageId),
  };
}

function resolveInputs(
  capability: Capability,
  selection: InputSelection,
  styleGuideImages: readonly StyleGuideAttachment[],
) {
  const guidesById = new Map(styleGuideImages.map((image) => [image.imageId, image]));
  const resolveImage = (image: Attachment) => {
    if (image.source !== 'style-guide') return image;
    const guide = guidesById.get(image.imageId);
    return guide && image.snapshot ? image : guide;
  };
  const roles = imageInputRoles(capability);
  const availableReferences = (selection.references ?? styleGuideImages)
    .map(resolveImage)
    .filter((image): image is Attachment => image !== undefined);
  const selectedSource =
    selection.source === undefined
      ? availableReferences[0]
      : selection.source
        ? resolveImage(selection.source)
        : undefined;
  const source = roles.includes('source') ? selectedSource : undefined;
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
  return { inputs, roles, blockedReason };
}

function removeSelectedInput(
  selection: InputSelection,
  inputs: ImageInputs,
  role: 'source' | 'references',
  imageId?: string,
): InputSelection {
  return {
    ...selection,
    source: role === 'source' ? null : (inputs.source ?? selection.source),
    references: (selection.references ?? inputs.references).filter(
      (image) =>
        image.id !== inputs.source?.id &&
        (role !== 'references' || (imageId !== undefined && image.id !== imageId)),
    ),
    mask: role === 'source' ? undefined : selection.mask,
  };
}

function styleGuideSelection(
  capability: Capability,
  selection: InputSelection,
  availableImages: readonly StyleGuideAttachment[],
  guide: StyleGuideImage | readonly StyleGuideImage[],
): InputSelection {
  const { inputs, roles } = resolveInputs(capability, selection, availableImages);
  const image = 'imageId' in guide ? guide : undefined;
  if (image) {
    if (inputs.source?.source === 'style-guide' && inputs.source.imageId === image.imageId) {
      return removeSelectedInput(selection, inputs, 'source');
    }
    const reference = inputs.references.find(
      (input) => input.source === 'style-guide' && input.imageId === image.imageId,
    );
    if (reference) return removeSelectedInput(selection, inputs, 'references', reference.id);
  }
  const additions = ('imageId' in guide ? [guide] : guide).map(styleGuideAttachment);
  const selectedSource = inputs.source ?? selection.source;
  let source =
    selectedSource?.source === 'style-guide' && selectedSource.folderId !== image?.folderId
      ? undefined
      : (selectedSource ?? undefined);
  let references = (selection.references ?? inputs.references).filter(
    (reference) =>
      reference.id !== inputs.source?.id &&
      (reference.source !== 'style-guide' || reference.folderId === image?.folderId),
  );
  const fillsSource =
    roles.includes('source') &&
    (!source || (!roles.includes('references') && source.source === 'style-guide'));
  if (fillsSource) source = additions.shift();
  if (roles.includes('references')) {
    if (capability.maxInputImages === undefined) {
      const reference = additions[0];
      if (reference && references.every((input) => input.source === 'style-guide')) {
        references = [reference];
      } else if (reference && !fillsSource) {
        throw new Error(
          `${capability.name} only accepts one reference image. Remove the current reference or choose a model that accepts more reference images.`,
        );
      }
    } else {
      references = [...references, ...additions];
    }
  } else if (additions.length > 0 && !fillsSource) {
    throw new Error(
      roles.includes('source')
        ? `${capability.name} only accepts one source image. Remove the current source or choose a model that accepts reference images.`
        : 'Choose an image-based model before selecting style guide images.',
    );
  }
  return {
    source,
    references,
    mask: source?.id === selectedSource?.id ? selection.mask : undefined,
  };
}

export function useAttachments(capability: Capability) {
  const feedback = useAlert();
  const [selection, setSelection] = useState<InputSelection>(emptySelection);
  const [styleGuideImages, setGuideImages] = useState<readonly StyleGuideAttachment[]>([]);
  const [maskStatus, setMaskStatus] = useState<{ sourceId: string; message: string }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const pickerRole = useRef<ImageInputRole | undefined>(undefined);
  const mounted = useRef(true);
  const resolved = resolveInputs(capability, selection, styleGuideImages);
  const { inputs, roles } = resolved;
  const { source } = inputs;
  const latest = useRef({ capability, selection, inputs, styleGuideImages });
  latest.current = { capability, selection, inputs, styleGuideImages };
  const uploadOptions = { state: latest.current, latest, mounted, setSelection, feedback };
  const ownedSelection = useRef(selection);
  const blockedReason =
    resolved.blockedReason ??
    (roles.includes('mask') &&
    mainSourceImage(inputs) !== undefined &&
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

  const setStyleGuideImages = useCallback((images: readonly StyleGuideImage[]) => {
    setGuideImages(images.map(styleGuideAttachment));
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
    feedback.clearAlert();
    try {
      pickerRole.current = uploadRoles(capability, inputs, role)[0];
      fileInput.current?.click();
    } catch (error) {
      feedback.reportError(error instanceof Error ? error.message : 'Could not choose an image.');
    }
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    void addImageFiles(uploadOptions, Array.from(event.target.files ?? []), pickerRole.current);
    pickerRole.current = undefined;
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLElement>, role?: ImageInputRole) {
    event.preventDefault();
    void addImageFiles(uploadOptions, Array.from(event.dataTransfer.files), role);
  }

  function removeInput(role: 'source' | 'references', imageId?: string) {
    feedback.clearAlert();
    setSelection((current) =>
      removeSelectedInput(
        current,
        resolveInputs(capability, current, styleGuideImages).inputs,
        role,
        imageId,
      ),
    );
  }

  return {
    feedback,
    inputs,
    roles,
    blockedReason,
    fileInput,
    chooseFiles,
    handleFiles,
    handleDrop,
    removeInput,
    setMask,
    reportMaskStatus,
    setStyleGuideImages,
    styleGuideFolderId: styleGuideImages[0]?.folderId,
    restoreInputs: (restored: ImageInputs) => {
      feedback.clearAlert();
      setSelection({ ...restored, source: restored.source ?? null });
      setGuideImages(
        [restored.source, ...restored.references].filter(
          (image): image is StyleGuideAttachment => image?.source === 'style-guide',
        ),
      );
      setMaskStatus(undefined);
    },
    moveOutputToReferences: (image: Attachment): boolean => {
      feedback.clearAlert();
      const next = {
        source: null,
        references: inputs.references.some(
          (reference) =>
            reference.source !== 'upload' &&
            image.source !== 'upload' &&
            reference.imageId === image.imageId,
        )
          ? inputs.references
          : [...inputs.references, image],
        mask: undefined,
      };
      const resolved = resolveInputs(capability, next, styleGuideImages);
      const error = !roles.includes('references')
        ? `${capability.name} does not accept reference images. Choose a model that does.`
        : (resolved.blockedReason ??
          (resolved.inputs.references.length !== next.references.length
            ? `${capability.name} only accepts one reference image. Remove the current reference first.`
            : undefined));
      if (error) {
        feedback.reportError(error);
        return false;
      }
      setSelection(next);
      setMaskStatus(undefined);
      return true;
    },
    applyStyleGuide: (images: readonly StyleGuideImage[], target: Capability) => {
      const next = styleGuideSelection(target, selection, styleGuideImages, images);
      feedback.clearAlert();
      setGuideImages(images.map(styleGuideAttachment));
      setSelection(next);
    },
    toggleStyleGuideImage: (image: StyleGuideImage, target: Capability) => {
      const next = styleGuideSelection(target, selection, styleGuideImages, image);
      feedback.clearAlert();
      setGuideImages(
        styleGuideImages[0]?.folderId === image.folderId
          ? styleGuideImages.some((candidate) => candidate.imageId === image.imageId)
            ? styleGuideImages
            : [...styleGuideImages, styleGuideAttachment(image)]
          : [styleGuideAttachment(image)],
      );
      setSelection(next);
    },
    reset: () => {
      feedback.clearAlert();
      setSelection({ source: null, references: [], mask: undefined });
      setMaskStatus(undefined);
    },
  };
}

export type AttachmentsController = ReturnType<typeof useAttachments>;
