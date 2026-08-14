import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;
export const IMAGE_SIDECAR_SCHEMA_VERSION = 1 as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_REQUEST_IMAGES = 4;
export const UINT32_MAX = 4_294_967_295;
export const STABILITY_STANDARD_SEED_MAX = 4_294_967_294;

export const uuidSchema = z.uuid();
export const timestampSchema = z.iso.datetime({ offset: true });
export const nonEmptyStringSchema = z.string().trim().min(1);
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const repositoryRelativePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => !value.startsWith('/') && !value.startsWith('\\'), 'Path must be relative')
  .refine(
    (value) => !value.split(/[\\/]/u).some((part) => part === '' || part === '.' || part === '..'),
    'Path contains an unsafe segment',
  );
