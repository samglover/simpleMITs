import { test, expect } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('?modal=faq opens the FAQ on load', async ({ page }) => {
  await page.goto('/?modal=faq');
  await expect(page.locator('#faq')).toBeVisible();
});

test('closing a modal removes the modal parameter and keeps the others', async ({ page }) => {
  await page.goto('/?modal=faq&utm_source=test');
  await expect(page.locator('#faq')).toBeVisible();

  await page.locator('#faq .close-modal').click();
  await expect(page.locator('#faq')).toBeHidden();
  expect(new URL(page.url()).search).toBe('?utm_source=test');

  await page.reload();
  await page.waitForLoadState('load');
  await expect(page.locator('#faq')).toBeHidden();
});

test('pressing Escape also removes the modal parameter', async ({ page }) => {
  await page.goto('/?modal=faq');
  await expect(page.locator('#faq')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('#faq')).toBeHidden();
  expect(new URL(page.url()).search).toBe('');
});

test('?modal opens nothing for an unknown modal', async ({ page }) => {
  await page.goto('/?modal=not-a-modal');
  await page.waitForLoadState('load');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('?modal opens nothing when the modal button is hidden', async ({ page }) => {
  // Sync is off in tests, so the Sync button stays hidden.
  await page.goto('/?modal=sync');
  await page.waitForLoadState('load');
  await expect(page.locator('#sync')).toBeHidden();
});

test('modal buttons still open their modals', async ({ page }) => {
  await page.goto('/');
  await page.locator('.faq-button').click();
  await expect(page.locator('#faq')).toBeVisible();
});
