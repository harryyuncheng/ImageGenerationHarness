import { describe, expect, it } from 'vitest';
import { capabilitiesResponseSchema } from '@harness/contracts';
import {
  capabilities,
  capabilityCatalog,
  CAPABILITY_REGISTRY_VERSION,
  coreRequestSchema,
  getCapability,
  stabilityResponseSchema,
} from '../src/index.js';

describe('capability registry goldens', () => {
  it('derives every public descriptor from the browser-safe catalog', () => {
    const publicCapabilities = capabilities.map(
      ({ requestSchema, responseSchema, ...descriptor }) => {
        void requestSchema;
        void responseSchema;
        return descriptor;
      },
    );
    expect(publicCapabilities).toEqual(capabilityCatalog);
    expect(
      capabilitiesResponseSchema.parse({
        registryVersion: CAPABILITY_REGISTRY_VERSION,
        targets: capabilityCatalog,
      }).targets,
    ).toEqual(capabilityCatalog);
  });

  it('pins all direct and Geo target IDs', () => {
    expect(capabilities.map((c) => [c.canonicalId, c.invocation])).toMatchInlineSnapshot(`
      [
        [
          "generation/core",
          {
            "kind": "foundation-model",
            "modelId": "stability.stable-image-core-v1:1",
          },
        ],
        [
          "generation/ultra",
          {
            "kind": "foundation-model",
            "modelId": "stability.stable-image-ultra-v1:1",
          },
        ],
        [
          "generation/sd3.5-large",
          {
            "kind": "foundation-model",
            "modelId": "stability.sd3-5-large-v1:0",
          },
        ],
        [
          "service/control-sketch",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-image-control-sketch-v1:0",
          },
        ],
        [
          "service/control-structure",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-image-control-structure-v1:0",
          },
        ],
        [
          "service/style-guide",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-image-style-guide-v1:0",
          },
        ],
        [
          "service/style-transfer",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-style-transfer-v1:0",
          },
        ],
        [
          "service/creative-upscale",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-creative-upscale-v1:0",
          },
        ],
        [
          "service/conservative-upscale",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-conservative-upscale-v1:0",
          },
        ],
        [
          "service/fast-upscale",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-fast-upscale-v1:0",
          },
        ],
        [
          "service/inpaint",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-image-inpaint-v1:0",
          },
        ],
        [
          "service/outpaint",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-outpaint-v1:0",
          },
        ],
        [
          "service/search-recolor",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-image-search-recolor-v1:0",
          },
        ],
        [
          "service/search-replace",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-image-search-replace-v1:0",
          },
        ],
        [
          "service/erase",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-image-erase-object-v1:0",
          },
        ],
        [
          "service/remove-background",
          {
            "kind": "geo-inference-profile",
            "profileId": "us.stability.stable-image-remove-background-v1:0",
          },
        ],
      ]
    `);
  });

  it('rejects unknown controls and applies documented defaults', () => {
    expect(coreRequestSchema.parse({ prompt: 'p' })).toEqual({
      prompt: 'p',
      aspect_ratio: '1:1',
      seed: 0,
      output_format: 'png',
    });
    expect(() => coreRequestSchema.parse({ prompt: 'p', cfg_scale: 7 })).toThrow();
  });

  it('enforces foundation-model-specific formats and seed ranges', () => {
    expect(
      coreRequestSchema.parse({ prompt: 'p', output_format: 'jpeg', seed: 4294967295 }),
    ).toMatchObject({ output_format: 'jpeg', seed: 4294967295 });
    expect(() => coreRequestSchema.parse({ prompt: 'p', output_format: 'webp' })).toThrow();
    expect(
      getCapability('generation/sd3.5-large').requestSchema.parse({
        prompt: 'p',
        output_format: 'webp',
        seed: 4294967294,
      }),
    ).toMatchObject({ output_format: 'webp', seed: 4294967294 });
    expect(() =>
      getCapability('generation/sd3.5-large').requestSchema.parse({
        prompt: 'p',
        seed: 4294967295,
      }),
    ).toThrow();
  });

  it('accepts every documented service control and rejects cross-service fields', () => {
    expect(
      getCapability('service/creative-upscale').requestSchema.parse({
        prompt: 'p',
        image: 'AA==',
        style_preset: 'tile-texture',
      }),
    ).toMatchObject({ style_preset: 'tile-texture', creativity: 0.3 });
    expect(() =>
      getCapability('service/conservative-upscale').requestSchema.parse({
        prompt: 'p',
        image: 'AA==',
        style_preset: 'photographic',
      }),
    ).toThrow();
    expect(
      getCapability('service/style-transfer').requestSchema.parse({
        init_image: 'AA==',
        style_image: 'AA==',
        composition_fidelity: 0.25,
        style_strength: 0.5,
        change_strength: 0.75,
      }),
    ).toMatchObject({
      composition_fidelity: 0.25,
      style_strength: 0.5,
      change_strength: 0.75,
    });
    expect(() =>
      getCapability('service/style-transfer').requestSchema.parse({
        init_image: 'AA==',
        style_image: 'AA==',
        style_preset: 'anime',
      }),
    ).toThrow();
    expect(() =>
      getCapability('service/outpaint').requestSchema.parse({
        image: 'AA==',
        left: 1,
        negative_prompt: 'noise',
      }),
    ).toThrow();
    expect(() =>
      getCapability('service/fast-upscale').requestSchema.parse({ image: 'AA==', seed: 1 }),
    ).toThrow();
  });

  it('enforces outpaint directions and filtered response shape', () => {
    expect(() => getCapability('service/outpaint').requestSchema.parse({ image: 'AA==' })).toThrow(
      /direction/,
    );
    expect(stabilityResponseSchema.parse({ finish_reasons: ['Filter reason: prompt'] })).toEqual({
      finish_reasons: ['Filter reason: prompt'],
    });
    expect(() => stabilityResponseSchema.parse({ finish_reasons: [null] })).toThrow(/image bytes/);
  });
});
