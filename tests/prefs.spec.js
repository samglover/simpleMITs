import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

function rootSize(page) {
  return page.locator('.page-container').evaluate((el) => {
    return getComputedStyle(el).getPropertyValue('--root-size').trim();
  });
}

function savedPrefs(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('simpleMITs_prefs')));
}

test('text size defaults to 16px', async ({ page }) => {
  expect(await rootSize(page)).toBe('16px');
});

test('increase text size button enlarges text and saves it to prefs', async ({ page }) => {
  await page.locator('.increase-size-button').click();

  expect(await rootSize(page)).toBe('18px');
  expect((await savedPrefs(page)).size).toBe('18px');

  await page.reload();
  expect(await rootSize(page)).toBe('18px');
});

test('decrease text size button shrinks text and saves it to prefs', async ({ page }) => {
  await page.locator('.decrease-size-button').click();

  expect(await rootSize(page)).toBe('14px');
  expect((await savedPrefs(page)).size).toBe('14px');

  await page.reload();
  expect(await rootSize(page)).toBe('14px');
});

test('increase text size button is disabled at the maximum size, including after reload', async ({ page }) => {
  // 16px to 26px in 2px steps
  for (let i = 0; i < 5; i++) {
    await page.locator('.increase-size-button').click();
  }

  expect(await rootSize(page)).toBe('26px');
  await expect(page.locator('.increase-size-button')).toBeDisabled();

  await page.reload();
  await expect(page.locator('.increase-size-button')).toBeDisabled();

  await page.locator('.decrease-size-button').click();
  await expect(page.locator('.increase-size-button')).toBeEnabled();
});

test('decrease text size button is disabled at the minimum size, including after reload', async ({ page }) => {
  // 16px to 10px in 2px steps
  for (let i = 0; i < 3; i++) {
    await page.locator('.decrease-size-button').click();
  }

  expect(await rootSize(page)).toBe('10px');
  await expect(page.locator('.decrease-size-button')).toBeDisabled();

  await page.reload();
  await expect(page.locator('.decrease-size-button')).toBeDisabled();

  await page.locator('.increase-size-button').click();
  await expect(page.locator('.decrease-size-button')).toBeEnabled();
});

test('maximize/minimize button toggles the layout and saves it to prefs', async ({ page }) => {
  const button = page.locator('.max-min-button');
  await expect(page.locator('.page-container')).not.toHaveClass(/maximized/);
  await expect(button.locator('.screen-reader-text')).toHaveText('Maximize');

  await button.click();
  await expect(page.locator('.page-container')).toHaveClass(/maximized/);
  await expect(button.locator('.screen-reader-text')).toHaveText('Minimize');
  expect((await savedPrefs(page)).maximized).toBe(true);

  await page.reload();
  await expect(page.locator('.page-container')).toHaveClass(/maximized/);

  await button.click();
  await expect(page.locator('.page-container')).not.toHaveClass(/maximized/);
  await expect(button.locator('.screen-reader-text')).toHaveText('Maximize');
  expect((await savedPrefs(page)).maximized).toBe(false);

  await page.reload();
  await expect(page.locator('.page-container')).not.toHaveClass(/maximized/);
});
