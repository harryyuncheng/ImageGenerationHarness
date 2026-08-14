import type { Page, Route } from '@playwright/test';
import { RUN_ID, activeRepository, transparentPngBytes } from './data.js';

export async function fulfillJson(route: Route, body: unknown, status?: number): Promise<void> {
  await route.fulfill({
    ...(status === undefined ? {} : { status }),
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function fulfillPng(route: Route): Promise<void> {
  await route.fulfill({ contentType: 'image/png', body: transparentPngBytes });
}

/**
 * The default loopback studio: an active repository with no projects, runs,
 * images, or references. Specs layer more specific routes on top.
 */
export async function installStudioRoutes(page: Page): Promise<void> {
  await page.route('**/api/repository', async (route) => {
    await fulfillJson(route, activeRepository);
  });
  await page.route('**/api/repository/choose', async (route) => {
    await fulfillJson(route, activeRepository);
  });
  await page.route('**/api/repository/activate/**', async (route) => {
    await fulfillJson(route, {
      active: activeRepository.recent[1],
      recent: [activeRepository.recent[1], activeRepository.recent[0]],
    });
  });
  await page.route('**/api/projects', async (route) => {
    await fulfillJson(route, { projects: [] });
  });
  await page.route('**/api/runs**', async (route) => {
    if (route.request().method() === 'POST') {
      await fulfillJson(route, { runId: RUN_ID, status: 'queued' }, 202);
      return;
    }
    await fulfillJson(route, { runs: [] });
  });
  await page.route('**/api/images**', async (route) => {
    await fulfillJson(route, { images: [] });
  });
  await page.route('**/api/reference-library', async (route) => {
    await fulfillJson(route, { folders: [] });
  });
}

/** Serves a tiny PNG for every saved image content request. */
export async function stubImageContent(page: Page): Promise<void> {
  await page.route('**/api/images/**/content', async (route) => {
    await fulfillPng(route);
  });
}

export interface RunSubmissionRecorder {
  current?: Record<string, unknown>;
}

/** Captures the exact payload the browser submits to the local control plane. */
export async function recordRunSubmissions(page: Page): Promise<RunSubmissionRecorder> {
  const recorder: RunSubmissionRecorder = {};
  await page.route('**/api/runs**', async (route) => {
    if (route.request().method() === 'POST') {
      recorder.current = route.request().postDataJSON() as Record<string, unknown>;
      await fulfillJson(route, { runId: RUN_ID, status: 'queued' }, 202);
      return;
    }
    await fulfillJson(route, { runs: [] });
  });
  return recorder;
}
