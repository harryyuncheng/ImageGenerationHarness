import { expect, type Locator } from '@playwright/test';

/** Every entering surface reuses one shared animation. */
export async function expectSharedSurfaceMotion(surface: Locator): Promise<void> {
  await expect(surface).toHaveClass(/surface-enter/);
  await expect(surface).toHaveCSS('animation-name', 'surface-enter');
  await expect(surface).toHaveCSS('animation-duration', '0.22s');
  await expect(surface).toHaveCSS('animation-timing-function', 'cubic-bezier(0.22, 1, 0.36, 1)');
}
