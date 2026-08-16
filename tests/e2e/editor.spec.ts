import { expect, test } from './fixtures/test.js';

test('omits standalone edit and gallery navigation', async ({ page }) => {
  await page.goto('/');
  const desktopNavigation = page.getByLabel('Studio navigation');
  await expect(desktopNavigation.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(desktopNavigation.getByRole('button', { name: 'Gallery', exact: true })).toHaveCount(
    0,
  );

  await page.setViewportSize({ width: 560, height: 620 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const mobileNavigation = page.getByLabel('Mobile studio navigation');
  await expect(mobileNavigation.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(mobileNavigation.getByRole('button', { name: 'Gallery', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'View your past creations here' })).toBeVisible();
});
