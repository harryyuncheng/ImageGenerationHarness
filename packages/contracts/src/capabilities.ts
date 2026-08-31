import { z } from 'zod';

import { nonEmptyStringSchema } from './common.js';
import { outputFormatSchema } from './media.js';
import type { OutputFormat } from './media.js';
import { uint32Schema } from './runs.js';

const REQUEST_PARAMETERS = [
  'prompt',
  'negative_prompt',
  'aspect_ratio',
  'size',
  'quality',
  'background',
  'input_fidelity',
  'n',
  'mode',
  'image',
  'strength',
  'seed',
  'output_format',
  'style_preset',
  'control_strength',
  'fidelity',
  'init_image',
  'style_image',
  'composition_fidelity',
  'style_strength',
  'change_strength',
  'creativity',
  'mask',
  'grow_mask',
  'left',
  'right',
  'up',
  'down',
  'select_prompt',
  'search_prompt',
] as const;
const requestParameterSchema = z.enum(REQUEST_PARAMETERS);
const providerIdSchema = z.enum(['bedrock', 'azure-foundry']);
const capabilityCategorySchema = z.enum(['generation', 'control', 'upscale', 'edit']);
const capabilityModeSchema = z.enum(['text-to-image', 'image-to-image', 'image-service']);
const capabilityInvocationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('foundation-model'),
      modelId: nonEmptyStringSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('geo-inference-profile'),
      profileId: nonEmptyStringSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('azure-openai-deployment'),
      deploymentName: nonEmptyStringSchema,
      operation: z.enum(['generations', 'edits']),
    })
    .strict(),
]);
const capabilityDescriptorSchema = z
  .object({
    canonicalId: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    providerId: providerIdSchema,
    category: capabilityCategorySchema,
    invocation: capabilityInvocationSchema,
    modes: z.array(capabilityModeSchema).min(1),
    parameters: z.array(requestParameterSchema),
    outputFormats: z.array(outputFormatSchema).min(1),
    seedMaximum: uint32Schema.optional(),
  })
  .strict();

/** `configured` reports only whether server-side credentials resolved, never their values. */
const providerDescriptorSchema = z
  .object({
    providerId: providerIdSchema,
    name: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    setupHint: nonEmptyStringSchema,
    configured: z.boolean(),
  })
  .strict();

export const capabilitiesResponseSchema = z
  .object({
    registryVersion: nonEmptyStringSchema,
    providers: z.array(providerDescriptorSchema).min(1),
    targets: z.array(capabilityDescriptorSchema).min(1),
  })
  .strict();

type ParsedCapabilityDescriptor = z.infer<typeof capabilityDescriptorSchema>;
export type RequestParameter = z.infer<typeof requestParameterSchema>;
export type ProviderId = z.infer<typeof providerIdSchema>;
export type CapabilityCategory = z.infer<typeof capabilityCategorySchema>;
type CapabilityMode = z.infer<typeof capabilityModeSchema>;
export type CapabilityDescriptor = Readonly<
  Omit<ParsedCapabilityDescriptor, 'modes' | 'parameters' | 'outputFormats'> & {
    modes: readonly CapabilityMode[];
    parameters: readonly RequestParameter[];
    outputFormats: readonly OutputFormat[];
  }
>;
export type ProviderDescriptor = z.infer<typeof providerDescriptorSchema>;
export type CapabilitiesResponse = z.infer<typeof capabilitiesResponseSchema>;
