import { describe, expect, it } from 'vitest';
import {
  buildGenerationRequest,
  buildGenerationSubmission,
  defaultCapabilities,
  defaultSettings,
  makeSeedPlan,
  requiresPrompt,
  selectCreateGreeting,
  stylePresets,
  supportsPrompt,
  type Attachment,
  type Capability,
  type Destination,
} from './studio.js';

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

describe('create greeting', () => {
  function greetingPoolAt(hour: number): string[] {
    const greetings = new Set<string>();
    for (let index = 0; index < 1000; index += 1) {
      greetings.add(selectCreateGreeting(new Date(2026, 7, 7, hour), () => index / 1000));
    }
    return [...greetings];
  }

  it('selects once from the local time and day-specific greeting pool', () => {
    expect(selectCreateGreeting(new Date(2026, 7, 7, 10), () => 0.999)).toBe(
      'A final flourish for Friday',
    );
    expect(selectCreateGreeting(new Date(2026, 7, 8, 10), () => 0.999)).toBe(
      'A slower morning, a brighter canvas',
    );
    expect(selectCreateGreeting(new Date(2026, 7, 7, 15), () => 0)).toBe(
      'Afternoon, Harry. What are you imagining?',
    );
    expect(selectCreateGreeting(new Date(2026, 7, 7, 23), () => 0)).toBe(
      'A late-night canvas, ready when you are',
    );
  });

  it('keeps time-specific copy within its local-time window', () => {
    const morningGreetings = [
      'Morning, Harry. What shall we picture?',
      'A bright morning for making something new',
      'Morning light, blank canvas',
      'A new day for a new perspective',
      'Fresh ideas look good in the morning',
    ];
    const afternoonGreetings = [
      'Afternoon, Harry. What are you imagining?',
      'A little daylight, a lot of possibility',
      'The afternoon is open for invention',
    ];
    const eveningGreetings = [
      'Evening, Harry. What shall we create?',
      'The evening has room for another idea',
      'What are you picturing tonight?',
      'The day can end. The ideas can stay.',
      'An evening canvas, waiting',
      'A quiet evening for vivid thinking',
    ];
    const nightGreetings = [
      'A quiet hour for something vivid',
      'The imagination stays bright after dark',
      'Night shift, creative edition',
      'Some ideas only arrive after dark',
      'The quiet hours suit bold ideas',
      'After dark, imagination takes the lead',
      'The world is quiet. The canvas is open.',
      'Moonlight makes room for unusual ideas',
      'Night settles in, ideas take shape',
    ];
    const lateNightGreetings = [
      'A late-night canvas, ready when you are',
      'Late hours, vivid ideas',
      "Let's follow that late-night thought",
    ];

    expect(greetingPoolAt(5)).not.toEqual(expect.arrayContaining(morningGreetings));
    expect(greetingPoolAt(6)).toEqual(expect.arrayContaining(morningGreetings));
    expect(greetingPoolAt(12)).not.toEqual(expect.arrayContaining(morningGreetings));
    expect(greetingPoolAt(12)).toEqual(expect.arrayContaining(afternoonGreetings));
    expect(greetingPoolAt(17)).not.toEqual(expect.arrayContaining(afternoonGreetings));
    expect(greetingPoolAt(17)).toEqual(expect.arrayContaining(eveningGreetings));
    expect(greetingPoolAt(20)).not.toEqual(expect.arrayContaining(nightGreetings));
    expect(greetingPoolAt(20)).not.toEqual(expect.arrayContaining(lateNightGreetings));
    expect(greetingPoolAt(21)).not.toEqual(expect.arrayContaining(eveningGreetings));
    expect(greetingPoolAt(21)).toEqual(expect.arrayContaining(nightGreetings));
    expect(greetingPoolAt(22)).not.toEqual(expect.arrayContaining(lateNightGreetings));
    expect(greetingPoolAt(23)).toEqual(expect.arrayContaining(lateNightGreetings));
    expect(greetingPoolAt(0)).not.toContain('Night settles in, ideas take shape');
    expect(greetingPoolAt(4)).not.toEqual(expect.arrayContaining(lateNightGreetings));
    expect(greetingPoolAt(6)).not.toEqual(expect.arrayContaining(nightGreetings));
    expect(greetingPoolAt(6)).not.toEqual(expect.arrayContaining(lateNightGreetings));
  });
});

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
