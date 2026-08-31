import { z } from 'zod';

export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const OUTPUT_FORMATS = ['jpeg', 'png', 'webp'] as const;
const ASPECT_RATIOS = ['16:9', '1:1', '21:9', '2:3', '3:2', '4:5', '5:4', '9:16', '9:21'] as const;
const IMAGE_SIZES = [
  '1360x768',
  '1024x1024',
  '1568x672',
  '832x1248',
  '1248x832',
  '896x1120',
  '1120x896',
  '768x1360',
  '672x1568',
] as const;
const IMAGE_QUALITIES = ['low', 'medium', 'high'] as const;
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
export const imageSizeSchema = z.enum(IMAGE_SIZES);
export const imageQualitySchema = z.enum(IMAGE_QUALITIES);
export const stylePresetSchema = z.enum(STYLE_PRESETS);

/**
 * Targets that take explicit pixel dimensions instead of a ratio still expose the shared
 * ratio picker. Every size keeps both edges on a multiple of 16 and stays inside the
 * documented pixel-count and 3:1 limits.
 */
export const IMAGE_SIZE_BY_ASPECT_RATIO = {
  '16:9': '1360x768',
  '1:1': '1024x1024',
  '21:9': '1568x672',
  '2:3': '832x1248',
  '3:2': '1248x832',
  '4:5': '896x1120',
  '5:4': '1120x896',
  '9:16': '768x1360',
  '9:21': '672x1568',
} as const satisfies Record<AspectRatio, (typeof IMAGE_SIZES)[number]>;

export type MediaType = z.infer<typeof mediaTypeSchema>;
export type OutputFormat = z.infer<typeof outputFormatSchema>;
export type AspectRatio = z.infer<typeof aspectRatioSchema>;
export type ImageQuality = z.infer<typeof imageQualitySchema>;

export function isMediaType(value: string): value is MediaType {
  return MEDIA_TYPES.some((mediaType) => mediaType === value);
}
