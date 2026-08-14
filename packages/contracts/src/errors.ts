import { z } from 'zod';

export const apiErrorSchema = z
  .object({
    error: z.string(),
    issues: z
      .array(
        z
          .object({
            path: z.array(z.union([z.string(), z.number()])),
            message: z.string(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
