import type { Destination, GeneratedImageSidecar } from '@harness/domain';
import { generatedImageSidecarSchema } from '@harness/domain';
import { imageBytesMatch } from '@harness/image';
import { z } from 'zod';
import type { LocalImageRepository } from '../repository/local-image-repository.js';
import type { LocalRepositoryManager } from '../repository/repository-manager.js';
import { destinationMatches } from '../runs/run-helpers.js';
import type { GalleryImage, GeneratedImageRecord } from '../runs/run-types.js';

export class GeneratedImageStore {
  constructor(private readonly manager: LocalRepositoryManager) {}

  async getImage(imageId: string): Promise<GeneratedImageRecord | undefined> {
    const sidecar = await this.getImageMetadata(imageId);
    if (!sidecar) return undefined;
    return {
      imageId,
      runId: sidecar.runId,
      repositoryRelativePath: sidecar.repositoryRelativePath,
      mediaType: sidecar.output.mediaType,
      byteLength: sidecar.output.byteLength,
    };
  }

  async getImageMetadata(imageId: string): Promise<GeneratedImageSidecar | undefined> {
    const matches: GeneratedImageSidecar[] = [];
    await this.walk(this.manager.getActiveRepository(), (sidecar) => {
      if (sidecar.imageId === imageId) matches.push(sidecar);
    });
    if (matches.length > 1) throw new Error('Duplicate generated image identifiers');
    return matches[0];
  }

  async readImage(image: GeneratedImageRecord): Promise<Uint8Array> {
    const current = await this.getImageMetadata(image.imageId);
    if (current?.repositoryRelativePath !== image.repositoryRelativePath) {
      throw new Error('Generated image record is no longer valid');
    }
    const bytes = await this.manager
      .getActiveRepository()
      .readBytes(current.repositoryRelativePath);
    if (!imageBytesMatch(bytes, current.output.sha256, current.output.byteLength)) {
      throw new Error('Generated image integrity verification failed');
    }
    return bytes;
  }

  async listImages(destination?: Destination): Promise<GalleryImage[]> {
    const images: GalleryImage[] = [];
    await this.walk(this.manager.getActiveRepository(), (sidecar) => {
      if (destination && !destinationMatches(sidecar, destination)) return;
      images.push({
        imageId: sidecar.imageId,
        runId: sidecar.runId,
        mediaType: sidecar.output.mediaType,
        byteLength: sidecar.output.byteLength,
        createdAt: sidecar.createdAt,
        ...(sidecar.prompt === undefined ? {} : { prompt: sidecar.prompt }),
        targetId: sidecar.canonicalTargetId,
        ...(sidecar.projectId === undefined ? {} : { projectId: sidecar.projectId }),
        ...(sidecar.projectAssetId === undefined ? {} : { projectAssetId: sidecar.projectAssetId }),
      });
    });
    return images.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async walk(
    repository: LocalImageRepository,
    visit: (sidecar: GeneratedImageSidecar) => void | Promise<void>,
  ): Promise<void> {
    const walkDirectory = async (directory: string): Promise<void> => {
      for (const file of await repository.listFiles(directory)) {
        if (!file.endsWith('.image.json')) continue;
        const path = `${directory}/${file}`;
        try {
          await visit(await repository.readJson(path, generatedImageSidecarSchema));
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new Error(`Malformed generated image metadata: ${path}`);
          }
          throw error;
        }
      }
      for (const child of await repository.listDirectories(directory)) {
        await walkDirectory(`${directory}/${child}`);
      }
    };
    await walkDirectory('images');
    await walkDirectory('projects');
  }
}
