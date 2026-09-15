import { z } from 'zod';
import {
  MAX_GPT_IMAGE_INPUTS,
  MAX_IMAGE_BYTES,
  MAX_REQUEST_IMAGES,
  UINT32_MAX,
  nonEmptyStringSchema,
  uuidSchema,
} from './common.js';
import {
  aspectRatioSchema,
  imageQualitySchema,
  mediaTypeSchema,
  outputFormatSchema,
  stylePresetSchema,
} from './media.js';

export const generationSettingsSchema = z
  .object({
    targetId: nonEmptyStringSchema,
    aspectRatio: aspectRatioSchema,
    outputFormat: outputFormatSchema,
    outputCount: z.number().int().min(1).max(MAX_REQUEST_IMAGES),
    negativePrompt: z.string().max(10_000),
    searchPrompt: z.string().max(10_000),
    selectPrompt: z.string().max(10_000),
    stylePreset: z.union([z.literal(''), stylePresetSchema]),
    quality: imageQualitySchema,
    background: z.enum(['auto', 'transparent']),
    inputFidelity: z.enum(['low', 'high']),
    seedMode: z.enum(['random', 'fixed', 'sequential']),
    seed: z.number().int().min(0).max(UINT32_MAX),
    strength: z.number().min(0).max(1),
    controlStrength: z.number().min(0).max(1),
    creativity: z.number().min(0).max(1),
    fidelity: z.number().min(0).max(1),
    compositionFidelity: z.number().min(0).max(1),
    styleStrength: z.number().min(0).max(1),
    changeStrength: z.number().min(0).max(1),
    growMask: z.number().int().min(0).max(20),
    outpaintLeft: z.number().int().min(0).max(2000),
    outpaintRight: z.number().int().min(0).max(2000),
    outpaintUp: z.number().int().min(0).max(2000),
    outpaintDown: z.number().int().min(0).max(2000),
  })
  .strict();

export type GenerationSettings = z.infer<typeof generationSettingsSchema>;

export const defaultGenerationSettings: GenerationSettings = {
  targetId: 'generation/gpt-image-2',
  aspectRatio: '1:1',
  outputFormat: 'png',
  outputCount: 1,
  negativePrompt: '',
  searchPrompt: '',
  selectPrompt: '',
  stylePreset: '',
  quality: 'high',
  background: 'auto',
  inputFidelity: 'low',
  seedMode: 'random',
  seed: 0,
  strength: 0.65,
  controlStrength: 0.7,
  creativity: 0.3,
  fidelity: 0.5,
  compositionFidelity: 0.9,
  styleStrength: 1,
  changeStrength: 0.9,
  growMask: 5,
  outpaintLeft: 256,
  outpaintRight: 256,
  outpaintUp: 0,
  outpaintDown: 0,
};

export const generationStyleGuideSchema = z
  .object({ folderId: uuidSchema, name: nonEmptyStringSchema.max(80) })
  .strict();

const generationSetupSourceSchema = z
  .object({ kind: z.enum(['images', 'runs']), id: uuidSchema })
  .strict();
export const generationInputIndexSchema = z.coerce.number().int().min(0).max(MAX_GPT_IMAGE_INPUTS);
export const generationInputReferenceSchema = generationSetupSourceSchema
  .extend({ inputIndex: generationInputIndexSchema })
  .strict();

export const generationSetupSchema = z
  .object({
    prompt: z.string().max(10_000),
    settings: generationSettingsSchema,
    inputs: z
      .array(
        z
          .object({
            imageId: uuidSchema,
            role: z.enum(['source', 'references', 'mask']),
            name: nonEmptyStringSchema.max(160),
            mediaType: mediaTypeSchema,
            byteLength: z.number().int().positive().max(MAX_IMAGE_BYTES),
            styleGuide: generationStyleGuideSchema.optional(),
            maskEncoding: z.enum(['alpha', 'luminance']).optional(),
          })
          .strict(),
      )
      .max(MAX_GPT_IMAGE_INPUTS + 1),
  })
  .strict()
  .superRefine(({ inputs }, context) => {
    const sources = inputs.filter((input) => input.role === 'source');
    const masks = inputs.filter((input) => input.role === 'mask');
    if (sources.length > 1 || masks.length > 1 || (masks.length > 0 && sources.length !== 1)) {
      context.addIssue({ code: 'custom', message: 'Invalid source and mask configuration.' });
    }
  });

export type GenerationStyleGuide = z.infer<typeof generationStyleGuideSchema>;
export type GenerationSetupSource = z.infer<typeof generationSetupSourceSchema>;
export type GenerationInputReference = z.infer<typeof generationInputReferenceSchema>;
export type GenerationSetup = z.infer<typeof generationSetupSchema>;
