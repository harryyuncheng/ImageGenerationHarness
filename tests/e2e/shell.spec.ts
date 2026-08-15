import { expect, test } from './fixtures/test.js';

test('loads the loopback generation workspace', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.top-bar h1')).toHaveCount(0);
  const topBarAppearance = await page.evaluate(() => {
    const topBar = document.querySelector('.top-bar');
    const studioMain = document.querySelector('.studio-main');
    const canvas = document.querySelector('.canvas');
    if (!topBar || !studioMain || !canvas) return null;
    const topBarStyle = getComputedStyle(topBar);
    const studioMainStyle = getComputedStyle(studioMain);
    const canvasStyle = getComputedStyle(canvas);
    return {
      backgroundColor: topBarStyle.backgroundColor,
      canvasBackgroundColor: canvasStyle.backgroundColor,
      canvasBackgroundImage: canvasStyle.backgroundImage,
      sharedBackgroundHasAura: studioMainStyle.backgroundImage.includes('radial-gradient'),
      borderBottomWidth: topBarStyle.borderBottomWidth,
      boxShadow: topBarStyle.boxShadow,
      backdropFilter: topBarStyle.backdropFilter,
    };
  });
  expect(topBarAppearance).toEqual({
    backgroundColor: 'rgba(0, 0, 0, 0)',
    canvasBackgroundColor: 'rgba(0, 0, 0, 0)',
    canvasBackgroundImage: 'none',
    sharedBackgroundHasAura: true,
    borderBottomWidth: '0px',
    boxShadow: 'none',
    backdropFilter: 'none',
  });
  const prompt = page.getByLabel('Image prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt).not.toHaveAttribute('placeholder', '');
  await expect(page.getByRole('button', { name: 'New image', exact: true })).toBeVisible();
  await expect(
    page.getByLabel('Studio navigation').getByRole('button', { name: 'Create', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.composer')).toHaveCount(0);
  const floatingToolbar = await page.evaluate(() => {
    const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
    const toolbarElement = document.querySelector('.generation-toolbar');
    const toolbar = toolbarElement?.getBoundingClientRect();
    return canvas && toolbarElement && toolbar
      ? {
          insideCanvas:
            toolbar.left >= canvas.left &&
            toolbar.right <= canvas.right &&
            toolbar.top >= canvas.top &&
            toolbar.bottom <= canvas.bottom,
          position: getComputedStyle(toolbarElement).position,
        }
      : null;
  });
  expect(floatingToolbar).toEqual({ insideCanvas: true, position: 'absolute' });
  await expect(page.getByText('Bring an idea to life')).toHaveCount(0);
  await expect(
    page.getByText('Generate, transform, upscale, and refine images with Stability on Bedrock.'),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeVisible();
  const settings = page.getByRole('complementary', { name: 'Generation settings' });
  const settingsPanel = page.locator('.settings-panel');
  await expect(settings).toBeVisible();
  await expect(settingsPanel).toHaveCSS('transition-duration', '0.18s, 0s');
  await expect(settingsPanel).toHaveCSS('transition-timing-function', 'ease, linear');
  const footer = settings.locator('.settings-footer');
  await expect(footer.getByRole('button', { name: 'View request' })).toBeVisible();
  await expect(footer.getByRole('button', { name: 'Get code' })).toBeVisible();
  await expect(footer).toHaveCSS('justify-content', 'center');
  await expect(settings.getByRole('heading', { name: 'Advanced settings' })).toBeVisible();
  await expect(settings.getByText('AWS calls stay server-side')).toHaveCount(0);
  await expect(page.getByText('Run settings')).toHaveCount(0);
  await expect(page.getByText('Configure this generation')).toHaveCount(0);
  const closeSettings = settings.getByRole('button', { name: 'Close advanced settings' });
  await expect(closeSettings).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open advanced settings' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Image repository: Studio Library' }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const topBar = document.querySelector('.top-bar')?.getBoundingClientRect();
        const settingsPanel = document.querySelector('.settings-panel')?.getBoundingClientRect();
        if (!topBar || !settingsPanel) return null;
        return {
          panelTop: Math.round(settingsPanel.top),
          panelBottomGap: Math.round(window.innerHeight - settingsPanel.bottom),
          topBarRightGap: Math.round(settingsPanel.left - topBar.right),
        };
      }),
    )
    .toEqual({ panelTop: 0, panelBottomGap: 0, topBarRightGap: 0 });

  const closeSettingsBounds = await closeSettings.boundingBox();
  await closeSettings.click();
  await expect(settings).toHaveCount(0);
  await expect(settingsPanel).toHaveCSS('visibility', 'hidden');
  const openSettings = page.getByRole('button', { name: 'Open advanced settings' });
  await expect(openSettings).toBeVisible();
  await expect(openSettings).toHaveClass(/is-pointer-hover/);
  await expect(page.locator('button.is-pointer-hover')).toHaveCount(1);
  const openSettingsBounds = await openSettings.boundingBox();
  expect(closeSettingsBounds).not.toBeNull();
  expect(openSettingsBounds).not.toBeNull();
  expect({
    x: Math.round(closeSettingsBounds?.x ?? 0),
    y: Math.round(closeSettingsBounds?.y ?? 0),
  }).toEqual({
    x: Math.round(openSettingsBounds?.x ?? 0),
    y: Math.round(openSettingsBounds?.y ?? 0),
  });
  await openSettings.click();
  await expect(closeSettings).toBeVisible();
  await expect(openSettings).toHaveCount(0);
  await expect
    .poll(async () =>
      settingsPanel.evaluate((element) =>
        Math.round(element.getBoundingClientRect().right - window.innerWidth),
      ),
    )
    .toBe(0);
  await expect(closeSettings).toHaveClass(/is-pointer-hover/);
  await expect(page.locator('button.is-pointer-hover')).toHaveCount(1);

  await page.setViewportSize({ width: 560, height: 620 });
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const topBar = document.querySelector('.top-bar')?.getBoundingClientRect();
        const settingsPanel = document.querySelector('.settings-panel')?.getBoundingClientRect();
        return topBar && settingsPanel ? Math.round(settingsPanel.top - topBar.bottom) : null;
      }),
    )
    .toBe(0);
  await closeSettings.click();
  await expect(settings).toHaveCount(0);
  await expect(settingsPanel).toHaveCSS('visibility', 'hidden');
});

test('omits destination controls from history and gallery', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByLabel('Studio navigation');

  await navigation.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('heading', { name: 'Generation history' })).toBeVisible();
  await expect(page.getByLabel('Image destination')).toHaveCount(0);

  await navigation.getByRole('button', { name: 'Gallery' }).click();
  await expect(page.getByRole('heading', { name: 'Gallery', level: 2 })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Projects' })).toHaveCount(0);
  await expect(page.getByLabel('Image destination')).toHaveCount(0);
});
