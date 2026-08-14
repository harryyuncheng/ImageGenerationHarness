import {
  STABILITY_STANDARD_SEED_MAX,
  UINT32_MAX,
  aspectRatioSchema,
  outputFormatSchema,
  stylePresetSchema,
  type CapabilityDescriptor,
} from '@harness/contracts';
import { z } from 'zod';
import {
  capabilityCatalog,
  isCanonicalCapabilityId,
  type CanonicalCapabilityId,
} from './catalog.js';

export { CAPABILITY_REGISTRY_VERSION, capabilityCatalog } from './catalog.js';

const foundationOutputFormatSchema = z.enum(['jpeg', 'png']);
const generationSeedSchema = z.number().int().min(0).max(UINT32_MAX);
const standardSeedSchema = z.number().int().min(0).max(STABILITY_STANDARD_SEED_MAX);
const promptSchema = z.string().max(10_000);

const image = z.string().min(1);
const fullRangeGenerationOptional = {
  negative_prompt: promptSchema.optional(),
  seed: generationSeedSchema.default(0),
  output_format: foundationOutputFormatSchema.default('png'),
};
const standardGenerationOptional = {
  negative_prompt: promptSchema.optional(),
  seed: standardSeedSchema.default(0),
  output_format: outputFormatSchema.default('png'),
};

export const coreRequestSchema = z
  .object({
    prompt: promptSchema,
    aspect_ratio: aspectRatioSchema.default('1:1'),
    ...fullRangeGenerationOptional,
  })
  .strict();

const ultraTextToImageSchema = z
  .object({
    mode: z.literal('text-to-image').default('text-to-image'),
    prompt: promptSchema,
    aspect_ratio: aspectRatioSchema.default('1:1'),
    ...fullRangeGenerationOptional,
  })
  .strict();
const ultraImageToImageSchema = z
  .object({
    mode: z.literal('image-to-image'),
    prompt: promptSchema,
    image,
    strength: z.number().min(0).max(1).default(0.35),
    ...fullRangeGenerationOptional,
  })
  .strict();
const ultraRequestSchema = z.union([ultraTextToImageSchema, ultraImageToImageSchema]);

const sd35TextToImageSchema = z
  .object({
    mode: z.literal('text-to-image').default('text-to-image'),
    prompt: promptSchema,
    aspect_ratio: aspectRatioSchema.default('1:1'),
    ...standardGenerationOptional,
  })
  .strict();
const sd35ImageToImageSchema = z
  .object({
    mode: z.literal('image-to-image'),
    prompt: promptSchema,
    image,
    strength: z.number().min(0).max(1),
    ...standardGenerationOptional,
  })
  .strict();
const sd35RequestSchema = z.union([sd35TextToImageSchema, sd35ImageToImageSchema]);

const finishReasonSchema = z.enum([
  'Filter reason: prompt',
  'Filter reason: output image',
  'Filter reason: input image',
  'Inference error',
]);
export const stabilityResponseSchema = z
  .object({
    seeds: z.array(generationSeedSchema).optional(),
    finish_reasons: z.array(finishReasonSchema.nullable()),
    images: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.finish_reasons.every((reason) => reason === null) &&
      (!value.images || value.images.length === 0)
    ) {
      context.addIssue({ code: 'custom', message: 'Successful responses require image bytes' });
    }
  });

const commonImage = { image };
const commonOptional = {
  negative_prompt: promptSchema.optional(),
  seed: standardSeedSchema.default(0),
  output_format: outputFormatSchema.default('png'),
};
const promptImage = z.object({ prompt: promptSchema, ...commonImage, ...commonOptional }).strict();
const styledPromptImage = promptImage
  .extend({ style_preset: stylePresetSchema.optional() })
  .strict();
const control = styledPromptImage
  .extend({ control_strength: z.number().min(0).max(1).default(0.7) })
  .strict();
const maskOptional = {
  mask: image.optional(),
  grow_mask: z.number().int().min(0).max(20).default(5),
};

const requestSchemas = {
  'generation/core': coreRequestSchema,
  'generation/ultra': ultraRequestSchema,
  'generation/sd3.5-large': sd35RequestSchema,
  'service/control-sketch': control,
  'service/control-structure': control,
  'service/style-guide': styledPromptImage
    .extend({
      aspect_ratio: aspectRatioSchema.default('1:1'),
      fidelity: z.number().min(0).max(1).default(0.5),
    })
    .strict(),
  'service/style-transfer': z
    .object({
      init_image: image,
      style_image: image,
      prompt: promptSchema.optional(),
      ...commonOptional,
      composition_fidelity: z.number().min(0).max(1).default(0.9),
      style_strength: z.number().min(0).max(1).default(1),
      change_strength: z.number().min(0.1).max(1).default(0.9),
    })
    .strict(),
  'service/creative-upscale': styledPromptImage
    .extend({ creativity: z.number().min(0.1).max(0.5).default(0.3) })
    .strict(),
  'service/conservative-upscale': promptImage
    .extend({ creativity: z.number().min(0.1).max(0.5).default(0.35) })
    .strict(),
  'service/fast-upscale': z
    .object({ image, output_format: outputFormatSchema.default('png') })
    .strict(),
  'service/inpaint': styledPromptImage.extend(maskOptional).strict(),
  'service/outpaint': z
    .object({
      image,
      prompt: promptSchema.optional(),
      style_preset: stylePresetSchema.optional(),
      seed: standardSeedSchema.default(0),
      output_format: outputFormatSchema.default('png'),
      creativity: z.number().min(0.1).max(1).default(0.5),
      left: z.number().int().min(0).max(2000).default(0),
      right: z.number().int().min(0).max(2000).default(0),
      up: z.number().int().min(0).max(2000).default(0),
      down: z.number().int().min(0).max(2000).default(0),
    })
    .strict()
    .refine(
      (value) => value.left + value.right + value.up + value.down > 0,
      'At least one outpaint direction must be non-zero',
    ),
  'service/search-recolor': styledPromptImage
    .extend({
      select_prompt: promptSchema,
      grow_mask: z.number().int().min(0).max(20).default(5),
    })
    .strict(),
  'service/search-replace': styledPromptImage
    .extend({
      search_prompt: promptSchema,
      grow_mask: z.number().int().min(0).max(20).default(5),
    })
    .strict(),
  'service/erase': z
    .object({
      image,
      ...maskOptional,
      seed: standardSeedSchema.default(0),
      output_format: outputFormatSchema.default('png'),
    })
    .strict(),
  'service/remove-background': z
    .object({ image, output_format: outputFormatSchema.default('png') })
    .strict(),
} satisfies Record<CanonicalCapabilityId, z.ZodType>;

export type Capability = CapabilityDescriptor & {
  readonly requestSchema: z.ZodType;
  readonly responseSchema: typeof stabilityResponseSchema;
};

export const capabilities: readonly Capability[] = capabilityCatalog.map((descriptor) => ({
  ...descriptor,
  requestSchema: requestSchemas[descriptor.canonicalId],
  responseSchema: stabilityResponseSchema,
}));

export function getCapability(canonicalId: string): Capability {
  if (!isCanonicalCapabilityId(canonicalId)) {
    throw new Error(`Unknown capability: ${canonicalId}`);
  }
  const capability = capabilities.find((candidate) => candidate.canonicalId === canonicalId);
  if (!capability) throw new Error(`Unknown capability: ${canonicalId}`);
  return capability;
}
