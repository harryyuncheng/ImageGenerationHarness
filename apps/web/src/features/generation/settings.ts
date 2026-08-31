import { STYLE_PRESETS, type AspectRatio, type ImageQuality } from '@harness/contracts';

export interface GenerationSettings {
  targetId: string;
  aspectRatio: AspectRatio;
  outputFormat: 'png' | 'jpeg' | 'webp';
  outputCount: number;
  negativePrompt: string;
  searchPrompt: string;
  selectPrompt: string;
  stylePreset: string;
  quality: ImageQuality;
  background: 'auto' | 'transparent';
  inputFidelity: 'low' | 'high';
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

export type UpdateSettings = <K extends keyof GenerationSettings>(
  key: K,
  value: GenerationSettings[K],
) => void;

export const defaultSettings: GenerationSettings = {
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
] as const satisfies readonly { value: AspectRatio; label: string; shape: string }[];

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

export const outputCounts = [1, 2, 3, 4] as const;

export const outputFormats = [
  'png',
  'jpeg',
  'webp',
] as const satisfies readonly GenerationSettings['outputFormat'][];

export const outputFormatDescriptions = {
  png: 'Lossless, keeps transparency',
  jpeg: 'Smallest files, no transparency',
  webp: 'Lossless and compact',
} as const satisfies Record<GenerationSettings['outputFormat'], string>;

export const seedStrategies = [
  { value: 'random', label: 'Random', description: 'Use a fresh random seed for each image.' },
  { value: 'fixed', label: 'Fixed', description: 'Reuse the same seed for every image.' },
  {
    value: 'sequential',
    label: 'Sequential',
    description: 'Increase the seed by one for each image.',
  },
] as const satisfies readonly {
  value: GenerationSettings['seedMode'];
  label: string;
  description: string;
}[];

export const outpaintDirections = [
  { label: 'Left', key: 'outpaintLeft' },
  { label: 'Right', key: 'outpaintRight' },
  { label: 'Up', key: 'outpaintUp' },
  { label: 'Down', key: 'outpaintDown' },
] as const;
