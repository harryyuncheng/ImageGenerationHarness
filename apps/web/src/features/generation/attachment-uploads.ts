import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { AlertController } from '../../shared/hooks/use-alert.js';
import {
  readAsData,
  revokeUploadPreviews,
  supportedImageFiles,
  unsupportedImageMessage,
} from '../../shared/images/files.js';
import type {
  ImageInputRole,
  ImageInputs,
  StyleGuideAttachment,
  UploadAttachment,
} from '../../shared/types/attachments.js';
import type { Capability } from '../../shared/types/domain.js';
import { imageInputRoles } from './capabilities.js';
import type { InputSelection } from './use-attachments.js';

interface UploadState {
  capability: Capability;
  selection: InputSelection;
  inputs: ImageInputs;
  styleGuideImages: readonly StyleGuideAttachment[];
}

export function uploadRoles(
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

export async function addImageFiles(
  options: {
    state: UploadState;
    latest: RefObject<UploadState>;
    mounted: RefObject<boolean>;
    setSelection: Dispatch<SetStateAction<InputSelection>>;
    feedback: AlertController;
  },
  files: File[],
  role?: ImageInputRole,
) {
  if (files.length === 0) return;
  const { state, feedback, latest, mounted, setSelection } = options;
  const { capability, selection, inputs, styleGuideImages } = state;
  feedback.clearAlert();
  const accepted = supportedImageFiles(files);
  if (accepted.length !== files.length) {
    feedback.reportWarning(unsupportedImageMessage);
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
      feedback.reportError('The inputs or model changed. Choose the images again.');
      return;
    }
    const valid = loaded.filter((image, index) => {
      if (
        capability.providerId === 'azure-foundry' &&
        (image.mediaType === 'image/webp' ||
          (targetRoles[index] === 'mask' && image.mediaType !== 'image/png'))
      ) {
        URL.revokeObjectURL(image.previewUrl);
        feedback.reportError(
          targetRoles[index] === 'mask'
            ? 'GPT Image masks must be PNG images.'
            : 'GPT Image references and source images must be PNG or JPEG.',
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
          const sourceId = next.source?.id ?? inputs.source?.id;
          if (sourceId) {
            next.mask = {
              ...image,
              maskSourceId: sourceId,
              maskEncoding: capability.providerId === 'azure-foundry' ? 'alpha' : 'luminance',
            };
          }
        }
      }
      return next;
    });
    if (accepted.length > targetRoles.length) {
      feedback.reportNotice(
        `Added files to the ${String(targetRoles.length)} available image slots. The extra files were not added.`,
      );
    }
  } catch (error) {
    revokeUploadPreviews(loaded);
    feedback.reportError(error instanceof Error ? error.message : 'Could not read the image.');
  }
}
