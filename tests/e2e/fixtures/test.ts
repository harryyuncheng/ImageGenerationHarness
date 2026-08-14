import { test as base } from '@playwright/test';
import { installStudioRoutes } from './api.js';

/** Every studio spec starts from the same mocked loopback API surface. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await installStudioRoutes(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
