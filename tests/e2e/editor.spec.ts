import { expect, test } from './fixtures/test.js';

test('omits standalone edit navigation', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByLabel('Studio navigation').getByRole('button', { name: 'Edit', exact: true }),
  ).toHaveCount(0);

  await page.setViewportSize({ width: 560, height: 620 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(
    page.getByLabel('Mobile studio navigation').getByRole('button', {
      name: 'Edit',
      exact: true,
    }),
  ).toHaveCount(0);
});
