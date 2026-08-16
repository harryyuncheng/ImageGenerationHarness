import { expectSharedSurfaceMotion } from './fixtures/motion.js';
import { test } from './fixtures/test.js';

test('reuses shared entry motion across tabs, menus, panels, and dialogs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  await expectSharedSurfaceMotion(page.locator('.canvas > .surface-enter'));

  await page.getByRole('button', { name: 'Image repository: Studio Library' }).click();
  await expectSharedSurfaceMotion(page.locator('.repository-menu'));
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expectSharedSurfaceMotion(page.locator('.settings-dialog'));
  await page.keyboard.press('Escape');

  await page.locator('.model-picker').click();
  await expectSharedSurfaceMotion(page.locator('.model-menu'));
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Aspect ratio' }).click();
  await expectSharedSurfaceMotion(page.locator('.composer-setting-menu'));
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Get code' }).click();
  await expectSharedSurfaceMotion(page.locator('.modal-backdrop'));
  await expectSharedSurfaceMotion(page.getByRole('dialog', { name: 'Get code' }));
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await page.getByRole('button', { name: 'View your past creations here' }).click();
  await expectSharedSurfaceMotion(page.locator('.canvas > .surface-enter'));
  await page
    .getByRole('group', { name: 'Sort gallery' })
    .getByRole('button', {
      name: 'By project',
    })
    .click();
  await page.locator('.library-heading').getByRole('button', { name: 'New project' }).click();
  await expectSharedSurfaceMotion(page.locator('.project-create'));

  await page.setViewportSize({ width: 560, height: 620 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expectSharedSurfaceMotion(page.getByLabel('Mobile studio navigation'));
});
