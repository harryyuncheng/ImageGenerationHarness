import { describe, expect, it, vi } from 'vitest';
import {
  createInjectedServices,
  HEADERS,
  IMAGE_ID,
  RUN_ID,
  PROJECT_ID,
  NOW,
  imageMetadata,
  openApp,
} from './app-test-support.js';

describe('generated image API', () => {
  it('serves ID-resolved gallery, content, and sidecar routes safely', async () => {
    const services = createInjectedServices();
    const generatedRecord = {
      imageId: IMAGE_ID,
      runId: RUN_ID,
      repositoryRelativePath: imageMetadata.repositoryRelativePath,
      mediaType: 'image/png' as const,
      byteLength: 3,
    };
    const readImage = vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3])));
    services.runService.listImages = vi.fn(() =>
      Promise.resolve([
        {
          imageId: IMAGE_ID,
          runId: RUN_ID,
          mediaType: 'image/png' as const,
          byteLength: 3,
          createdAt: NOW,
          prompt: 'A small blue house',
          targetId: 'generation/core',
          projectId: PROJECT_ID,
        },
      ]),
    );
    services.runService.getImage = vi.fn(() => Promise.resolve(generatedRecord));
    services.runService.getImageMetadata = vi.fn(() => Promise.resolve(imageMetadata));
    services.runService.readImage = readImage;
    const app = await openApp(services);

    const gallery = await app.inject({
      method: 'GET',
      url: '/api/images',
      headers: HEADERS,
    });
    const content = await app.inject({
      method: 'GET',
      url: `/api/images/${IMAGE_ID}/content`,
      headers: HEADERS,
    });
    const metadata = await app.inject({
      method: 'GET',
      url: `/api/images/${IMAGE_ID}/metadata`,
      headers: HEADERS,
    });
    const legacyAssetRoute = await app.inject({
      method: 'GET',
      url: `/api/assets/${RUN_ID}/${IMAGE_ID}`,
      headers: HEADERS,
    });

    expect(gallery.statusCode).toBe(200);
    expect(gallery.body).not.toContain('repositoryRelativePath');
    expect(content.statusCode).toBe(200);
    expect(content.headers['content-type']).toContain('image/png');
    expect(content.rawPayload).toEqual(Buffer.from([1, 2, 3]));
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json()).toMatchObject({
      imageId: IMAGE_ID,
      repositoryRelativePath: imageMetadata.repositoryRelativePath,
    });
    expect(metadata.body).not.toContain('/Users/');
    expect(legacyAssetRoute.statusCode).toBe(404);
    expect(readImage).toHaveBeenCalledWith(generatedRecord);
  });
});
