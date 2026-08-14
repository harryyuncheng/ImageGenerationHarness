import {
  capabilityCatalog,
  isCanonicalCapabilityId,
  type CanonicalCapabilityId,
} from '@harness/capabilities/catalog';
import {
  STYLE_PRESETS,
  type CapabilitiesResponse,
  type CapabilityDescriptor,
  type CreateRunRequest,
  type Destination,
  type GalleryImageDto,
  type GalleryResponse,
  type MediaType,
  type ProjectAssetDto,
  type ProjectDetailResponse,
  type ProjectDto,
  type ProjectsResponse,
  type ReferenceFolderDto,
  type ReferenceImageDto,
  type ReferenceLibraryResponse,
  type RequestParameter,
  type RepositoryStatus,
  type RunStatus as DurableRunStatus,
} from '@harness/contracts';

export type Capability = CapabilityDescriptor;
export type GalleryImage = GalleryImageDto;
export type Project = ProjectDto;
export type ProjectAsset = ProjectAssetDto;
export type ReferenceFolder = ReferenceFolderDto;
export type ReferenceImage = ReferenceImageDto;
type GenerationSubmission = CreateRunRequest;
export type {
  CapabilitiesResponse,
  Destination,
  GalleryResponse,
  ProjectDetailResponse,
  ProjectsResponse,
  ReferenceLibraryResponse,
  RepositoryStatus,
};

export type ThemePreference = 'light' | 'dark' | 'system';
export type StudioView =
  | 'create'
  | 'edit'
  | 'gallery'
  | 'references'
  | 'history'
  | 'presets';
export type RunStatus = DurableRunStatus | 'submitting';

interface AttachmentBase {
  id: string;
  name: string;
  mediaType: MediaType;
  byteLength: number;
  previewUrl: string;
}

export interface UploadAttachment extends AttachmentBase {
  source: 'upload';
  data: string;
}

interface LibraryAttachment extends AttachmentBase {
  source: 'library';
  folderId: string;
  imageId: string;
}

export type Attachment = UploadAttachment | LibraryAttachment;

export interface GenerationSettings {
  targetId: string;
  aspectRatio: string;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputCount: number;
  negativePrompt: string;
  searchPrompt: string;
  selectPrompt: string;
  stylePreset: string;
  seedMode: 'random' | 'fixed' | 'sequential';
  seed: number;
  strength: number;
  controlStrength: number;
  creativity: number;
  fidelity: number;
  compositionFidelity: number;
  styleStrength: number;
  changeStrength: number;
  growMask: number;
  outpaintLeft: number;
  outpaintRight: number;
  outpaintUp: number;
  outpaintDown: number;
}

export interface StudioRun {
  id: string;
  remoteId?: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  targetId: string;
  targetName: string;
  aspectRatio: string;
  outputCount: number;
  attachmentNames: string[];
  outputImageIds?: string[];
  destination: Destination;
  status: RunStatus;
  error?: string;
  favorite: boolean;
}

export const defaultSettings: GenerationSettings = {
  targetId: 'generation/sd3.5-large',
  aspectRatio: '1:1',
  outputFormat: 'png',
  outputCount: 1,
  negativePrompt: '',
  searchPrompt: '',
  selectPrompt: '',
  stylePreset: '',
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

export const defaultCapabilities: readonly Capability[] = capabilityCatalog;

export const aspectRatios = [
  { value: '1:1', label: 'Square', shape: 'square' },
  { value: '16:9', label: 'Landscape', shape: 'wide' },
  { value: '9:16', label: 'Portrait', shape: 'tall' },
  { value: '3:2', label: 'Photo', shape: 'photo' },
  { value: '2:3', label: 'Portrait photo', shape: 'portrait-photo' },
  { value: '21:9', label: 'Cinematic', shape: 'cinematic' },
  { value: '4:5', label: 'Social', shape: 'social' },
  { value: '5:4', label: 'Classic', shape: 'classic' },
  { value: '9:21', label: 'Story', shape: 'story' },
] as const;

const stylePresetLabels = {
  '3d-model': '3D model',
  'analog-film': 'Analog film',
  anime: 'Anime',
  cinematic: 'Cinematic',
  'comic-book': 'Comic book',
  'digital-art': 'Digital art',
  enhance: 'Enhance',
  'fantasy-art': 'Fantasy art',
  isometric: 'Isometric',
  'line-art': 'Line art',
  'low-poly': 'Low poly',
  'modeling-compound': 'Modeling compound',
  'neon-punk': 'Neon punk',
  origami: 'Origami',
  photographic: 'Photographic',
  'pixel-art': 'Pixel art',
  'tile-texture': 'Tile texture',
} as const satisfies Record<(typeof STYLE_PRESETS)[number], string>;

export const stylePresets: readonly (readonly [string, string])[] = [
  ['none', 'No preset'],
  ...STYLE_PRESETS.map((value) => [value, stylePresetLabels[value]] as const),
];

interface CreateGreeting {
  text: string;
  days?: readonly number[];
  period: keyof typeof createGreetingPeriods;
}

const createGreetingPeriods = {
  morning: [6, 12],
  afternoon: [12, 17],
  evening: [17, 21],
  night: [21, 6],
  nightfall: [21, 24],
  lateNight: [23, 4],
} as const satisfies Record<string, readonly [start: number, end: number]>;

const createGreetings: readonly CreateGreeting[] = [
  { text: 'Morning, Harry. What shall we picture?', period: 'morning' },
  { text: 'A fresh canvas for a fresh start', period: 'morning' },
  { text: 'A bright morning for making something new', period: 'morning' },
  { text: 'Where should your imagination wander first?', period: 'morning' },
  { text: 'Start with a spark, Harry', period: 'morning' },
  { text: 'Today has room for something new', period: 'morning' },
  { text: 'Morning light, blank canvas', period: 'morning' },
  { text: 'A new day for a new perspective', period: 'morning' },
  { text: 'Fresh ideas look good in the morning', period: 'morning' },
  { text: 'Begin anywhere, Harry', period: 'morning' },
  { text: 'New week, new canvas', days: [1], period: 'morning' },
  { text: 'A Tuesday made for fresh ideas', days: [2], period: 'morning' },
  { text: 'Midweek, with room to imagine', days: [3], period: 'morning' },
  { text: 'Thursday has something in mind', days: [4], period: 'morning' },
  { text: 'A final flourish for Friday', days: [5], period: 'morning' },
  { text: 'Weekend ideas, ready when you are', days: [0, 6], period: 'morning' },
  { text: 'A slower morning, a brighter canvas', days: [0, 6], period: 'morning' },
  { text: 'Afternoon, Harry. What are you imagining?', period: 'afternoon' },
  { text: 'Ready to turn a thought into an image?', period: 'afternoon' },
  { text: 'What should take shape next?', period: 'afternoon' },
  { text: 'The canvas is ready when you are', period: 'afternoon' },
  { text: 'A good hour to make something unexpected', period: 'afternoon' },
  { text: 'What would you like to bring into view?', period: 'afternoon' },
  { text: "Let's give that idea a shape", period: 'afternoon' },
  { text: 'Your next image starts here', period: 'afternoon' },
  { text: 'A little daylight, a lot of possibility', period: 'afternoon' },
  { text: 'Make space for a surprising idea', period: 'afternoon' },
  { text: 'The afternoon is open for invention', period: 'afternoon' },
  { text: 'Evening, Harry. What shall we create?', period: 'evening' },
  { text: 'The evening has room for another idea', period: 'evening' },
  { text: 'What are you picturing tonight?', period: 'evening' },
  { text: 'The canvas is yours, Harry', period: 'evening' },
  { text: 'The day can end. The ideas can stay.', period: 'evening' },
  { text: 'An evening canvas, waiting', period: 'evening' },
  { text: "Let's make something worth lingering on", period: 'evening' },
  { text: 'Soft light, strong ideas', period: 'evening' },
  { text: 'A quiet evening for vivid thinking', period: 'evening' },
  { text: 'Let the next image unfold', period: 'evening' },
  { text: 'A late-night canvas, ready when you are', period: 'lateNight' },
  { text: 'A quiet hour for something vivid', period: 'night' },
  { text: 'The imagination stays bright after dark', period: 'night' },
  { text: 'Night shift, creative edition', period: 'night' },
  { text: 'Some ideas only arrive after dark', period: 'night' },
  { text: 'The quiet hours suit bold ideas', period: 'night' },
  { text: 'Late hours, vivid ideas', period: 'lateNight' },
  { text: "Let's follow that late-night thought", period: 'lateNight' },
  { text: 'After dark, imagination takes the lead', period: 'night' },
  { text: 'The world is quiet. The canvas is open.', period: 'night' },
  { text: 'Moonlight makes room for unusual ideas', period: 'night' },
  { text: 'Night settles in, ideas take shape', period: 'nightfall' },
];

export function selectCreateGreeting(now: Date, random: () => number = Math.random): string {
  const hour = now.getHours();
  const day = now.getDay();
  const matches = createGreetings.filter((greeting) => {
    const [start, end] = createGreetingPeriods[greeting.period];
    const matchesHour = start < end ? hour >= start && hour < end : hour >= start || hour < end;
    return matchesHour && (greeting.days === undefined || greeting.days.includes(day));
  });
  const greeting = matches[Math.floor(random() * matches.length)];
  if (greeting === undefined) throw new Error('No create greeting matches the current time');
  return greeting.text;
}

export function capabilityLabel(capability: Capability): string {
  return capability.name;
}

export function needsImage(capability: Capability): boolean {
  return capability.modes.includes('image-service');
}

export function hasParameter(capability: Capability, parameter: RequestParameter): boolean {
  return capability.parameters.includes(parameter);
}

export function supportsPrompt(capability: Capability): boolean {
  return hasParameter(capability, 'prompt');
}

export function requiresPrompt(capability: Capability): boolean {
  return (
    supportsPrompt(capability) &&
    !['service/style-transfer', 'service/outpaint'].includes(capability.canonicalId)
  );
}

export function supportedOutputFormats(
  capability: Capability,
): readonly GenerationSettings['outputFormat'][] {
  return capability.outputFormats;
}

export function maximumSeed(capability: Capability): number | undefined {
  return capability.seedMaximum;
}

function effectiveSeed(capability: Capability, value: number): number {
  const maximum = maximumSeed(capability) ?? 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.trunc(value), maximum));
}

function assertNeverCapability(value: never): never {
  throw new Error(`Unhandled capability: ${String(value)}`);
}

export function buildGenerationRequest(
  capability: Capability,
  prompt: string,
  settings: GenerationSettings,
  attachments: Attachment[],
): Record<string, unknown> {
  const attachmentValue = (attachment: Attachment | undefined): string | undefined => {
    if (!attachment) return undefined;
    return attachment.source === 'upload'
      ? attachment.data
      : `repo-image://${attachment.imageId}`;
  };
  const image = attachmentValue(attachments[0]);
  const secondImage = attachmentValue(attachments[1]);
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

  if (!isCanonicalCapabilityId(capability.canonicalId)) {
    throw new Error(`Unsupported capability: ${capability.canonicalId}`);
  }
  const canonicalId: CanonicalCapabilityId = capability.canonicalId;
  if (canonicalId === 'generation/core') {
    return { prompt, aspect_ratio: settings.aspectRatio, ...optional };
  }
  if (
    canonicalId === 'generation/ultra' ||
    canonicalId === 'generation/sd3.5-large'
  ) {
    return image
      ? { mode: 'image-to-image', prompt, image, strength: settings.strength, ...optional }
      : { mode: 'text-to-image', prompt, aspect_ratio: settings.aspectRatio, ...optional };
  }
  if (!image) return {};

  switch (canonicalId) {
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
        style_image: secondImage ?? image,
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
        ...(secondImage ? { mask: secondImage } : {}),
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
        ...(secondImage ? { mask: secondImage } : {}),
        grow_mask: settings.growMask,
        ...serviceOptional,
      };
    case 'service/remove-background':
      return { image, ...serviceOptional };
    default:
      return assertNeverCapability(canonicalId);
  }
}

export function buildGenerationSubmission(
  capability: Capability,
  prompt: string,
  settings: GenerationSettings,
  attachments: Attachment[],
  destination: Destination,
): GenerationSubmission {
  return {
    targetId: capability.canonicalId,
    request: buildGenerationRequest(capability, prompt, settings, attachments),
    requestedJobCount: settings.outputCount,
    seedPlan: makeSeedPlan(settings, capability),
    destination,
  };
}

export function makeSeedPlan(settings: GenerationSettings, capability: Capability) {
  if (!hasParameter(capability, 'seed')) return { strategy: 'provider-random' as const };
  const seed = effectiveSeed(capability, settings.seed);
  if (settings.seedMode === 'fixed') return { strategy: 'fixed-repeat' as const, seed };
  if (settings.seedMode === 'sequential')
    return { strategy: 'sequential' as const, start: seed };
  return { strategy: 'harness-random' as const };
}
