import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { atomicWriteAbsolute, cleanupTargetTemps, isMissing } from './atomic-files.js';

export const MAX_RECENT_REPOSITORIES = 10;

const applicationConfigSchema = z
  .object({
    activeRoot: z.string().nullable(),
    recentRoots: z.array(z.string()).max(MAX_RECENT_REPOSITORIES),
  })
  .strict();

export type ApplicationConfig = z.infer<typeof applicationConfigSchema>;

export class ApplicationConfigStore {
  readonly configPath: string;

  constructor(
    configPath = join(
      homedir(),
      'Library',
      'Application Support',
      'ImageGenerationHarness',
      'config.json',
    ),
  ) {
    this.configPath = resolve(configPath);
  }

  async load(): Promise<ApplicationConfig> {
    await cleanupTargetTemps(dirname(this.configPath), basename(this.configPath));
    try {
      const contents = await readFile(this.configPath, 'utf8');
      return applicationConfigSchema.parse(JSON.parse(contents));
    } catch (error) {
      if (isMissing(error)) return { activeRoot: null, recentRoots: [] };
      throw error;
    }
  }

  async save(config: ApplicationConfig): Promise<void> {
    const validated = applicationConfigSchema.parse(config);
    const bytes = new TextEncoder().encode(`${JSON.stringify(validated, null, 2)}\n`);
    await atomicWriteAbsolute(this.configPath, bytes, 0o600);
  }
}
