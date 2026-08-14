import { describe, expect, it } from 'vitest';
import type { Attachment } from '../../shared/types/attachments.js';
import type { Capability, Destination } from '../../shared/types/domain.js';
import { defaultCapabilities, requiresPrompt, supportsPrompt } from './capabilities.js';
import { buildGenerationRequest, buildGenerationSubmission, makeSeedPlan } from './request.js';
import { defaultSettings, stylePresets } from './settings.js';

function capability(canonicalId: string): Capability {
  const match = defaultCapabilities.find((candidate) => candidate.canonicalId === canonicalId);
  if (!match) throw new Error(`Missing test capability: ${canonicalId}`);
  return match;
}

const source: Attachment = {
  source: 'upload',
  id: 'source',
  name: 'source.png',
  mediaType: 'image/png',
  byteLength: 4,
  data: 'AAAA',
  previewUrl: 'blob:source',
};
const reference: Attachment = {
  ...source,
  id: 'reference',
  name: 'reference.png',
  data: 'BBBB',
  previewUrl: 'blob:reference',
};

describe('Bedrock request builder', () => {
  it('exposes every documented style preset', () => {
    expect(stylePresets.map(([value]) => value).filter((value) => value !== 'none')).toHaveLength(
      17,
    );
    expect(stylePresets.map(([value]) => value)).toEqual(
      expect.arrayContaining(['enhance', 'modeling-compound', 'tile-texture']),
    );
  });

  it('sends all independent Style Transfer controls without unsupported style presets', () => {
    const request = buildGenerationRequest(
      capability('service/style-transfer'),
      'subtle lighting',
      {
        ...defaultSettings,
        negativePrompt: 'blur',
        stylePreset: 'anime',
        compositionFidelity: 0.2,
        styleStrength: 0.45,
        changeStrength: 0.8,
      },
      [source, reference],
    );
    expect(request).toMatchObject({
      init_image: 'AAAA',
      style_image: 'BBBB',
      prompt: 'subtle lighting',
      negative_prompt: 'blur',
      composition_fidelity: 0.2,
      style_strength: 0.45,
      change_strength: 0.8,
    });
    expect(request).not.toHaveProperty('style_preset');
  });

  it('omits controls unsupported by Outpaint while retaining its optional prompt and style', () => {
    const target = capability('service/outpaint');
    const request = buildGenerationRequest(
      target,
      'continue the forest',
      { ...defaultSettings, negativePrompt: 'buildings', stylePreset: 'photographic' },
      [source],
    );
    expect(request).toMatchObject({
      prompt: 'continue the forest',
      style_preset: 'photographic',
      creativity: defaultSettings.creativity,
    });
    expect(request).not.toHaveProperty('negative_prompt');
    expect(supportsPrompt(target)).toBe(true);
    expect(requiresPrompt(target)).toBe(false);
  });

  it('uses provider-random planning for services without a seed field', () => {
    const target = capability('service/fast-upscale');
    const request = buildGenerationRequest(
      target,
      '',
      { ...defaultSettings, seedMode: 'fixed', seed: 123 },
      [source],
    );
    expect(request).toEqual({ image: 'AAAA', output_format: 'png' });
    expect(makeSeedPlan({ ...defaultSettings, seedMode: 'fixed', seed: 123 }, target)).toEqual({
      strategy: 'provider-random',
    });
  });

  it('uses an opaque server-resolved repository image URI for a library reference', () => {
    const target = capability('generation/ultra');
    const libraryReference: Attachment = {
      source: 'library',
      id: 'library-image',
      folderId: '83cbfc7d-bdb4-4f8c-adde-ed506a01e125',
      imageId: 'c66a089f-d441-4368-9eef-bc12d424719f',
      name: 'editorial-lighting.jpg',
      mediaType: 'image/jpeg',
      byteLength: 1024,
      previewUrl: '/api/reference-image',
    };
    expect(
      buildGenerationRequest(target, 'portrait', defaultSettings, [libraryReference]),
    ).toMatchObject({
      mode: 'image-to-image',
      image: 'repo-image://c66a089f-d441-4368-9eef-bc12d424719f',
    });
  });

  it('keeps the exact user prompt and never injects project or asset descriptions', () => {
    const destination: Destination = {
      kind: 'project-asset',
      projectId: '83cbfc7d-bdb4-4f8c-adde-ed506a01e125',
      projectAssetId: 'c66a089f-d441-4368-9eef-bc12d424719f',
    };
    const organizationalDescriptions = {
      projectDescription: 'Warm editorial campaign with vintage cues',
      assetDescription: 'The blue ceramic hero object',
    };
    const submission = buildGenerationSubmission(
      capability('generation/core'),
      '  exact prompt with deliberate whitespace  ',
      defaultSettings,
      [],
      destination,
    );

    expect(submission.request).toMatchObject({
      prompt: '  exact prompt with deliberate whitespace  ',
    });
    expect(JSON.stringify(submission.request)).not.toContain(
      organizationalDescriptions.projectDescription,
    );
    expect(JSON.stringify(submission.request)).not.toContain(
      organizationalDescriptions.assetDescription,
    );
    expect(submission.destination).toEqual(destination);
  });

  it('normalizes unsupported Core WebP output and preserves its full seed range', () => {
    const target = capability('generation/core');
    const settings = {
      ...defaultSettings,
      outputFormat: 'webp' as const,
      seedMode: 'fixed' as const,
      seed: 4294967295,
    };
    expect(buildGenerationRequest(target, 'p', settings, [])).toMatchObject({
      output_format: 'png',
      seed: 4294967295,
    });
    expect(makeSeedPlan(settings, target)).toEqual({
      strategy: 'fixed-repeat',
      seed: 4294967295,
    });
  });
});
