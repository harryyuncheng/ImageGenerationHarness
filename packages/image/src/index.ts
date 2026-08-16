import { createHash } from 'node:crypto';
import { MAX_IMAGE_BYTES, type MediaType, type OutputFormat } from '@harness/contracts';
import sharp from 'sharp';

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function inspectImage(bytes: Uint8Array) {
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  if (!metadata.width || !metadata.height)
    throw new Error('Image dimensions and format are required');
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    hasAlpha: metadata.hasAlpha,
  };
}

function decodeCanonicalBase64(
  value: string,
  options: { maxBytes?: number; label?: string } = {},
): Uint8Array {
  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES;
  const label = options.label ?? 'Image data';
  if (value.length === 0 || value.length > Math.ceil(maxBytes / 3) * 4 || value.length % 4 !== 0) {
    throw new Error(`${label} is not valid base64`);
  }
  const decoded = Buffer.from(value, 'base64');
  if (
    decoded.byteLength === 0 ||
    decoded.byteLength > maxBytes ||
    decoded.toString('base64') !== value
  ) {
    throw new Error(`${label} is not valid base64`);
  }
  return Uint8Array.from(decoded);
}

function mediaTypeFromImageFormat(format: string | undefined): MediaType | undefined {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  if (format === 'webp') return 'image/webp';
  return undefined;
}

export function mediaTypeForOutputFormat(format: OutputFormat): MediaType {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  return 'image/png';
}

export function outputFileForMediaType(mediaType: MediaType): {
  format: OutputFormat;
  extension: 'jpg' | 'png' | 'webp';
} {
  if (mediaType === 'image/jpeg') return { format: 'jpeg', extension: 'jpg' };
  if (mediaType === 'image/webp') return { format: 'webp', extension: 'webp' };
  return { format: 'png', extension: 'png' };
}

export interface CharacterizedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  mediaType: MediaType;
  format: OutputFormat;
  extension: 'jpg' | 'png' | 'webp';
  byteLength: number;
  sha256: string;
}

export async function characterizeImageData(
  value: string,
  options: { maxBytes?: number; label?: string } = {},
): Promise<CharacterizedImage> {
  const label = options.label ?? 'Image data';
  const bytes = decodeCanonicalBase64(value, options);
  const inspected = await inspectImage(bytes);
  const mediaType = mediaTypeFromImageFormat(inspected.format);
  if (!mediaType) throw new Error(`${label} is not a supported PNG, JPEG, or WebP image`);
  const output = outputFileForMediaType(mediaType);
  return {
    bytes,
    width: inspected.width,
    height: inspected.height,
    mediaType,
    ...output,
    byteLength: bytes.byteLength,
    sha256: sha256Hex(bytes),
  };
}

export function imageBytesMatch(
  bytes: Uint8Array,
  expectedSha256: string,
  expectedByteLength?: number,
): boolean {
  return (
    (expectedByteLength === undefined || bytes.byteLength === expectedByteLength) &&
    sha256Hex(bytes) === expectedSha256
  );
}

export function imageSidecarPath(imagePath: string): string {
  const extensionIndex = imagePath.lastIndexOf('.');
  if (extensionIndex <= imagePath.lastIndexOf('/')) {
    throw new Error('Image path must include a file extension');
  }
  return `${imagePath.slice(0, extensionIndex)}.image.json`;
}
