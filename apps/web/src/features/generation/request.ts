import { isCanonicalCapabilityId, type CanonicalCapabilityId } from '@harness/capabilities/catalog';
import { IMAGE_SIZE_BY_ASPECT_RATIO, type CreateRunRequest } from '@harness/contracts';
import type { Attachment, ImageInputs } from '../../shared/types/attachments.js';
import type { Capability } from '../../shared/types/domain.js';
import { effectiveSeed, hasParameter } from './capabilities.js';
import type { GenerationSettings } from './settings.js';

type GenerationSubmission = Omit<CreateRunRequest, 'repositoryId'>;

function assertNeverCapability(value: never): never {
  throw new Error(`Unhandled capability: ${String(value)}`);
}

function buildGenerationRequest(
  capability: Capability,
  prompt: string,
  settings: GenerationSettings,
  inputs: ImageInputs,
): Record<string, unknown> {
  const attachmentValue = (attachment: Attachment): string => {
    if (attachment.snapshot) {
      const { kind, id, inputIndex } = attachment.snapshot;
      return `repo-input://${kind}/${id}/${String(inputIndex)}`;
    }
    return attachment.source === 'upload' ? attachment.data : `repo-image://${attachment.imageId}`;
  };
  const image = inputs.source ? attachmentValue(inputs.source) : undefined;
  const mask = inputs.mask ? attachmentValue(inputs.mask) : undefined;
  const references = inputs.references.map(attachmentValue);
  const output_format = capability.outputFormats.includes(settings.outputFormat)
    ? settings.outputFormat
    : capability.outputFormats.includes('png')
      ? 'png'
      : capability.outputFormats[0];
  const seed = settings.seedMode === 'random' ? 0 : effectiveSeed(capability, settings.seed);
  const negative = settings.negativePrompt.trim();
  const optional = {
    ...(negative && hasParameter(capability, 'negative_prompt')
      ? { negative_prompt: negative }
      : {}),
    ...(hasParameter(capability, 'seed') ? { seed } : {}),
    ...(output_format && hasParameter(capability, 'output_format') ? { output_format } : {}),
  };
  const serviceOptional = {
    ...optional,
    ...(settings.stylePreset && hasParameter(capability, 'style_preset')
      ? { style_preset: settings.stylePreset }
      : {}),
  };
  // GPT Image rejects a transparent background unless PNG bytes are requested.
  const gptImageShared = {
    size: IMAGE_SIZE_BY_ASPECT_RATIO[settings.aspectRatio],
    quality: settings.quality,
    background:
      settings.background === 'transparent' && output_format === 'png' ? 'transparent' : 'auto',
  };

  if (!isCanonicalCapabilityId(capability.canonicalId)) {
    throw new Error(`Unsupported capability: ${capability.canonicalId}`);
  }
  const canonicalId: CanonicalCapabilityId = capability.canonicalId;
  if (canonicalId === 'generation/core') {
    return { prompt, aspect_ratio: settings.aspectRatio, ...optional };
  }
  if (canonicalId === 'generation/gpt-image-2') {
    return {
      prompt,
      ...(references.length > 0 ? { image: references } : {}),
      ...gptImageShared,
      ...optional,
    };
  }
  if (canonicalId === 'generation/ultra' || canonicalId === 'generation/sd3.5-large') {
    return image
      ? { mode: 'image-to-image', prompt, image, strength: settings.strength, ...optional }
      : { mode: 'text-to-image', prompt, aspect_ratio: settings.aspectRatio, ...optional };
  }
  if (!image) return {};

  switch (canonicalId) {
    case 'edit/gpt-image-2':
      return {
        prompt,
        image: [image, ...references],
        ...(mask ? { mask } : {}),
        ...gptImageShared,
        input_fidelity: settings.inputFidelity,
        ...optional,
      };
    case 'service/control-sketch':
    case 'service/control-structure':
      return { prompt, image, control_strength: settings.controlStrength, ...serviceOptional };
    case 'service/style-guide':
      return {
        prompt,
        image,
        aspect_ratio: settings.aspectRatio,
        fidelity: settings.fidelity,
        ...serviceOptional,
      };
    case 'service/style-transfer':
      return {
        init_image: image,
        ...(references[0] ? { style_image: references[0] } : {}),
        ...(prompt ? { prompt } : {}),
        composition_fidelity: settings.compositionFidelity,
        style_strength: settings.styleStrength,
        change_strength: settings.changeStrength,
        ...serviceOptional,
      };
    case 'service/creative-upscale':
    case 'service/conservative-upscale':
      return { prompt, image, creativity: settings.creativity, ...serviceOptional };
    case 'service/fast-upscale':
      return { image, ...serviceOptional };
    case 'service/inpaint':
      return {
        prompt,
        image,
        ...(mask ? { mask } : {}),
        grow_mask: settings.growMask,
        ...serviceOptional,
      };
    case 'service/outpaint':
      return {
        image,
        ...(prompt ? { prompt } : {}),
        creativity: settings.creativity,
        left: settings.outpaintLeft,
        right: settings.outpaintRight,
        up: settings.outpaintUp,
        down: settings.outpaintDown,
        ...serviceOptional,
      };
    case 'service/search-recolor':
      return {
        prompt,
        image,
        select_prompt: settings.selectPrompt.trim(),
        grow_mask: settings.growMask,
        ...serviceOptional,
      };
    case 'service/search-replace':
      return {
        prompt,
        image,
        search_prompt: settings.searchPrompt.trim(),
        grow_mask: settings.growMask,
        ...serviceOptional,
      };
    case 'service/erase':
      return {
        image,
        ...(mask ? { mask } : {}),
        grow_mask: settings.growMask,
        ...serviceOptional,
      };
    case 'service/remove-background':
      return { image, ...serviceOptional };
    default:
      return assertNeverCapability(canonicalId);
  }
}

function makeSeedPlan(settings: GenerationSettings, capability: Capability) {
  if (!hasParameter(capability, 'seed')) return { strategy: 'provider-random' as const };
  const seed = effectiveSeed(capability, settings.seed);
  if (settings.seedMode === 'fixed') return { strategy: 'fixed-repeat' as const, seed };
  if (settings.seedMode === 'sequential') return { strategy: 'sequential' as const, start: seed };
  return { strategy: 'harness-random' as const };
}

export function buildGenerationSubmission(
  capability: Capability,
  prompt: string,
  settings: GenerationSettings,
  inputs: ImageInputs,
): GenerationSubmission {
  return {
    targetId: capability.canonicalId,
    request: buildGenerationRequest(capability, prompt, settings, inputs),
    requestedJobCount: settings.outputCount,
    seedPlan: makeSeedPlan(settings, capability),
    settings: { ...settings, targetId: capability.canonicalId },
  };
}
