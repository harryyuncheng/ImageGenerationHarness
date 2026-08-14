import { fulfillJson, stubImageContent } from './fixtures/api.js';
import {
  IMAGE_ID,
  JOB_ID,
  NOW,
  PROJECT_ID,
  RUN_ID,
  SECOND_ATTEMPT_ID,
  SECOND_IMAGE_ID,
  SECOND_JOB_ID,
  SECOND_RUN_ID,
  ATTEMPT_ID,
  runSnapshot,
} from './fixtures/data.js';
import { expect, test } from './fixtures/test.js';

test('shows all generation history newest-first as image-only tiles with a top-right favorite', async ({
  page,
}) => {
  const prompt = 'Sunlit glass house';
  const projectPrompt = 'Minecraft bee';
  const projectCreatedAt = '2026-08-08T12:00:00.000Z';
  const snapshot = runSnapshot({
    runId: RUN_ID,
    jobId: JOB_ID,
    prompt,
    status: 'completed',
    outputImageIds: [IMAGE_ID],
    attemptId: ATTEMPT_ID,
  });
  const projectSnapshot = runSnapshot({
    runId: SECOND_RUN_ID,
    jobId: SECOND_JOB_ID,
    prompt: projectPrompt,
    status: 'completed',
    createdAt: projectCreatedAt,
    destination: { kind: 'project', projectId: PROJECT_ID },
    outputImageIds: [SECOND_IMAGE_ID],
    attemptId: SECOND_ATTEMPT_ID,
  });
  await page.route('**/api/runs**', async (route) => {
    await fulfillJson(route, { runs: [snapshot, projectSnapshot] });
  });
  await stubImageContent(page);

  await page.goto('/');
  await expect(page.locator('.create-greeting')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Latest run' })).toHaveCount(0);
  await expect(page.getByText('Polling is authoritative for run updates.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reuse', exact: true })).toHaveCount(0);
  await page.getByLabel('Studio navigation').getByRole('button', { name: 'History' }).click();

  const cards = page.locator('.history-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).getByRole('button', { name: /^Open editor for/ })).toHaveAttribute(
    'aria-label',
    `Open editor for ${projectPrompt}`,
  );
  await expect(cards.nth(1).getByRole('button', { name: /^Open editor for/ })).toHaveAttribute(
    'aria-label',
    `Open editor for ${prompt}`,
  );
  const card = cards.first();
  await expect(card).toHaveText('');
  await expect(card.locator('img')).toHaveAttribute(
    'src',
    `/api/images/${SECOND_IMAGE_ID}/content`,
  );
  await expect(card.getByRole('button')).toHaveCount(2);
  await expect(page.getByPlaceholder('Search prompts and models')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Grid view' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'List view' })).toHaveCount(0);

  const favorite = card.getByRole('button', { name: 'Add favorite' });
  await expect(favorite).toHaveCSS('position', 'absolute');
  await expect
    .poll(async () =>
      card.evaluate((element) => {
        const cardBounds = element.getBoundingClientRect();
        const favoriteBounds = element.querySelector('.history-favorite')?.getBoundingClientRect();
        return favoriteBounds
          ? {
              top: Math.round(favoriteBounds.top - cardBounds.top),
              right: Math.round(cardBounds.right - favoriteBounds.right),
            }
          : null;
      }),
    )
    .toEqual({ top: 10, right: 10 });
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
    await fulfillJson(route, {
      runs: [
        runSnapshot({
          runId: RUN_ID,
          jobId: JOB_ID,
          prompt: olderPrompt,
          createdAt: '2026-08-05T12:00:00.000Z',
          updatedAt: olderUpdatedAt,
        }),
        runSnapshot({
          runId: SECOND_RUN_ID,
          jobId: SECOND_JOB_ID,
          prompt: newerPrompt,
          createdAt: '2026-08-06T12:00:00.000Z',
          updatedAt: '2026-08-06T12:00:00.000Z',
        }),
      ],
    });
  });

  await page.goto('/');
  const recentTabs = page.locator('.recent-tabs').getByRole('tab');
  await expect(recentTabs).toHaveText([newerPrompt, olderPrompt]);

  await page.getByRole('tab', { name: olderPrompt, exact: true }).click();
  await expect(recentTabs).toHaveText([newerPrompt, olderPrompt]);

  olderUpdatedAt = NOW;
  await expect(recentTabs).toHaveText([olderPrompt, newerPrompt], { timeout: 7_000 });
});
