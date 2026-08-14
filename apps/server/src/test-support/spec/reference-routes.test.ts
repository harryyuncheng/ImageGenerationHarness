import { describe, expect, it, vi } from 'vitest';
import {
  createInjectedServices,
  HEADERS,
  FOLDER_ID,
  REFERENCE_IMAGE_ID,
  openApp,
  referenceFolder,
  referenceImage,
} from './app-test-support.js';

describe('local reference library API', () => {
  it('keeps repository paths out of DTOs and reads content through the image record', async () => {
    const services = createInjectedServices();
    const readImage = vi.fn(() => Promise.resolve(new Uint8Array([4, 5, 6])));
    services.referenceLibraryService.list = vi.fn(() =>
      Promise.resolve([{ folder: referenceFolder, images: [referenceImage] }]),
    );
    services.referenceLibraryService.getImage = vi.fn(() => Promise.resolve(referenceImage));
    services.referenceLibraryService.readImage = readImage;
    const app = await openApp(services);

    const library = await app.inject({
      method: 'GET',
      url: '/api/reference-library',
      headers: HEADERS,
    });
    const content = await app.inject({
      method: 'GET',
      url: `/api/reference-folders/${FOLDER_ID}/images/${REFERENCE_IMAGE_ID}/content`,
      headers: HEADERS,
    });

    expect(library.statusCode).toBe(200);
    expect(library.json()).toMatchObject({
      folders: [
        {
          folderId: FOLDER_ID,
          name: 'Lighting',
          images: [{ imageId: REFERENCE_IMAGE_ID, name: 'softbox.jpg' }],
        },
      ],
    });
    expect(library.body).not.toContain('repositoryRelativePath');
    expect(library.body).not.toContain(referenceFolder.directory);
    expect(library.body).not.toContain(referenceImage.sha256);
    expect(content.statusCode).toBe(200);
    expect(content.rawPayload).toEqual(Buffer.from([4, 5, 6]));
    expect(readImage).toHaveBeenCalledWith(referenceImage);
  });
});
