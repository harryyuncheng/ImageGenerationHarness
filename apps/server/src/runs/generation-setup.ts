import { getCapability } from '@harness/capabilities';
import {
  IMAGE_SIZE_BY_ASPECT_RATIO,
  defaultGenerationSettings,
  generationSettingsSchema,
  generationSetupSchema,
  type GeneratedImageInput,
  type GenerationInputReference,
  type GenerationSettings,
  type GenerationSetup,
  type GenerationSetupSource,
  type SeedPlan,
} from '@harness/contracts';
import { imageBytesMatch, outputFileForMediaType } from '@harness/image';
import { ApiError } from '../app/api-error.js';
import type { GeneratedImageStore } from '../images/generated-image-store.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import type { StyleGuideService } from '../style-guide/style-guide-service.js';
import type { RunStore } from './run-store.js';

const settingParameters = {
  aspectRatio: 'aspect_ratio',
  outputFormat: 'output_format',
  negativePrompt: 'negative_prompt',
  searchPrompt: 'search_prompt',
  selectPrompt: 'select_prompt',
  stylePreset: 'style_preset',
  quality: 'quality',
  background: 'background',
  inputFidelity: 'input_fidelity',
  strength: 'strength',
  controlStrength: 'control_strength',
  creativity: 'creativity',
  fidelity: 'fidelity',
  compositionFidelity: 'composition_fidelity',
  styleStrength: 'style_strength',
  changeStrength: 'change_strength',
  growMask: 'grow_mask',
  outpaintLeft: 'left',
  outpaintRight: 'right',
  outpaintUp: 'up',
  outpaintDown: 'down',
} satisfies Partial<Record<keyof GenerationSettings, string>>;

interface SetupRecord {
  prompt: string;
  targetId: string;
  settings: GenerationSettings | undefined;
  request: Record<string, unknown>;
  inputs: readonly GeneratedImageInput[];
  outputCount: number;
  seedPlan: SeedPlan | undefined;
  seedStrategy: SeedPlan['strategy'];
  plannedSeed: number | null;
}

export class GenerationSetupStore {
  constructor(
    private readonly images: GeneratedImageStore,
    private readonly runs: RunStore,
    private readonly styleGuide: StyleGuideService,
  ) {}

  async get(
    repository: LocalImageRepository,
    source: GenerationSetupSource,
  ): Promise<GenerationSetup> {
    return repository.withMutation(async () => {
      const record = await this.#record(repository, source);
      const capability = getCapability(record.targetId);
      let settings = record.settings;
      if (settings && settings.targetId !== record.targetId) {
        throw new ApiError(409, 'Saved settings do not match the recorded image model.');
      }
      if (!settings) {
        const size = record.request['size'];
        const aspectRatio = Object.entries(IMAGE_SIZE_BY_ASPECT_RATIO).find(
          ([, value]) => value === size,
        )?.[0];
        if (size !== undefined && aspectRatio === undefined) {
          throw new ApiError(409, 'The saved image size is not supported by the current settings.');
        }
        const seedMode =
          record.seedStrategy === 'sequential'
            ? 'sequential'
            : record.seedStrategy === 'fixed-repeat' || record.seedStrategy === 'explicit-list'
              ? 'fixed'
              : 'random';
        const plan = record.seedPlan;
        settings = generationSettingsSchema.parse({
          ...defaultGenerationSettings,
          ...Object.fromEntries(
            Object.entries(settingParameters)
              .filter(([, parameter]) => record.request[parameter] !== undefined)
              .map(([key, parameter]) => [key, record.request[parameter]]),
          ),
          ...(aspectRatio === undefined ? {} : { aspectRatio }),
          targetId: record.targetId,
          outputCount: record.outputCount,
          seedMode,
          seed:
            plan?.strategy === 'fixed-repeat'
              ? plan.seed
              : plan?.strategy === 'sequential'
                ? plan.start
                : (record.plannedSeed ?? 0),
        });
      }
      const inputs: GenerationSetup['inputs'] = [];
      let imageIndex = 0;
      for (const input of record.inputs) {
        const bytes = await this.#readBytes(repository, input);
        const described = await this.#describeInput(repository, input);
        let role: GenerationSetup['inputs'][number]['role'];
        if (input.role === 'mask') role = 'mask';
        else if (input.role === 'style_image') role = 'references';
        else if (input.role === 'init_image') role = 'source';
        else if (input.role === 'image') {
          role =
            record.targetId === 'generation/gpt-image-2' || imageIndex++ > 0
              ? 'references'
              : 'source';
        } else {
          throw new ApiError(409, 'The saved setup contains an unsupported image input.');
        }
        inputs.push({
          imageId: input.imageId,
          role,
          name:
            described.name ??
            `${input.imageId}.${outputFileForMediaType(input.mediaType).extension}`,
          mediaType: input.mediaType,
          byteLength: bytes.byteLength,
          ...(described.styleGuide === undefined || role === 'mask'
            ? {}
            : { styleGuide: described.styleGuide }),
          ...(role === 'mask'
            ? { maskEncoding: capability.providerId === 'azure-foundry' ? 'alpha' : 'luminance' }
            : {}),
        });
      }
      return generationSetupSchema.parse({
        prompt: record.prompt,
        settings,
        inputs,
      });
    });
  }

  async readInput(repository: LocalImageRepository, reference: GenerationInputReference) {
    return repository.withMutation(async () => {
      const record = await this.#record(repository, reference);
      const input = record.inputs[reference.inputIndex];
      if (!input) throw new ApiError(404, 'Saved image input not found.');
      return {
        input: await this.#describeInput(repository, input),
        bytes: await this.#readBytes(repository, input),
      };
    });
  }

  async #describeInput(
    repository: LocalImageRepository,
    input: GeneratedImageInput,
  ): Promise<GeneratedImageInput> {
    if (input.styleGuide) return input;
    const guide = await this.styleGuide.getImageById(repository, input.imageId);
    return guide
      ? {
          ...input,
          name: input.name ?? guide.name,
          styleGuide: { folderId: guide.folderId, name: guide.folderName },
        }
      : input;
  }

  async #readBytes(repository: LocalImageRepository, input: GeneratedImageInput) {
    if (!(await repository.exists(input.repositoryRelativePath))) {
      throw new ApiError(409, 'An original image input is missing from this repository.');
    }
    const bytes = await repository.readBytes(input.repositoryRelativePath);
    if (!imageBytesMatch(bytes, input.sha256)) {
      throw new ApiError(409, 'An original image input failed its integrity check.');
    }
    return bytes;
  }

  async #record(
    repository: LocalImageRepository,
    source: GenerationSetupSource,
  ): Promise<SetupRecord> {
    if (source.kind === 'images') {
      const image = await this.images.getImageMetadata(repository, source.id);
      if (!image) throw new ApiError(404, 'Image not found.');
      const snapshot = image.settings
        ? undefined
        : await this.runs.getSnapshot(repository, image.runId);
      return {
        prompt: image.prompt ?? '',
        targetId: image.canonicalTargetId,
        settings: image.settings,
        request: image.normalizedRequest,
        inputs: image.inputs,
        outputCount: snapshot?.run.requestedJobCount ?? Number(image.normalizedRequest['n'] ?? 1),
        seedPlan: snapshot?.run.seedPlan,
        seedStrategy: snapshot?.run.seedPlan.strategy ?? image.seed.strategy,
        plannedSeed: image.seed.planned,
      };
    }
    const snapshot = await this.runs.getSnapshot(repository, source.id);
    const job = snapshot?.jobs[0];
    if (!snapshot || !job) throw new ApiError(404, 'Run setup not found.');
    return {
      prompt: snapshot.run.prompt ?? '',
      targetId: snapshot.run.targetId,
      settings: snapshot.run.settings,
      request: job.request,
      inputs: job.inputs,
      outputCount: snapshot.run.requestedJobCount,
      seedPlan: snapshot.run.seedPlan,
      seedStrategy: snapshot.run.seedPlan.strategy,
      plannedSeed: job.plannedSeed,
    };
  }
}
