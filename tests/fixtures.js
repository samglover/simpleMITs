import { test as base, expect } from '@playwright/test';

// Tests run with sync turned off, whatever is in the local (git-ignored)
// assets/js/config.js. Sync tests register their own config route, which
// takes precedence because Playwright checks the newest route first.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/assets/js/config.js*', (route) => {
      route.fulfill({
        contentType: 'text/javascript',
        body: `const SIMPLEMITS_CONFIG = { supabaseUrl: '', supabaseKey: '' };`
      });
    });
    await use(page);
  }
});

export { expect };
