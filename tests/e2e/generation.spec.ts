import { fulfillJson, stubImageContent } from './fixtures/api.js';
import { ATTEMPT_ID, IMAGE_ID, JOB_ID, RUN_ID, runSnapshot } from './fixtures/data.js';
import { expect, test } from './fixtures/test.js';

test('opens the live image editor before generation and loads the completed output into it', async ({
  page,
}) => {
  const prompt = 'Live generation';
  let submitted = false;
  let completed = false;
  await page.route('**/api/runs**', async (route) => {
    if (route.request().method() === 'POST') {
      submitted = true;
      await fulfillJson(route, { runId: RUN_ID, status: 'queued' }, 202);
      return;
    }
    const snapshot = runSnapshot({
      runId: RUN_ID,
      jobId: JOB_ID,
      prompt,
      status: completed ? 'completed' : 'queued',
      ...(completed ? { outputImageIds: [IMAGE_ID], attemptId: ATTEMPT_ID } : {}),
    });
    await fulfillJson(route, { runs: submitted ? [snapshot] : [] });
  });
  await stubImageContent(page);

  await page.goto('/');
  await page.getByLabel('Image prompt').fill(prompt);
  await page.getByRole('button', { name: 'Generate', exact: true }).click();

  const editor = page.getByRole('tabpanel', { name: 'Image editor' });
  await expect(editor).toBeVisible();
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: 'Recent image editors' })).toHaveCount(0);
  await expect(editor.getByRole('status')).toContainText(
    /Submitting request|Waiting for the local worker/,
  );
  await expect(editor.locator('.image-editor-preview > img')).toHaveCount(0);

  completed = true;
  const generatedImage = editor.locator('.image-editor-preview > img');
  await expect(generatedImage).toHaveAttribute('src', `/api/images/${IMAGE_ID}/content`, {
    timeout: 7_000,
  });
  await expect(generatedImage).toHaveClass(/is-loaded/);
  await expect(editor.getByText('completed', { exact: true })).toBeVisible();

  await editor.getByRole('button', { name: 'Back from image editor' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Image editor' })).toHaveCount(0);
  await page.getByRole('button', { name: 'View your past creations here' }).click();
  await page.getByRole('button', { name: `Open editor for ${prompt}` }).click();
  await expect(page.getByRole('tabpanel', { name: 'Image editor' })).toBeVisible();
});

test('pops generation errors, discards failed runs, and keeps the draft ready to rerun', async ({
  page,
}) => {
  const prompt = 'Keep this exact draft';
  const error = 'Bedrock rejected this generation';
  let submitted = false;
  let delivered = false;
  await page.route('**/api/runs**', async (route) => {
    if (route.request().method() === 'POST') {
      submitted = true;
      await fulfillJson(route, { runId: RUN_ID, status: 'queued' }, 202);
      return;
    }
    const failures = submitted && !delivered ? [{ runId: RUN_ID, error, discarded: true }] : [];
    if (failures.length > 0) delivered = true;
    await fulfillJson(route, { runs: [], failures });
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

  await page.getByRole('button', { name: 'View your past creations here' }).click();
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
