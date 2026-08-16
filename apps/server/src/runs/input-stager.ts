import { randomUUID } from 'node:crypto';
import type { LocalInputReference, ReferenceImage } from '@harness/domain';
import { characterizeImageData, imageBytesMatch, outputFileForMediaType } from '@harness/image';
import type { ReferenceLibraryService } from '../references/reference-library-service.js';
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
  for (const input of inputs) {
    const bytes = await repository.readBytes(input.repositoryRelativePath);
    if (!imageBytesMatch(bytes, input.sha256)) {
      throw new Error('Input image integrity verification failed');
    }
    hydrated[input.field] = Buffer.from(bytes).toString('base64');
  }
  return hydrated;
}

export class InputStager {
  constructor(private readonly references: ReferenceLibraryService) {}

  async stage(
    repository: LocalImageRepository,
    request: Record<string, unknown>,
  ): Promise<StagedRequest> {
    const staged = { ...request };
    const inputs: LocalInputReference[] = [];
    const createdPaths: string[] = [];
    try {
      for (const [field, value] of Object.entries(request)) {
        if (!imageFields.has(field) || typeof value !== 'string') continue;
        const reference = referencePattern.exec(value);
        let image: ReferenceImage | undefined;
        if (reference?.[1]) image = await this.references.getImageById(reference[1]);
        if (reference && !image) throw new Error('Reference image not found');
        if (image) {
          const bytes = await repository.readBytes(image.repositoryRelativePath);
          if (!imageBytesMatch(bytes, image.sha256, image.byteLength)) {
            throw new Error('Reference image integrity verification failed');
          }
          const extension = outputFileForMediaType(image.mediaType).extension;
          const snapshotPath = `.image-harness/inputs/${image.sha256}--${image.imageId}.${extension}`;
          await repository.withMutation(async () => {
            if (await repository.exists(snapshotPath)) {
              const existing = await repository.readBytes(snapshotPath);
              if (!imageBytesMatch(existing, image.sha256)) {
                throw new Error('Staged reference image integrity verification failed');
              }
            } else {
              await repository.writeImmutable(snapshotPath, bytes);
              createdPaths.push(snapshotPath);
            }
          });
          staged[field] = `repo-image://${image.imageId}`;
          inputs.push({
            field,
            role: field,
            imageId: image.imageId,
            repositoryRelativePath: snapshotPath,
            sha256: image.sha256,
            mediaType: image.mediaType,
          });
          continue;
        }
        if (value.startsWith('repo-image://')) {
          throw new Error('Invalid reference image identifier');
        }
        const imageData = await characterizeImageData(value, { label: 'Input image data' });
        const imageId = randomUUID();
        const path = `.image-harness/inputs/${imageData.sha256}--${imageId}.${imageData.extension}`;
        await repository.writeImmutable(path, imageData.bytes);
        createdPaths.push(path);
        staged[field] = `repo-image://${imageId}`;
        inputs.push({
          field,
          role: field,
          imageId,
          repositoryRelativePath: path,
          sha256: imageData.sha256,
          mediaType: imageData.mediaType,
        });
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
