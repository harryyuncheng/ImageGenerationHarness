import { fulfillJson, fulfillPng, recordRunSubmissions } from './fixtures/api.js';
import {
  ASSET_ID,
  IMAGE_ID,
  PROJECT_ID,
  galleryImage,
  imageSidecar,
  project,
  projectAsset,
} from './fixtures/data.js';
import { expect, test } from './fixtures/test.js';

test('creates a project and nested asset, then sends the exact prompt only to that destination', async ({
  page,
}) => {
  let projects: (typeof project)[] = [];
  let assets: (typeof projectAsset)[] = [];

  await page.route('**/api/projects**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname === '/api/projects') {
      projects = [project];
      await fulfillJson(route, project, 201);
      return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/assets')) {
      assets = [projectAsset];
      await fulfillJson(route, projectAsset, 201);
      return;
    }
    if (url.pathname === '/api/projects') {
      await fulfillJson(route, { projects });
      return;
    }
    await fulfillJson(route, { project, assets });
  });
  const submission = await recordRunSubmissions(page);

  await page.goto('/');
  await page.getByLabel('Studio navigation').getByRole('button', { name: 'Gallery' }).click();
  await page.locator('.library-heading').getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('New project name').fill(project.name);
  await page.getByLabel('New project description').fill(project.description);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: project.name, level: 2 })).toBeVisible();

  await page.getByRole('button', { name: 'New asset' }).click();
  await page.getByLabel('Asset name').fill(projectAsset.name);
  await page.getByLabel('Asset description').fill(projectAsset.description);
  await page.getByRole('button', { name: 'Create asset' }).click();
  const assetCard = page.locator('.asset-card').filter({ hasText: projectAsset.name });
  await expect(assetCard).toBeVisible();
  await assetCard.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByText('Save to', { exact: true })).toHaveCount(0);

  const exactPrompt = '  exact prompt spacing  ';
  await page.getByLabel('Image prompt').fill(exactPrompt);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect.poll(() => submission.current).toBeTruthy();
  expect(submission.current).toMatchObject({
    destination: { kind: 'project-asset', projectId: PROJECT_ID, projectAssetId: ASSET_ID },
    request: { prompt: exactPrompt },
  });
  expect(JSON.stringify(submission.current)).not.toContain(project.description);
  expect(JSON.stringify(submission.current)).not.toContain(projectAsset.description);
});

test('opens the project image editor and remixes to the original destination', async ({ page }) => {
  await page.route('**/api/projects**', async (route) => {
    const url = new URL(route.request().url());
    await fulfillJson(
      route,
      url.pathname === '/api/projects'
        ? { projects: [project] }
        : { project, assets: [projectAsset] },
    );
  });
  const submission = await recordRunSubmissions(page);
  await page.route('**/api/images**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/api/images/${IMAGE_ID}/metadata`)) {
      await fulfillJson(route, imageSidecar());
      return;
    }
    if (url.pathname.endsWith(`/api/images/${IMAGE_ID}/content`)) {
      await fulfillPng(route);
      return;
    }
    await fulfillJson(route, {
      images: [
        galleryImage({
          byteLength: 128,
          prompt: 'Gallery prompt',
          projectId: PROJECT_ID,
          projectAssetId: ASSET_ID,
        }),
      ],
    });
  });

  await page.goto('/');
  await page.getByLabel('Studio navigation').getByRole('button', { name: 'Gallery' }).click();
  await page.getByRole('button', { name: project.name }).click();
  await page.getByRole('button', { name: 'Open editor for Gallery prompt' }).click();
  const editor = page.getByRole('tabpanel', { name: 'Image editor' });
  await expect(editor).toBeVisible();
  await expect(
    editor
      .locator('.image-editor-header')
      .getByText(`${project.name} / ${projectAsset.name}`, { exact: true }),
  ).toBeVisible();
  await expect(editor.getByRole('link', { name: 'Full screen' })).toHaveAttribute(
    'target',
    '_blank',
  );
  await editor.getByRole('button', { name: 'Metadata' }).click();
  await expect(page.getByRole('dialog', { name: 'Generated image metadata' })).toContainText(
    IMAGE_ID,
  );
  await expect(page.getByRole('dialog', { name: 'Generated image metadata' })).toContainText(
    'Gallery prompt',
  );
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await editor.getByRole('button', { name: 'Remix' }).click();
  await expect(page.getByLabel('Image prompt')).toHaveValue('Gallery prompt');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect.poll(() => submission.current).toBeTruthy();
  expect(submission.current).toMatchObject({
    destination: { kind: 'project-asset', projectId: PROJECT_ID, projectAssetId: ASSET_ID },
    request: { prompt: 'Gallery prompt' },
  });
});
