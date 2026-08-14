import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationConfigStore } from '../repository/application-config-store.js';
import { LocalRepositoryManager } from '../repository/repository-manager.js';
import { FixedDirectorySelector, ONE_PIXEL_PNG, TemporaryDirectoryScope } from '../test/support.js';
import { LocalReferenceLibraryService } from './reference-library-service.js';

const temporaryDirectories = new TemporaryDirectoryScope();

async function createManager(): Promise<{
  manager: LocalRepositoryManager;
  configPath: string;
}> {
  const { manager, configPath } = await temporaryDirectories.createSelectedRepository(
    'image-harness-references-',
  );
  return { manager, configPath };
}

afterEach(async () => {
  await temporaryDirectories.cleanup();
});

describe('local reference library', () => {
  it('persists folders, sidecars, bytes, renames, and image-id lookup', async () => {
    const { manager, configPath } = await createManager();
    const service = new LocalReferenceLibraryService(manager);
    const folder = await service.createFolder('Editorial Lighting');
    const image = await service.createImage(folder.folderId, {
      name: 'Window Light.png',
      mediaType: 'image/png',
      data: ONE_PIXEL_PNG,
    });
    expect(image.repositoryRelativePath).toMatch(
      new RegExp(`^${folder.directory}/window-light--[0-9a-f-]+\\.png$`, 'u'),
    );
    expect(await service.readImage(image)).toEqual(
      Uint8Array.from(Buffer.from(ONE_PIXEL_PNG, 'base64')),
    );

    await service.renameFolder(folder.folderId, 'Portrait Lighting');
    await service.renameImage(folder.folderId, image.imageId, 'Soft Window Light');
    expect((await service.getImageById(image.imageId))?.name).toBe('Soft Window Light');
    expect((await service.getImageById(image.imageId))?.repositoryRelativePath).toBe(
      image.repositoryRelativePath,
    );

    const reopenedManager = new LocalRepositoryManager(
      new FixedDirectorySelector('unused'),
      new ApplicationConfigStore(configPath),
    );
    await reopenedManager.initialize();
    const reopened = new LocalReferenceLibraryService(reopenedManager);
    expect((await reopened.list())[0]?.folder.name).toBe('Portrait Lighting');
    expect(await reopened.readImage(image.repositoryRelativePath)).toEqual(
      Uint8Array.from(Buffer.from(ONE_PIXEL_PNG, 'base64')),
    );

    await reopened.deleteImage(folder.folderId, image.imageId);
    expect(await reopened.getImageById(image.imageId)).toBeUndefined();
    await reopened.deleteFolder(folder.folderId);
    expect(await reopened.list()).toEqual([]);
  });

  it('rejects non-canonical base64 and media-type mismatches', async () => {
    const { manager } = await createManager();
    const service = new LocalReferenceLibraryService(manager);
    const folder = await service.createFolder('Inputs');
    await expect(
      service.createImage(folder.folderId, {
        name: 'bad.png',
        mediaType: 'image/png',
        data: 'not base64',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.createImage(folder.folderId, {
        name: 'wrong.jpg',
        mediaType: 'image/jpeg',
        data: ONE_PIXEL_PNG,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
