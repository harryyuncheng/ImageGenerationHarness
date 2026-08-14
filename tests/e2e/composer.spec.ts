import { expect, test } from './fixtures/test.js';

test('keeps the model selector anchored through panel and viewport changes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.locator('.model-picker').click();
  const menu = page.locator('.model-menu');
  const anchor = page.locator('.model-picker-wrap');
  await expect(menu).toBeVisible();

  const anchorLeft = () => anchor.evaluate((element) => element.getBoundingClientRect().left);
  const expectMenuAnchored = async () => {
    await expect
      .poll(async () =>
        menu.evaluate((element) => {
          const anchorBounds = element.parentElement?.getBoundingClientRect();
          const bounds = element.getBoundingClientRect();
          const viewport = window.visualViewport;
          const viewportLeft = viewport?.offsetLeft ?? 0;
          const viewportTop = viewport?.offsetTop ?? 0;
          const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
          const viewportHeight = viewport?.height ?? document.documentElement.clientHeight;
          const expectedWidth = Math.min(430, viewportWidth - 24);
          const expectedLeft = anchorBounds
            ? Math.min(
                Math.max(anchorBounds.left, viewportLeft + 12),
                viewportLeft + viewportWidth - expectedWidth - 12,
              )
            : Number.NaN;
          const expectedEdge =
            element.dataset['placement'] === 'above'
              ? (anchorBounds?.top ?? 0) - 7
              : (anchorBounds?.bottom ?? 0) + 7;
          const actualEdge = element.dataset['placement'] === 'above' ? bounds.bottom : bounds.top;
          return {
            anchored:
              Math.abs(bounds.left - expectedLeft) <= 1 && Math.abs(actualEdge - expectedEdge) <= 1,
            fits:
              bounds.left >= viewportLeft &&
              bounds.right <= viewportLeft + viewportWidth &&
              bounds.top >= viewportTop &&
              bounds.bottom <= viewportTop + viewportHeight,
            heightLimited: bounds.height <= 360,
            scrollable: element.scrollHeight > element.clientHeight,
          };
        }),
      )
      .toEqual({ anchored: true, fits: true, heightLimited: true, scrollable: true });
  };

  await expectMenuAnchored();
  expect(
    await menu.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop;
    }),
  ).toBeGreaterThan(0);

  const expandedLeft = await anchorLeft();
  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect.poll(async () => Math.abs((await anchorLeft()) - expandedLeft)).toBeGreaterThan(40);
  await expectMenuAnchored();

  const withSettingsLeft = await anchorLeft();
  await page.getByRole('button', { name: 'Close advanced settings' }).click();
  await expect
    .poll(async () => Math.abs((await anchorLeft()) - withSettingsLeft))
    .toBeGreaterThan(40);
  await expectMenuAnchored();

  await page.setViewportSize({ width: 560, height: 620 });
  await expectMenuAnchored();
});

test('shows the complete controls for each selected Bedrock tool', async ({ page }) => {
  await page.goto('/');
  const composer = page.locator('.composer-wrap');
  const settings = page.getByRole('complementary', { name: 'Generation settings' });
  const dimensions = composer.getByRole('button', { name: 'Aspect ratio' });
  const imageCount = composer.getByRole('button', { name: 'Number of images' });
  await expect(dimensions).toBeVisible();
  await expect(imageCount).toBeVisible();
  await expect(composer.getByRole('combobox', { name: 'Aspect ratio' })).toHaveCount(0);
  await expect(composer.getByRole('combobox', { name: 'Number of images' })).toHaveCount(0);

  await dimensions.click();
  const dimensionsMenu = page.getByRole('listbox', { name: 'Image dimensions' });
  await expect(dimensionsMenu).toBeVisible();
  await expect(dimensionsMenu.getByRole('option')).toHaveCount(9);
  await dimensionsMenu.getByRole('option', { name: 'Landscape, 16:9' }).click();
  await expect(dimensions).toContainText('16:9');
  await expect(dimensions).toHaveAttribute('aria-expanded', 'false');

  await imageCount.click();
  const countMenu = page.getByRole('listbox', { name: 'Image count' });
  await expect(countMenu).toBeVisible();
  await expect(countMenu.getByRole('option')).toHaveCount(4);
  await countMenu.getByRole('option', { name: '3 images' }).click();
  await expect(imageCount).toContainText('3');
  await expect(imageCount).toHaveAttribute('aria-expanded', 'false');
  await expect(settings.getByText('Model & tool')).toHaveCount(0);
  await expect(settings.getByText('Aspect ratio')).toHaveCount(0);
  await expect(settings.getByText('Number of images')).toHaveCount(0);

  await page.locator('.model-picker').click();
  await page.getByRole('button', { name: /Style Transfer/ }).click();
  await expect(settings.getByText('Composition fidelity')).toBeVisible();
  await expect(settings.getByText('Style strength')).toBeVisible();
  await expect(settings.getByText('Change strength')).toBeVisible();
  await expect(settings.getByText('Style preset')).toHaveCount(0);

  await page.locator('.model-picker').click();
  await page.getByRole('button', { name: /Creative Upscale/ }).click();
  await expect(settings.getByText('Style preset')).toBeVisible();
  await expect(settings.getByText('Creativity')).toBeVisible();

  await page.locator('.model-picker').click();
  await page.getByRole('button', { name: /Fast Upscale/ }).click();
  await expect(settings.getByRole('button', { name: /Advanced settings/ })).toHaveCount(0);
  await expect(settings.getByText('Output format')).toBeVisible();
  await expect(settings.getByText('Negative prompt')).toHaveCount(0);
  await expect(settings.getByText('Seed strategy')).toHaveCount(0);
});
