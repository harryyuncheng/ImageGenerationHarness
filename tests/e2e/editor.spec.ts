import { fulfillJson, fulfillPng } from './fixtures/api.js';
import { IMAGE_ID, galleryImage, transparentPngBytes } from './fixtures/data.js';
import { expect, test } from './fixtures/test.js';

test('opens the editor from a Baroque image or a local upload', async ({ page }) => {
  await page.route('**/api/images**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/api/images/${IMAGE_ID}/content`)) {
      await fulfillPng(route);
      return;
    }
    await fulfillJson(route, { images: [galleryImage()] });
  });

  await page.goto('/');
  await page
    .getByLabel('Studio navigation')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  let editor = page.getByRole('tabpanel', { name: 'Image editor' });
  const blankCanvas = editor.getByRole('group', { name: 'Blank editing canvas' });
  let toolsPanel = page.getByRole('complementary', { name: 'Editing tools' });
  await expect(editor).toBeVisible();
  await expect(
    editor.locator('.library-heading').getByRole('heading', { name: 'Edit' }),
  ).toBeVisible();
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
  await expect(editor.locator('.image-editor-preview img')).toHaveAttribute(
    'src',
    `/api/images/${IMAGE_ID}/content`,
  );
  await expect(toolsPanel.getByRole('button', { name: 'Start editing' })).toBeVisible();
  editingTools = toolsPanel.getByRole('group', { name: 'Editing tools' });
  await expect(editingTools.getByRole('button', { name: /Remove Background/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await editor.getByRole('button', { name: 'Back from image editor' }).click();
  editor = page.getByRole('tabpanel', { name: 'Image editor' });
  const fileChooserPromise = page.waitForEvent('filechooser');
  await editor.getByRole('button', { name: 'Upload image' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'local-source.png',
    mimeType: 'image/png',
    buffer: transparentPngBytes,
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
