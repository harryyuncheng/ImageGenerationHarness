import { expect, test } from './fixtures/test.js';

test('supports explicit light and dark themes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  await page.goto('/');
  const root = page.locator('html');
  await page.getByRole('button', { name: 'Choose theme' }).click();
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
  await expect(page.locator('.theme-menu')).toBeVisible();
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
  await expect(page.locator('.theme-menu')).toBeVisible();
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
});
