import { z } from 'zod';

/**
 * Addressable overlay state. Each field is caught rather than validated strictly so
 * a hand-edited or stale link degrades to the underlying view instead of failing.
 */
export const studioSearchSchema = z.object({
  image: z.uuid().optional().catch(undefined),
  run: z.uuid().optional().catch(undefined),
});

export type StudioSearch = z.infer<typeof studioSearchSchema>;
