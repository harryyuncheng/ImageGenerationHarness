import { expect, test, type Locator } from '@playwright/test';

const REPOSITORY_ID = '99999999-9999-4999-8999-999999999999';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ASSET_ID = '22222222-2222-4222-8222-222222222222';
const RUN_ID = '33333333-3333-4333-8333-333333333333';
const IMAGE_ID = '44444444-4444-4444-8444-444444444444';
const JOB_ID = '55555555-5555-4555-8555-555555555555';
const ATTEMPT_ID = '66666666-6666-4666-8666-666666666666';
const NOW = '2026-08-07T12:00:00.000Z';
const activeRepository = {
  active: { repositoryId: REPOSITORY_ID, name: 'Studio Library' },
  recent: [
    { repositoryId: REPOSITORY_ID, name: 'Studio Library' },
    { repositoryId: '88888888-8888-4888-8888-888888888888', name: 'Archive Library' },
  ],
};

function recentRunSnapshot(options: {
  runId: string;
  jobId: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    run: {
      schemaVersion: 1,
      runId: options.runId,
      status: 'queued',
      registryVersion: 'test-registry',
      targetId: 'generation/core',
      destination: { kind: 'main' },
      requestedJobCount: 1,
      seedPlan: { strategy: 'harness-random' },
      prompt: options.prompt,
      jobIds: [options.jobId],
      createdAt: options.createdAt,
      updatedAt: options.updatedAt,
    },
    jobs: [
      {
        schemaVersion: 1,
        runId: options.runId,
        jobId: options.jobId,
        status: 'queued',
        targetId: 'generation/core',
        destination: { kind: 'main' },
        plannedSeed: null,
        providerSeed: null,
        outputImageIds: [],
        attempts: [],
        createdAt: options.createdAt,
        updatedAt: options.updatedAt,
      },
    ],
  };
}

async function expectSharedSurfaceMotion(surface: Locator) {
  await expect(surface).toHaveClass(/surface-enter/);
  await expect(surface).toHaveCSS('animation-name', 'surface-enter');
  await expect(surface).toHaveCSS('animation-duration', '0.22s');
  await expect(surface).toHaveCSS('animation-timing-function', 'cubic-bezier(0.22, 1, 0.36, 1)');
}

// prettier-ignore
test.beforeEach(async ({ page }) => {
  await page.route('**/api/repository', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(activeRepository) });
  });
  await page.route('**/api/repository/choose', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(activeRepository) });
  });
  await page.route('**/api/repository/activate/**', async (route) => {
    const switched = {
      active: activeRepository.recent[1],
      recent: [activeRepository.recent[1], activeRepository.recent[0]],
    };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(switched) });
  });
  await page.route('**/api/projects', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ projects: [] }) });
  });
  await page.route('**/api/runs**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ runId: RUN_ID, status: 'queued' }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [] }) });
  });
  await page.route('**/api/images**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ images: [] }) });
  });
  await page.route('**/api/reference-library', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ folders: [] }) });
  });
});

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
  await expect(page.locator('.create-greeting')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New image', exact: true })).toBeVisible();
  await expect(
    page.getByLabel('Studio navigation').getByRole('button', { name: 'Create', exact: true }),
  ).toHaveCount(0);
  const composerBottomGap = await page.evaluate(() => {
    const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
    const composer = document.querySelector('.composer-wrap')?.getBoundingClientRect();
    return canvas && composer ? Math.round(canvas.bottom - composer.bottom) : null;
  });
  expect(composerBottomGap).toBe(80);
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

// prettier-ignore
test('shows all generation history newest-first as image-only tiles with a top-right favorite', async ({ page }) => {
  const prompt = 'Sunlit glass house';
  const projectPrompt = 'Minecraft bee';
  const projectRunId = '77777777-7777-4777-8777-777777777777';
  const projectJobId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const projectImageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const projectAttemptId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const projectCreatedAt = '2026-08-08T12:00:00.000Z';
  const snapshot = {
    run: {
      schemaVersion: 1,
      runId: RUN_ID,
      status: 'completed',
      registryVersion: 'test-registry',
      targetId: 'generation/core',
      destination: { kind: 'main' },
      requestedJobCount: 1,
      seedPlan: { strategy: 'harness-random' },
      prompt,
      jobIds: [JOB_ID],
      createdAt: NOW,
      updatedAt: NOW,
    },
    jobs: [{
      schemaVersion: 1,
      runId: RUN_ID,
      jobId: JOB_ID,
      status: 'completed',
      targetId: 'generation/core',
      destination: { kind: 'main' },
      plannedSeed: null,
      providerSeed: null,
      outputImageIds: [IMAGE_ID],
      attempts: [{ attemptId: ATTEMPT_ID, ordinal: 1, status: 'succeeded', startedAt: NOW, finishedAt: NOW }],
      createdAt: NOW,
      updatedAt: NOW,
    }],
  };
  const projectSnapshot = {
    run: {
      ...snapshot.run,
      runId: projectRunId,
      destination: { kind: 'project', projectId: PROJECT_ID },
      prompt: projectPrompt,
      jobIds: [projectJobId],
      createdAt: projectCreatedAt,
      updatedAt: projectCreatedAt,
    },
    jobs: [{
      schemaVersion: 1,
      runId: projectRunId,
      jobId: projectJobId,
      status: 'completed',
      targetId: 'generation/core',
      destination: { kind: 'project', projectId: PROJECT_ID },
      plannedSeed: null,
      providerSeed: null,
      outputImageIds: [projectImageId],
      attempts: [{ attemptId: projectAttemptId, ordinal: 1, status: 'succeeded', startedAt: projectCreatedAt, finishedAt: projectCreatedAt }],
      createdAt: projectCreatedAt,
      updatedAt: projectCreatedAt,
    }],
  };
  await page.route('**/api/runs**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [snapshot, projectSnapshot] }) });
  });
  await page.route('**/api/images/**/content', async (route) => {
    await route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
  });

  await page.goto('/');
  await expect(page.locator('.create-greeting')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Latest run' })).toHaveCount(0);
  await expect(page.getByText('Polling is authoritative for run updates.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reuse', exact: true })).toHaveCount(0);
  await page.getByLabel('Studio navigation').getByRole('button', { name: 'History' }).click();

  const cards = page.locator('.history-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByRole('button', { name: /^Open editor for/ })).toHaveAttribute('aria-label', `Open editor for ${projectPrompt}`);
  await expect(cards.nth(1).getByRole('button', { name: /^Open editor for/ })).toHaveAttribute('aria-label', `Open editor for ${prompt}`);
  const card = cards.first();
  await expect(card).toHaveText('');
  await expect(card.locator('img')).toHaveAttribute('src', `/api/images/${projectImageId}/content`);
  await expect(card.getByRole('button')).toHaveCount(2);
  await expect(page.getByPlaceholder('Search prompts and models')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Grid view' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'List view' })).toHaveCount(0);

  const favorite = card.getByRole('button', { name: 'Add favorite' });
  await expect(favorite).toHaveCSS('position', 'absolute');
  await expect.poll(async () => card.evaluate((element) => {
    const cardBounds = element.getBoundingClientRect();
    const favoriteBounds = element.querySelector('.history-favorite')?.getBoundingClientRect();
    return favoriteBounds ? {
      top: Math.round(favoriteBounds.top - cardBounds.top),
      right: Math.round(cardBounds.right - favoriteBounds.right),
    } : null;
  })).toEqual({ top: 10, right: 10 });
  await favorite.click();
  await expect(card.getByRole('button', { name: 'Remove favorite' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Generation history' })).toBeVisible();

  await card.getByRole('button', { name: `Open editor for ${projectPrompt}` }).click();
  await expect(page.getByRole('tabpanel', { name: 'Image editor' })).toBeVisible();
});

test('orders recent images by latest activity without promoting them when opened', async ({
  page,
}) => {
  const olderPrompt = 'Older image';
  const newerPrompt = 'Newer image';
  let olderUpdatedAt = '2026-08-05T12:00:00.000Z';
  await page.route('**/api/runs**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        runs: [
          recentRunSnapshot({
            runId: RUN_ID,
            jobId: JOB_ID,
            prompt: olderPrompt,
            createdAt: '2026-08-05T12:00:00.000Z',
            updatedAt: olderUpdatedAt,
          }),
          recentRunSnapshot({
            runId: '77777777-7777-4777-8777-777777777777',
            jobId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            prompt: newerPrompt,
            createdAt: '2026-08-06T12:00:00.000Z',
            updatedAt: '2026-08-06T12:00:00.000Z',
          }),
        ],
      }),
    });
  });

  await page.goto('/');
  const recentTabs = page.locator('.recent-tabs').getByRole('tab');
  await expect(recentTabs).toHaveText([newerPrompt, olderPrompt]);

  await page.getByRole('tab', { name: olderPrompt, exact: true }).click();
  await expect(recentTabs).toHaveText([newerPrompt, olderPrompt]);

  olderUpdatedAt = '2026-08-07T12:00:00.000Z';
  await expect(recentTabs).toHaveText([olderPrompt, newerPrompt], { timeout: 7_000 });
});

// prettier-ignore
test('opens the live image editor before generation and loads the completed output into it', async ({ page }) => {
  const prompt = 'Live generation';
  let submitted = false;
  let completed = false;
  await page.route('**/api/runs**', async (route) => {
    if (route.request().method() === 'POST') {
      submitted = true;
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ runId: RUN_ID, status: 'queued' }) });
      return;
    }
    const status = completed ? 'completed' : 'queued';
    const snapshot = {
      run: {
        schemaVersion: 1,
        runId: RUN_ID,
        status,
        registryVersion: 'test-registry',
        targetId: 'generation/core',
        destination: { kind: 'main' },
        requestedJobCount: 1,
        seedPlan: { strategy: 'harness-random' },
        prompt,
        jobIds: [JOB_ID],
        createdAt: NOW,
        updatedAt: NOW,
      },
      jobs: [{
        schemaVersion: 1,
        runId: RUN_ID,
        jobId: JOB_ID,
        status,
        targetId: 'generation/core',
        destination: { kind: 'main' },
        plannedSeed: null,
        providerSeed: null,
        outputImageIds: completed ? [IMAGE_ID] : [],
        attempts: completed ? [{ attemptId: ATTEMPT_ID, ordinal: 1, status: 'succeeded', startedAt: NOW, finishedAt: NOW }] : [],
        createdAt: NOW,
        updatedAt: NOW,
      }],
    };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: submitted ? [snapshot] : [] }) });
  });
  await page.route('**/api/images/**/content', async (route) => {
    await route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
  });

  await page.goto('/');
  await page.getByLabel('Image prompt').fill(prompt);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();

  const editor = page.getByRole('tabpanel', { name: 'Image editor' });
  await expect(editor).toBeVisible();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  const recentTab = page.locator('.recent-block').getByRole('tab', { name: prompt });
  await expect(recentTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.recent-tabs').getByRole('tab').first()).toHaveText(prompt);
  await expect(editor.getByRole('status')).toContainText(/Submitting request|Waiting for the local worker/);
  await expect(editor.locator('.image-editor-preview > img')).toHaveCount(0);

  completed = true;
  const generatedImage = editor.locator('.image-editor-preview > img');
  await expect(generatedImage).toHaveAttribute('src', `/api/images/${IMAGE_ID}/content`, { timeout: 7_000 });
  await expect(generatedImage).toHaveClass(/is-loaded/);
  await expect(editor.getByText('completed', { exact: true })).toBeVisible();

  await editor.getByRole('button', { name: 'Back from image editor' }).click();
  await expect(recentTab).toHaveAttribute('aria-selected', 'false');
  await recentTab.click();
  await expect(page.getByRole('tabpanel', { name: 'Image editor' })).toBeVisible();
  await page.getByRole('tabpanel', { name: 'Image editor' }).getByRole('button', { name: 'Back from image editor' }).click();
  await page.getByLabel('Studio navigation').getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: `Open editor for ${prompt}` }).click();
  await expect(page.getByRole('tabpanel', { name: 'Image editor' })).toBeVisible();
});

// prettier-ignore
test('pops generation errors, discards failed runs, and keeps the draft ready to rerun', async ({ page }) => {
  const prompt = 'Keep this exact draft';
  const error = 'Bedrock rejected this generation';
  let submitted = false;
  let delivered = false;
  await page.route('**/api/runs**', async (route) => {
    if (route.request().method() === 'POST') {
      submitted = true;
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ runId: RUN_ID, status: 'queued' }) });
      return;
    }
    const failures = submitted && !delivered
      ? [{ runId: RUN_ID, error, discarded: true }]
      : [];
    if (failures.length > 0) delivered = true;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [], failures }) });
  });

  await page.goto('/');
  const aspectRatio = page.getByRole('button', { name: 'Aspect ratio' });
  await aspectRatio.click();
  await page.getByRole('option', { name: 'Landscape, 16:9' }).click();
  await page.getByLabel('Image prompt').fill(prompt);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();

  await expect(page.locator('.toast--error')).toContainText(error, { timeout: 7_000 });
  await expect(page.getByRole('tabpanel', { name: 'Image editor' })).toHaveCount(0);
  await expect(page.getByLabel('Image prompt')).toHaveValue(prompt);
  await expect(aspectRatio).toContainText('16:9');
  await expect(page.getByRole('button', { name: 'Generate', exact: true })).toBeEnabled();
  await expect(page.locator('.recent-tabs').getByRole('tab', { name: prompt })).toHaveCount(0);

  await page.getByLabel('Studio navigation').getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.history-card')).toHaveCount(0);
  await expect(page.getByText('No generations here yet')).toBeVisible();
});

test('slides the output format indicator between JPEG, PNG, and WEBP', async ({ page }) => {
  await page.goto('/');
  const outputFormats = page.getByRole('group', { name: 'Output format' });
  const indicator = outputFormats.locator('.segmented-control__indicator');
  const png = outputFormats.getByRole('button', { name: 'PNG', exact: true });
  const webp = outputFormats.getByRole('button', { name: 'WEBP', exact: true });

  await expect(outputFormats.getByRole('button')).toHaveText(['JPEG', 'PNG', 'WEBP']);
  await expect(png).toHaveAttribute('aria-pressed', 'true');
  await expect(indicator).toHaveCSS('transition-property', 'transform');
  await expect(indicator).toHaveCSS('transition-duration', '0.22s');

  const initialTransform = await indicator.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await webp.click();

  await expect(webp).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => indicator.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initialTransform);
});

test('reuses shared entry motion across tabs, menus, panels, and dialogs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');

  await expectSharedSurfaceMotion(page.locator('.canvas > .surface-enter'));

  await page.getByRole('button', { name: 'Image repository: Studio Library' }).click();
  await expectSharedSurfaceMotion(page.locator('.repository-menu'));
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Choose theme' }).click();
  await expectSharedSurfaceMotion(page.locator('.theme-menu'));
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

  await page.getByLabel('Studio navigation').getByRole('button', { name: 'Gallery' }).click();
  await expectSharedSurfaceMotion(page.locator('.canvas > .surface-enter'));
  await page.locator('.library-heading').getByRole('button', { name: 'New project' }).click();
  await expectSharedSurfaceMotion(page.locator('.project-create'));

  await page.setViewportSize({ width: 560, height: 620 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expectSharedSurfaceMotion(page.getByLabel('Mobile studio navigation'));
});

// prettier-ignore
test('opens the editor from a Baroque image or a local upload', async ({ page }) => {
  const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await page.route('**/api/images**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/api/images/${IMAGE_ID}/content`)) {
      await route.fulfill({ contentType: 'image/png', body: imageBytes });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ images: [{ imageId: IMAGE_ID, runId: RUN_ID, mediaType: 'image/png', byteLength: imageBytes.byteLength, createdAt: NOW, prompt: 'Baroque source', targetId: 'generation/core' }] }) });
  });

  await page.goto('/');
  await page.getByLabel('Studio navigation').getByRole('button', { name: 'Edit', exact: true }).click();
  let editor = page.getByRole('tabpanel', { name: 'Image editor' });
  const blankCanvas = editor.getByRole('group', { name: 'Blank editing canvas' });
  let toolsPanel = page.getByRole('complementary', { name: 'Editing tools' });
  await expect(editor).toBeVisible();
  await expect(editor.locator('.library-heading').getByRole('heading', { name: 'Edit' })).toBeVisible();
  await expect(blankCanvas).toBeVisible();
  await expect(toolsPanel).toBeVisible();
  await expect(blankCanvas.getByRole('heading', { name: 'Add an image to edit' })).toBeVisible();
  await expect(blankCanvas.getByRole('button', { name: 'Choose from Baroque' })).toBeVisible();
  await expect(blankCanvas.getByRole('button', { name: 'Upload image' })).toBeVisible();
  let editingTools = toolsPanel.getByRole('group', { name: 'Editing tools' });
  const removeBackground = editingTools.getByRole('button', { name: /Remove Background/ });
  await expect(removeBackground).toBeVisible();
  await removeBackground.click();
  await expect(removeBackground).toHaveAttribute('aria-pressed', 'true');

  await blankCanvas.getByRole('button', { name: 'Choose from Baroque' }).click();
  const picker = page.getByRole('dialog', { name: 'Choose from Baroque' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Open editor for Baroque source' }).click();
  editor = page.getByRole('tabpanel', { name: 'Image editor' });
  toolsPanel = page.getByRole('complementary', { name: 'Editing tools' });
  await expect(editor).toBeVisible();
  await expect(editor.locator('.image-editor-preview img')).toHaveAttribute('src', `/api/images/${IMAGE_ID}/content`);
  await expect(toolsPanel.getByRole('button', { name: 'Start editing' })).toBeVisible();
  editingTools = toolsPanel.getByRole('group', { name: 'Editing tools' });
  await expect(editingTools.getByRole('button', { name: /Remove Background/ })).toHaveAttribute('aria-pressed', 'true');

  await editor.getByRole('button', { name: 'Back from image editor' }).click();
  editor = page.getByRole('tabpanel', { name: 'Image editor' });
  const fileChooserPromise = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Upload image' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'local-source.png',
    mimeType: 'image/png',
    buffer: imageBytes,
  });
  editor = page.getByRole('tabpanel', { name: 'Image editor' });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('heading', { name: 'local-source.png' })).toBeVisible();
  await expect(editor.locator('.image-editor-preview img')).toHaveAttribute('src', /^blob:/);
  await expect(editor.getByRole('button', { name: 'Metadata' })).toHaveCount(0);

  await toolsPanel.getByRole('button', { name: 'Start editing' }).click();
  await expect(page.getByLabel('Image prompt')).toBeVisible();
  await expect(page.locator('.attachment')).toContainText('local-source.png');
  await expect(page.locator('.model-picker')).toContainText('Remove Background');
});

// prettier-ignore
test('keeps the studio usable without a repository and prompts before repository-backed creation', async ({ page }) => {
  let projectRequests = 0;
  let runRequests = 0;
  await page.route('**/api/repository', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ active: null, recent: [] }) });
  });
  await page.route('**/api/projects', async (route) => {
    projectRequests += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'No repository' }) });
  });
  await page.route('**/api/runs**', async (route) => {
    runRequests += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'No repository' }) });
  });
  await page.goto('/');
  await expect(page.locator('.create-greeting')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Generation settings' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Choose where your image work lives' })).toHaveCount(0);
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
  await page.getByLabel('Studio navigation').getByRole('button', { name: 'Gallery' }).click();
  await page.locator('.library-heading').getByRole('button', { name: 'New project' }).click();
  await expect(page.getByRole('heading', { name: 'Create a project' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choose folder' })).toBeVisible();
  expect(projectRequests).toBe(0);
});

// prettier-ignore
test('offers folder selection and recent repository switching', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Image repository: Studio Library' }).click();
  await expect(page.getByRole('button', { name: 'Choose folder' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Baroque home' }).click();
  await expect(page.getByRole('button', { name: 'Choose folder' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Image repository: Studio Library' }).click();
  await page.getByRole('button', { name: /Archive Library/ }).click();
  await expect(page.getByRole('button', { name: 'Image repository: Archive Library' })).toBeVisible();
});

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

test('selects a reusable image from a reference folder', async ({ page }) => {
  const folderId = '83cbfc7d-bdb4-4f8c-adde-ed506a01e125';
  const imageId = 'c66a089f-d441-4368-9eef-bc12d424719f';
  await page.route('**/api/reference-library', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        folders: [
          {
            folderId,
            name: 'Editorial lighting',
            createdAt: '2026-08-06T10:00:00.000Z',
            updatedAt: '2026-08-06T10:00:00.000Z',
            images: [
              {
                folderId,
                imageId,
                name: 'soft-window-light.jpg',
                mediaType: 'image/jpeg',
                byteLength: 1024,
                width: 1200,
                height: 800,
                createdAt: '2026-08-06T10:00:00.000Z',
                updatedAt: '2026-08-06T10:00:00.000Z',
              },
            ],
          },
        ],
      }),
    });
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

// prettier-ignore
test('creates a project and nested asset, then sends the exact prompt only to that destination', async ({ page }) => {
  const project = {
    projectId: PROJECT_ID,
    name: 'Autumn campaign',
    description: 'Warm organizational notes only',
    createdAt: NOW,
    updatedAt: NOW,
  };
  const asset = {
    assetId: ASSET_ID,
    projectId: PROJECT_ID,
    name: 'Hero product',
    description: 'Blue ceramic organizational notes',
    createdAt: NOW,
    updatedAt: NOW,
  };
  let projects: typeof project[] = [];
  let assets: typeof asset[] = [];
  let submission: Record<string, unknown> | undefined;

  await page.route('**/api/projects**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname === '/api/projects') {
      projects = [project];
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(project) });
      return;
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/assets')) {
      assets = [asset];
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(asset) });
      return;
    }
    if (url.pathname === '/api/projects') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ projects }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ project, assets }) });
  });
  await page.route('**/api/runs**', async (route) => {
    if (route.request().method() === 'POST') {
      submission = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ runId: RUN_ID, status: 'queued' }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [] }) });
  });

  await page.goto('/');
  await page.getByLabel('Studio navigation').getByRole('button', { name: 'Gallery' }).click();
  await page.locator('.library-heading').getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('New project name').fill(project.name);
  await page.getByLabel('New project description').fill(project.description);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: project.name, level: 2 })).toBeVisible();

  await page.getByRole('button', { name: 'New asset' }).click();
  await page.getByLabel('Asset name').fill(asset.name);
  await page.getByLabel('Asset description').fill(asset.description);
  await page.getByRole('button', { name: 'Create asset' }).click();
  const assetCard = page.locator('.asset-card').filter({ hasText: asset.name });
  await expect(assetCard).toBeVisible();
  await assetCard.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByText('Save to', { exact: true })).toHaveCount(0);

  const exactPrompt = '  exact prompt spacing  ';
  await page.getByLabel('Image prompt').fill(exactPrompt);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect.poll(() => submission).toBeTruthy();
  expect(submission).toMatchObject({
    destination: { kind: 'project-asset', projectId: PROJECT_ID, projectAssetId: ASSET_ID },
    request: { prompt: exactPrompt },
  });
  expect(JSON.stringify(submission)).not.toContain(project.description);
  expect(JSON.stringify(submission)).not.toContain(asset.description);
});

// prettier-ignore
test('opens the project image editor and remixes to the original destination', async ({ page }) => {
  const project = {
    projectId: PROJECT_ID,
    name: 'Autumn campaign',
    description: 'Warm organizational notes only',
    createdAt: NOW,
    updatedAt: NOW,
  };
  const asset = {
    assetId: ASSET_ID,
    projectId: PROJECT_ID,
    name: 'Hero product',
    description: 'Blue ceramic organizational notes',
    createdAt: NOW,
    updatedAt: NOW,
  };
  let submission: Record<string, unknown> | undefined;
  await page.route('**/api/projects**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(
        url.pathname === '/api/projects' ? { projects: [project] } : { project, assets: [asset] },
      ),
    });
  });
  await page.route('**/api/runs**', async (route) => {
    if (route.request().method() === 'POST') {
      submission = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ runId: RUN_ID, status: 'queued' }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ runs: [] }) });
  });
  await page.route('**/api/images**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/api/images/${IMAGE_ID}/metadata`)) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        schemaVersion: 1,
        imageId: IMAGE_ID,
        repositoryRelativePath: `images/gallery--${IMAGE_ID}.png`,
        createdAt: NOW,
        runId: RUN_ID,
        jobId: JOB_ID,
        attemptId: ATTEMPT_ID,
        capabilityRegistryVersion: '2026-08-06.1',
        canonicalTargetId: 'generation/core',
        invocationId: 'stability.stable-image-core-v1:1',
        prompt: 'Gallery prompt',
        normalizedRequest: { prompt: 'Gallery prompt', output_format: 'png' },
        seed: { strategy: 'harness-random', planned: 123, provider: 123 },
        output: { format: 'png', mediaType: 'image/png', width: 16, height: 16, byteLength: 128, sha256: 'a'.repeat(64) },
        inputs: [],
        provider: { finishReason: null, metadata: {} },
      }) });
      return;
    }
    if (url.pathname.endsWith(`/api/images/${IMAGE_ID}/content`)) {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
      });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ images: [{ imageId: IMAGE_ID, runId: RUN_ID, mediaType: 'image/png', byteLength: 128, createdAt: NOW, prompt: 'Gallery prompt', targetId: 'generation/core', projectId: PROJECT_ID, projectAssetId: ASSET_ID }] }) });
  });
  await page.goto('/');
  await page.getByLabel('Studio navigation').getByRole('button', { name: 'Gallery' }).click();
  await page.getByRole('button', { name: project.name }).click();
  await page.getByRole('button', { name: 'Open editor for Gallery prompt' }).click();
  const editor = page.getByRole('tabpanel', { name: 'Image editor' });
  await expect(editor).toBeVisible();
  await expect(editor.locator('.image-editor-header').getByText(`${project.name} / ${asset.name}`, { exact: true })).toBeVisible();
  await expect(editor.getByRole('link', { name: 'Full screen' })).toHaveAttribute('target', '_blank');
  await editor.getByRole('button', { name: 'Metadata' }).click();
  await expect(page.getByRole('dialog', { name: 'Generated image metadata' })).toContainText(IMAGE_ID);
  await expect(page.getByRole('dialog', { name: 'Generated image metadata' })).toContainText('Gallery prompt');
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await editor.getByRole('button', { name: 'Remix' }).click();
  await expect(page.getByLabel('Image prompt')).toHaveValue('Gallery prompt');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect.poll(() => submission).toBeTruthy();
  expect(submission).toMatchObject({
    destination: { kind: 'project-asset', projectId: PROJECT_ID, projectAssetId: ASSET_ID },
    request: { prompt: 'Gallery prompt' },
  });
});
