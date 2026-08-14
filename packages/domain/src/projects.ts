import {
  SCHEMA_VERSION,
  nonEmptyStringSchema,
  repositoryRelativePathSchema,
  timestampSchema,
  uuidSchema,
} from '@harness/contracts';
import { z } from 'zod';

const organizationalRecordFields = {
  schemaVersion: z.literal(SCHEMA_VERSION),
  name: nonEmptyStringSchema.max(120),
  description: z.string().max(4000),
  directory: repositoryRelativePathSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.optional(),
};

export const projectSchema = z
  .object({
    projectId: uuidSchema,
    ...organizationalRecordFields,
  })
  .strict();

export const projectAssetSchema = z
  .object({
    assetId: uuidSchema,
    projectId: uuidSchema,
    ...organizationalRecordFields,
  })
  .strict();

export type Project = z.infer<typeof projectSchema>;
export type ProjectAsset = z.infer<typeof projectAssetSchema>;
