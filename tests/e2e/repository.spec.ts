import { fulfillJson } from './fixtures/api.js';
import { expect, test } from './fixtures/test.js';

test('keeps the studio usable without a repository and prompts before repository-backed creation', async ({
  page,
}) => {
  let projectRequests = 0;
  let runRequests = 0;
  await page.route('**/api/repository', async (route) => {
    await fulfillJson(route, { active: null, recent: [] });
  });
  await page.route('**/api/projects', async (route) => {
    projectRequests += 1;
    await fulfillJson(route, { error: 'No repository' }, 503);
  });
  await page.route('**/api/runs**', async (route) => {
    runRequests += 1;
    await fulfillJson(route, { error: 'No repository' }, 503);
  });
  await page.goto('/');
  await expect(page.getByLabel('Image prompt')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Generation settings' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Choose where your image work lives' }),
  ).toHaveCount(0);
  expect(projectRequests).toBe(0);
  expect(runRequests).toBe(0);

  await page.getByLabel('Image prompt').fill('A quiet lighthouse at blue hour');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  const repositoryButton = page.getByRole('button', { name: 'Image repository: not selected' });
  await expect(repositoryButton).toHaveClass(/repository-button--attention/);
  const chooseFolderButton = page.getByRole('button', { name: 'Choose folder' });
  await expect(chooseFolderButton.getByText('No active repository')).toBeVisible();
  await expect(
    chooseFolderButton.getByText(
      'Choose a folder or create one in the picker before saving repository-backed work',
    ),
  ).toBeVisible();
  await expect(page.getByText('Choose an image repository to generate images.')).toBeVisible();
  expect(runRequests).toBe(0);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'View your past creations here' }).click();
  await page
    .getByRole('group', { name: 'Sort gallery' })
    .getByRole('button', {
      name: 'By project',
    })
    .click();
  await page.locator('.library-heading').getByRole('button', { name: 'New project' }).click();
  await expect(page.getByRole('heading', { name: 'Create a project' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choose folder' })).toBeVisible();
  expect(projectRequests).toBe(0);
});

test('offers folder selection and recent repository switching', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Image repository: Studio Library' }).click();
  await expect(page.getByRole('button', { name: 'Choose folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Baroque home' }).click();
  await expect(page.getByRole('button', { name: 'Choose folder' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Image repository: Studio Library' }).click();
  await page.getByRole('button', { name: /Archive Library/ }).click();
  await expect(
    page.getByRole('button', { name: 'Image repository: Archive Library' }),
  ).toBeVisible();
});
