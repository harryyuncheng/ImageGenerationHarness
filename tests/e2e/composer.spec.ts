import { expect, test } from './fixtures/test.js';

test('aligns the prompt and toolbar to the workspace centerline', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const centerline = () =>
    page.evaluate(() => {
      const shell = document.querySelector('.studio-shell');
      const navigation = document.querySelector('.left-rail')?.getBoundingClientRect();
      const prompt = document.querySelector('.prompt-canvas-field')?.getBoundingClientRect();
      const toolbar = document.querySelector('.generation-toolbar')?.getBoundingClientRect();
      const panel = document.querySelector('.settings-panel')?.getBoundingClientRect();
      if (!shell || !navigation || !prompt || !toolbar || !panel) return null;
      const panelWidth = shell.classList.contains('studio-shell--panel-open') ? panel.width : 0;
      const navigationWidth = navigation.width;
      const expected = (window.innerWidth + navigationWidth - panelWidth) / 2;
      const promptCenter = prompt.left + prompt.width / 2;
      const toolbarCenter = toolbar.left + toolbar.width / 2;
      return {
        aligned: Math.abs(promptCenter - toolbarCenter) <= 1,
        centered: Math.abs(promptCenter - expected) <= 1,
        navigationWidth,
        promptCenter,
      };
    });

  await expect.poll(centerline).toMatchObject({ aligned: true, centered: true });
  const expandedCenter = (await centerline())?.promptCenter;
  expect(expandedCenter).toBeDefined();

  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect
    .poll(centerline)
    .toMatchObject({ aligned: true, centered: true, navigationWidth: 72 });
  const collapsedCenter = (await centerline())?.promptCenter;
  expect(collapsedCenter).toBeDefined();
  expect((expandedCenter ?? 0) - (collapsedCenter ?? 0)).toBeCloseTo(88, 0);

  await page.getByRole('button', { name: 'Close advanced settings' }).click();
  await expect.poll(centerline).toMatchObject({ aligned: true, centered: true });
  expect((await centerline())?.promptCenter).toBeCloseTo(676, 0);

  await page.getByRole('button', { name: 'Open advanced settings' }).click();
  await expect.poll(centerline).toMatchObject({ aligned: true, centered: true });
  expect((await centerline())?.promptCenter).toBeCloseTo(collapsedCenter ?? 0, 0);
});

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
  const composer = page.getByRole('toolbar', { name: 'Generation toolbar' });
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

test('uses the greeting as a muted prompt and momentum-snaps the toolbar', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');

  const prompt = page.getByLabel('Image prompt');
  const placeholder = await prompt.getAttribute('placeholder');
  expect(placeholder?.length).toBeGreaterThan(0);
  const oneLineGreetingAlignment = await page
    .locator('.prompt-canvas-placeholder')
    .evaluate((element) => {
      const input = document.querySelector('.prompt-canvas-input');
      const field = element.parentElement;
      if (!(input instanceof HTMLTextAreaElement) || !(field instanceof HTMLDivElement)) {
        return { centerDelta: Number.POSITIVE_INFINITY, inputStartDelta: Number.POSITIVE_INFINITY };
      }
      const originalText = element.textContent;
      const originalPlaceholder = input.placeholder;
      element.textContent = 'Late hours, vivid ideas';
      input.placeholder = 'Late hours, vivid ideas';
      const range = document.createRange();
      range.selectNodeContents(element);
      const greetingBounds = range.getBoundingClientRect();
      const fieldBounds = field.getBoundingClientRect();
      const inputBounds = input.getBoundingClientRect();
      const alignment = {
        centerDelta: Math.abs(
          greetingBounds.left +
            greetingBounds.width / 2 -
            (fieldBounds.left + fieldBounds.width / 2),
        ),
        inputStartDelta: Math.abs(greetingBounds.left - inputBounds.left),
      };
      element.textContent = originalText;
      input.placeholder = originalPlaceholder;
      return alignment;
    });
  expect(oneLineGreetingAlignment.centerDelta).toBeLessThanOrEqual(1);
  expect(oneLineGreetingAlignment.inputStartDelta).toBeLessThanOrEqual(1);
  const promptColors = await prompt.evaluate((element) => ({
    placeholder: getComputedStyle(element, '::placeholder').color,
    text: getComputedStyle(element).color,
  }));
  expect(promptColors.placeholder).not.toBe(promptColors.text);
  await prompt.focus();
  expect(
    await prompt.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        borderWidth: style.borderWidth,
        outlineStyle: style.outlineStyle,
        textAlign: style.textAlign,
      };
    }),
  ).toEqual({ borderWidth: '0px', outlineStyle: 'none', textAlign: 'left' });
  expect(
    await prompt.evaluate((element) => {
      const animation = element
        .getAnimations()
        .find(
          (candidate) =>
            candidate instanceof CSSAnimation && candidate.animationName === 'prompt-caret-blink',
        );
      return {
        caretAnimation: getComputedStyle(element).getPropertyValue('caret-animation'),
        duration: animation?.effect?.getTiming().duration,
      };
    }),
  ).toEqual({ caretAnimation: 'manual', duration: 1400 });
  await prompt.fill('A glass observatory above a quiet cloud sea');
  await expect(prompt).toHaveValue('A glass observatory above a quiet cloud sea');
  await expect(page.locator('.composer')).toHaveCount(0);

  const toolbar = page.getByRole('toolbar', { name: 'Generation toolbar' });
  await expect(toolbar).toHaveCSS('padding', '3px');
  await expect(toolbar).toHaveAttribute('data-snap-duration', '300');
  await expect(toolbar.getByRole('group', { name: 'Prompt resources' })).toBeVisible();
  await expect(toolbar.getByRole('group', { name: 'Output setup' })).toBeVisible();
  await expect(toolbar.locator('.toolbar-privacy')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const input = document.querySelector('.prompt-canvas-input')?.getBoundingClientRect();
        const placeholder = document
          .querySelector('.prompt-canvas-placeholder')
          ?.getBoundingClientRect();
        if (!input || !placeholder) return null;
        return Math.abs(placeholder.left - input.left);
      }),
    )
    .toBeLessThanOrEqual(1);
  await expect(toolbar.locator('.model-glyph')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const moveHandle = page.getByRole('button', { name: 'Move generation toolbar' });
  const workspace = page.locator('.prompt-workspace');
  const snapTargets = [
    { position: 'top', movementX: 0, movementY: -80 },
    { position: 'right', movementX: 80, movementY: 0 },
    { position: 'bottom', movementX: 0, movementY: 80 },
    { position: 'left', movementX: -80, movementY: 0 },
  ] as const;

  for (const target of snapTargets) {
    const boundary = await workspace.boundingBox();
    const handle = await moveHandle.boundingBox();
    expect(boundary).not.toBeNull();
    expect(handle).not.toBeNull();
    if (!boundary || !handle) return;
    const handleX = handle.x + handle.width / 2;
    const handleY = handle.y + handle.height / 2;
    await page.mouse.move(handleX, handleY);
    await page.mouse.down();
    await page.mouse.move(handleX + target.movementX, handleY + target.movementY, { steps: 4 });
    await page.mouse.up();
    await expect(toolbar).toHaveAttribute('data-position', target.position);
    await expect(toolbar).toHaveAttribute(
      'data-orientation',
      target.position === 'top' || target.position === 'bottom' ? 'horizontal' : 'vertical',
    );
    await expect.poll(() => toolbar.evaluate((element) => element.getAnimations().length)).toBe(0);
    const edgeGap = await page.evaluate((position) => {
      const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
      const navigation = document.querySelector('.left-rail')?.getBoundingClientRect();
      const panel = document.querySelector('.settings-panel')?.getBoundingClientRect();
      const toolbarBounds = document.querySelector('.generation-toolbar')?.getBoundingClientRect();
      if (!canvas || !navigation || !panel || !toolbarBounds) return null;
      if (position === 'top') return toolbarBounds.top;
      if (position === 'right') return panel.left - toolbarBounds.right;
      if (position === 'bottom') return window.innerHeight - toolbarBounds.bottom;
      return toolbarBounds.left - navigation.right;
    }, target.position);
    expect(edgeGap).not.toBeNull();
    expect(edgeGap).toBeCloseTo(24, 0);
    if (target.position === 'top') {
      const stationaryHandle = await moveHandle.boundingBox();
      const stationaryToolbar = await toolbar.boundingBox();
      expect(stationaryHandle).not.toBeNull();
      expect(stationaryToolbar).not.toBeNull();
      if (!stationaryHandle || !stationaryToolbar) return;
      await page.mouse.move(
        stationaryHandle.x + stationaryHandle.width / 2,
        stationaryHandle.y + stationaryHandle.height / 2,
      );
      await page.mouse.down();
      const pressedToolbar = await toolbar.boundingBox();
      expect(Math.abs((pressedToolbar?.y ?? 0) - stationaryToolbar.y)).toBeLessThanOrEqual(1);
      await page.mouse.up();
      await expect(toolbar).toHaveAttribute('data-position', 'top');
    }
  }

  const proximityBoundary = await workspace.boundingBox();
  const proximityHandle = await moveHandle.boundingBox();
  expect(proximityBoundary).not.toBeNull();
  expect(proximityHandle).not.toBeNull();
  if (!proximityBoundary || !proximityHandle) return;
  const proximityY = proximityBoundary.y + proximityBoundary.height / 2;
  await page.mouse.move(
    proximityHandle.x + proximityHandle.width / 2,
    proximityHandle.y + proximityHandle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(proximityBoundary.x + proximityBoundary.width - 5, proximityY, {
    steps: 6,
  });
  await page.waitForTimeout(170);
  await page.mouse.move(proximityBoundary.x + proximityBoundary.width - 24, proximityY, {
    steps: 4,
  });
  await page.mouse.up();
  await expect(toolbar).toHaveAttribute('data-position', 'right');
  await expect.poll(() => toolbar.evaluate((element) => element.getAnimations().length)).toBe(0);

  await expect(toolbar.locator('.model-picker-copy')).toBeHidden();
  await expect(toolbar.locator('.composer-setting-value').first()).toBeHidden();
  await expect(toolbar.locator('.generate-button > span')).toBeHidden();
  await expect(toolbar).toHaveCSS('gap', '5px');
  await expect(toolbar.locator('.generation-toolbar-controls')).toHaveCSS('gap', '5px');
  await expect(toolbar).toHaveCSS('padding-left', '3px');
  await expect(toolbar).toHaveCSS('padding-right', '3px');
  expect(
    await toolbar
      .locator('button:not(.generate-button)')
      .evaluateAll((buttons) =>
        Array.from(new Set(buttons.map((button) => getComputedStyle(button).backgroundColor))),
      ),
  ).toEqual(['rgba(0, 0, 0, 0)']);
  await expect(toolbar.locator('.toolbar-control-group').first()).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await expect(toolbar.locator('.generate-button')).not.toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  const verticalSize = await toolbar.boundingBox();
  const workspaceSize = await workspace.boundingBox();
  expect(verticalSize).not.toBeNull();
  expect(workspaceSize).not.toBeNull();
  expect((verticalSize?.height ?? 0) / (workspaceSize?.height ?? 1)).toBeLessThan(0.75);
  expect(
    await toolbar.evaluate((element) => {
      const toolbarBounds = element.getBoundingClientRect();
      const toolbarCenter = toolbarBounds.left + toolbarBounds.width / 2;
      const controls = element.querySelectorAll(
        '.toolbar-drag-handle, .model-picker, .toolbar-control-group, .generate-button',
      );
      return Math.max(
        ...Array.from(controls, (control) => {
          const bounds = control.getBoundingClientRect();
          return Math.abs(bounds.left + bounds.width / 2 - toolbarCenter);
        }),
      );
    }),
  ).toBeLessThanOrEqual(1);
  await page.locator('.model-picker').click();
  await expect(page.locator('.model-menu')).toContainText('Stable Diffusion 3.5 Large');
  await page.keyboard.press('Escape');
  await toolbar.getByRole('button', { name: 'Aspect ratio' }).click();
  await expect(page.getByRole('listbox', { name: 'Image dimensions' })).toContainText('Landscape');
  await page.keyboard.press('Escape');

  await moveHandle.focus();
  await page.keyboard.press('Home');
  await expect(toolbar).toHaveAttribute('data-position', 'bottom');
  await expect(toolbar).toHaveAttribute('data-orientation', 'horizontal');
  await expect(toolbar.locator('.model-picker-copy')).toBeVisible();
  await expect(toolbar.locator('.generate-button > span')).toBeVisible();
});
