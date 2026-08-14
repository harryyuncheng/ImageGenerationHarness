import { fulfillJson } from './fixtures/api.js';
import { referenceFolder } from './fixtures/data.js';
import { expect, test } from './fixtures/test.js';

test('selects a reusable image from a reference folder', async ({ page }) => {
  const folderId = '83cbfc7d-bdb4-4f8c-adde-ed506a01e125';
  const imageId = 'c66a089f-d441-4368-9eef-bc12d424719f';
  await page.route('**/api/reference-library', async (route) => {
    await fulfillJson(route, { folders: [referenceFolder(folderId, imageId)] });
  });
  await page.route(
    `**/api/reference-folders/${folderId}/images/${imageId}/content`,
    async (route) => {
      await route.fulfill({ status: 204 });
    },
  );

  await page.goto('/');
  await page
    .getByLabel('Studio navigation')
    .getByRole('button', { name: 'References', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Reference library' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Editorial lighting' })).toBeVisible();
  await page.locator('.reference-preview').click();
  await expect(page.getByText('soft-window-light.jpg')).toBeVisible();
  await expect(page.getByText('Source', { exact: true })).toBeVisible();
});
