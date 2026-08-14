import { z } from 'zod';

import { nonEmptyStringSchema, timestampSchema, uuidSchema } from './common.js';

const projectDtoFields = {
  name: nonEmptyStringSchema.max(120),
  description: z.string().max(4000),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.optional(),
};

export const projectDtoSchema = z
  .object({
    projectId: uuidSchema,
    ...projectDtoFields,
  })
  .strict();
export const projectAssetDtoSchema = z
  .object({
    assetId: uuidSchema,
    projectId: uuidSchema,
    ...projectDtoFields,
  })
  .strict();
export const projectsResponseSchema = z.object({ projects: z.array(projectDtoSchema) }).strict();
export const projectDetailResponseSchema = z
  .object({
    project: projectDtoSchema,
    assets: z.array(projectAssetDtoSchema),
  })
  .strict();
export const projectAssetsResponseSchema = z
  .object({ assets: z.array(projectAssetDtoSchema) })
  .strict();

export const projectCreateRequestSchema = z
  .object({
    name: nonEmptyStringSchema.max(120),
    description: z.string().max(4000).optional(),
  })
  .strict();
export const projectUpdateRequestSchema = z
  .object({
    name: nonEmptyStringSchema.max(120).optional(),
    description: z.string().max(4000).optional(),
  })
  .strict()
  .refine((input) => input.name !== undefined || input.description !== undefined, {
    message: 'At least one project field must be updated.',
  });

export const projectParamsSchema = z.object({ projectId: uuidSchema }).strict();
export const projectAssetParamsSchema = z
  .object({ projectId: uuidSchema, assetId: uuidSchema })
  .strict();
export const includeArchivedQuerySchema = z
  .object({ includeArchived: z.enum(['true', 'false']).optional() })
  .strict();

export type ProjectDto = z.infer<typeof projectDtoSchema>;
export type ProjectAssetDto = z.infer<typeof projectAssetDtoSchema>;
export type ProjectsResponse = z.infer<typeof projectsResponseSchema>;
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;
export type ProjectCreateRequest = z.infer<typeof projectCreateRequestSchema>;
export type ProjectUpdateRequest = z.infer<typeof projectUpdateRequestSchema>;
