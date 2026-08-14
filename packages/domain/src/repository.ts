import {
  nonEmptyStringSchema,
  repositoryRelativePathSchema,
  timestampSchema,
  uuidSchema,
} from '@harness/contracts';
import { z } from 'zod';

export const REPOSITORY_SCHEMA_VERSION = 1 as const;

export const repositoryDescriptorSchema = z
  .object({
    schemaVersion: z.literal(REPOSITORY_SCHEMA_VERSION),
    repositoryId: uuidSchema,
    name: nonEmptyStringSchema.max(120),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export type RepositoryDescriptor = z.infer<typeof repositoryDescriptorSchema>;

export function assertSafeRepositoryRelativePath(value: string): string {
  return repositoryRelativePathSchema.parse(value);
}
