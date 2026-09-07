import { randomUUID } from 'node:crypto';
import type { GeneratedImageSidecar, LocalInputReference, StyleGuideImage } from '@harness/domain';
import { characterizeImageData, imageBytesMatch, outputFileForMediaType } from '@harness/image';
import type { GeneratedImageStore } from '../images/generated-image-store.js';
import type { StyleGuideService } from '../style-guide/style-guide-service.js';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import type { StagedRequest } from './run-types.js';

const imageFields = new Set(['image', 'init_image', 'style_image', 'mask']);
const referencePattern = /^repo-image:\/\/([0-9a-f-]{36})$/iu;

export async function hydrateInputs(
  repository: LocalImageRepository,
  request: Record<string, unknown>,
  inputs: readonly LocalInputReference[],
): Promise<Record<string, unknown>> {
  const hydrated = { ...request };
  if (inputs.some((input) => !imageFields.has(input.field))) {
    throw new Error('Invalid staged image field');
  }
  for (const field of imageFields) {
    const value = request[field];
    const records = inputs.filter((input) => input.field === field);
    if (value === undefined && records.length === 0) continue;
    const references: unknown[] = Array.isArray(value) ? value : [value];
    if (references.length === 0 || references.length !== records.length) {
      throw new Error('Staged image inputs do not match the request');
    }
    const images: string[] = [];
    for (const [index, input] of records.entries()) {
      if (references[index] !== `repo-image://${input.imageId}`) {
        throw new Error('Staged image order does not match the request');
      }
      const bytes = await repository.readBytes(input.repositoryRelativePath);
      if (!imageBytesMatch(bytes, input.sha256)) {
        throw new Error('Input image integrity verification failed');
      }
      images.push(Buffer.from(bytes).toString('base64'));
    }
    hydrated[field] = Array.isArray(value) ? images : images[0];
  }
  return hydrated;
}

export class InputStager {
  constructor(
    private readonly styleGuide: StyleGuideService,
    private readonly images: GeneratedImageStore,
  ) {}

  async stage(
    repository: LocalImageRepository,
    request: Record<string, unknown>,
  ): Promise<StagedRequest> {
    const staged = { ...request };
    const inputs: LocalInputReference[] = [];
    const createdPaths: string[] = [];
    try {
      for (const [field, value] of Object.entries(request)) {
        if (!imageFields.has(field)) continue;
        const values: unknown[] = Array.isArray(value) ? value : [value];
        const references: string[] = [];
        for (const encoded of values) {
          if (typeof encoded !== 'string') throw new Error('Invalid image input');
          const reference = referencePattern.exec(encoded);
          let image: StyleGuideImage | GeneratedImageSidecar | undefined;
          if (reference?.[1]) {
            image =
              (await this.styleGuide.getImageById(repository, reference[1])) ??
              (await this.images.getImageMetadata(repository, reference[1]));
          }
          if (reference && !image) throw new Error('Repository image not found');
          if (image) {
            const output = 'output' in image ? image.output : image;
            const bytes = await repository.readBytes(image.repositoryRelativePath);
            if (!imageBytesMatch(bytes, output.sha256, output.byteLength)) {
              throw new Error('Repository image integrity verification failed');
            }
            const extension = outputFileForMediaType(output.mediaType).extension;
            const snapshotPath = `.image-harness/inputs/${output.sha256}--${image.imageId}.${extension}`;
            await repository.withMutation(async () => {
              if (await repository.exists(snapshotPath)) {
                const existing = await repository.readBytes(snapshotPath);
                if (!imageBytesMatch(existing, output.sha256)) {
                  throw new Error('Staged repository image integrity verification failed');
                }
              } else {
                await repository.writeImmutable(snapshotPath, bytes);
                createdPaths.push(snapshotPath);
              }
            });
            references.push(`repo-image://${image.imageId}`);
            inputs.push({
              field,
              role: field,
              imageId: image.imageId,
              repositoryRelativePath: snapshotPath,
              sha256: output.sha256,
              mediaType: output.mediaType,
            });
            continue;
          }
          if (encoded.startsWith('repo-image://')) {
            throw new Error('Invalid repository image identifier');
          }
          const imageData = await characterizeImageData(encoded, { label: 'Input image data' });
          const imageId = randomUUID();
          const path = `.image-harness/inputs/${imageData.sha256}--${imageId}.${imageData.extension}`;
          await repository.writeImmutable(path, imageData.bytes);
          createdPaths.push(path);
          references.push(`repo-image://${imageId}`);
          inputs.push({
            field,
            role: field,
            imageId,
            repositoryRelativePath: path,
            sha256: imageData.sha256,
            mediaType: imageData.mediaType,
          });
        }
        staged[field] = Array.isArray(value) ? references : references[0];
      }
      return { request: staged, inputs, createdInputPaths: createdPaths };
    } catch (error) {
      for (const path of createdPaths.reverse()) {
        await repository.removeRelative(path, { missingOk: true });
      }
      throw error;
    }
  }
}
