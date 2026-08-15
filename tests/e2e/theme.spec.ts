import { expect, test } from './fixtures/test.js';

test('supports explicit light and dark themes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto('/');
  const root = page.locator('html');
  await expect(page.getByRole('button', { name: 'Choose theme' })).toHaveCount(0);

  const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
  await settingsButton.click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await expect(settings.getByRole('heading', { name: 'Help & shortcuts' })).toBeVisible();
  await expect(settings.getByText('Open settings')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const trigger = document.querySelector('.app-settings__trigger')?.getBoundingClientRect();
        const popover = document.querySelector('.settings-popover')?.getBoundingClientRect();
        if (!trigger || !popover) return null;
        return {
          triggerLeft: Math.round(trigger.left),
          triggerBottom: Math.round(window.innerHeight - trigger.bottom),
          popoverLeft: Math.round(popover.left),
          popoverGap: Math.round(trigger.top - popover.bottom),
        };
      }),
    )
    .toEqual({
      triggerLeft: 12,
      triggerBottom: 12,
      popoverLeft: 12,
      popoverGap: 8,
    });

  const transitionAnimations = await page
    .getByRole('button', { name: 'Dark' })
    .evaluate(async (element) => {
      if (!(element instanceof HTMLButtonElement)) throw new Error('Theme option is not a button');
      element.click();
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 50);
      });
      return document.getAnimations().flatMap((animation) => {
        if (!(animation.effect instanceof KeyframeEffect)) return [];
        const { pseudoElement } = animation.effect;
        if (!pseudoElement?.startsWith('::view-transition')) return [];
        return [{ pseudoElement, duration: animation.effect.getTiming().duration }];
      });
    });
  expect(transitionAnimations).toContainEqual({
    pseudoElement: '::view-transition-old(root)',
    duration: 200,
  });
  expect(
    transitionAnimations.some(({ pseudoElement }) => pseudoElement.includes('(theme-indicator)')),
  ).toBe(true);
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(settings).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.effect instanceof KeyframeEffect &&
                animation.effect.pseudoElement?.startsWith('::view-transition'),
            ).length,
      ),
    )
    .toBe(0);

  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Light' }).click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect(settings).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect instanceof KeyframeEffect &&
              animation.effect.pseudoElement?.startsWith('::view-transition'),
          ).length,
    ),
  ).toBe(0);

  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await page.keyboard.press('Meta+/');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
});
