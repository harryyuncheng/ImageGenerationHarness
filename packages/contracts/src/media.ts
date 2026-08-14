import { z } from 'zod';

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const OUTPUT_FORMATS = ['jpeg', 'png', 'webp'] as const;
const ASPECT_RATIOS = ['16:9', '1:1', '21:9', '2:3', '3:2', '4:5', '5:4', '9:16', '9:21'] as const;
export const STYLE_PRESETS = [
  '3d-model',
  'analog-film',
  'anime',
  'cinematic',
  'comic-book',
  'digital-art',
  'enhance',
  'fantasy-art',
  'isometric',
  'line-art',
  'low-poly',
  'modeling-compound',
  'neon-punk',
  'origami',
  'photographic',
  'pixel-art',
  'tile-texture',
] as const;

export const mediaTypeSchema = z.enum(MEDIA_TYPES);
export const outputFormatSchema = z.enum(OUTPUT_FORMATS);
export const aspectRatioSchema = z.enum(ASPECT_RATIOS);
export const stylePresetSchema = z.enum(STYLE_PRESETS);

export type MediaType = z.infer<typeof mediaTypeSchema>;
export type OutputFormat = z.infer<typeof outputFormatSchema>;

export function isMediaType(value: string): value is MediaType {
  return MEDIA_TYPES.some((mediaType) => mediaType === value);
}
