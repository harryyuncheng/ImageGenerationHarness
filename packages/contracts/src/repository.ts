import { z } from 'zod';

import { nonEmptyStringSchema, uuidSchema } from './common.js';

const recentRepositorySchema = z
  .object({
    repositoryId: uuidSchema,
    name: nonEmptyStringSchema.max(120),
  })
  .strict();

export const repositoryStatusSchema = z
  .object({
    active: recentRepositorySchema.nullable(),
    recent: z.array(recentRepositorySchema).max(10),
  })
  .strict();

export const repositoryParamsSchema = z.object({ repositoryId: uuidSchema }).strict();

export type RepositoryStatus = z.infer<typeof repositoryStatusSchema>;
