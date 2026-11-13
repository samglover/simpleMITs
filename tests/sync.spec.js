import { test, expect } from '@playwright/test';

// A stand-in for the Supabase client, so sync can be tested without a server.
// State lives on window.__fake; tests read and change it with page.evaluate().
const fakeSupabase = `
window.supabase = {
  createClient() {
    const listeners = [];
    const state = window.__fake = {
      user: null,
      remote: null,
      upserts: [],
      otpEmails: [],
      deleted: false,
      signIn(user) {
        state.user = user;
        listeners.forEach((cb) => cb('SIGNED_IN', { user }));
      }
    };

    return {
      auth: {
        onAuthStateChange(cb) {
          listeners.push(cb);
          setTimeout(() => cb('INITIAL_SESSION', state.user ? { user: state.user } : null), 0);
          return { data: { subscription: { unsubscribe() {} } } };
        },
        async signInWithOtp({ email }) {
          state.otpEmails.push(email);
          return { error: null };
        },
        async signOut() {
          state.user = null;
          listeners.forEach((cb) => cb('SIGNED_OUT', null));
          return { error: null };
        }
      },
      from() {
        return {
          select() {
            return { eq() { return { async maybeSingle() {
              return { data: state.remote ? structuredClone(state.remote) : null, error: null };
            } }; } };
          },
          upsert(row) {
            return { select() { return { async single() {
              // Postgres returns timestamps as +00:00, not Z.
              const updated_at = row.updated_at.replace('Z', '+00:00');
              state.remote = { tasks: structuredClone(row.tasks), updated_at };
              state.upserts.push(structuredClone(row.tasks));
              return { data: { updated_at }, error: null };
            } }; } };
          }
        };
      },
      async rpc(name) {
        if ('delete_account' === name) {
          state.deleted = true;
          state.remote = null;
        }
        return { error: null };
      }
    };
  }
};
`;

const config = `const SIMPLEMITS_CONFIG = { supabaseUrl: 'https://example.supabase.co', supabaseKey: 'test-key' };`;

const user = { id: '00000000-0000-4000-8000-000000000001', email: 'test@example.com' };

function task(n, overrides = {}) {
  return {
    id: `${n}0000000-0000-4000-8000-000000000000`,
    date: '2026-11-01T12:00:00.000Z',
    description: `Task ${n}`,
    completed: false,
    ...overrides
  };
}

async function setUp(page, { localTasks = [], remote = null } = {}) {
  await page.route('**/includes/supabase/*.js', (route) => {
    route.fulfill({ contentType: 'text/javascript', body: fakeSupabase });
  });
  await page.route('**/assets/js/config.js*', (route) => {
    route.fulfill({ contentType: 'text/javascript', body: config });
  });

  await page.goto('/');
  await page.evaluate((tasks) => {
    localStorage.clear();
    if (tasks.length) localStorage.setItem('simpleMITs', JSON.stringify(tasks));
  }, localTasks);
  await page.reload();

  if (remote) await page.evaluate((r) => { window.__fake.remote = r; }, remote);
}

async function signIn(page) {
  await page.evaluate((u) => window.__fake.signIn(u), user);
}

function descriptions(page) {
  return page.locator('.task-description').allTextContents();
}

function remoteDescriptions(page) {
  return page.evaluate(() => {
    const remote = window.__fake.remote;
    return remote ? remote.tasks.map((t) => t.description) : null;
  });
}

function addTask(page, text) {
  return page.fill('#add-task-input', text).then(() => page.press('#add-task-input', 'Enter'));
}


test.describe('without Supabase settings', () => {
  test('the Sync button is hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#sync-button')).toBeHidden();
  });
});

test.describe('with Supabase settings', () => {
  test('the Sync button opens a sign-in form that sends a link', async ({ page }) => {
    await setUp(page);

    await page.locator('#sync-button').click();
    await expect(page.locator('#sync-signed-out')).toBeVisible();

    await page.fill('#sync-email-input', 'test@example.com');
    await page.press('#sync-email-input', 'Enter');

    await expect(page.locator('#sync-sign-in-message')).toHaveText('Check test@example.com for a sign-in link.');
    expect(await page.evaluate(() => window.__fake.otpEmails)).toEqual(['test@example.com']);
  });

  test('signing in shows the account and uploads local tasks when the server has none', async ({ page }) => {
    await setUp(page, { localTasks: [task(1), task(2)] });
    await signIn(page);

    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1', 'Task 2']);

    await page.locator('#sync-button').click();
    await expect(page.locator('#sync-email')).toHaveText('test@example.com');
    await expect(page.locator('#sync-status')).toContainText('Last synced');
  });

  test('first sign-in combines local and server tasks without duplicates', async ({ page }) => {
    await setUp(page, {
      localTasks: [task(1), task(3)],
      remote: { tasks: [task(1), task(2)], updated_at: '2026-11-01T12:00:00+00:00' }
    });
    await signIn(page);

    await expect.poll(() => descriptions(page)).toEqual(['Task 1', 'Task 2', 'Task 3']);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1', 'Task 2', 'Task 3']);
  });

  test('first sign-in on an empty device downloads server tasks without uploading', async ({ page }) => {
    await setUp(page, {
      remote: { tasks: [task(1), task(2)], updated_at: '2026-11-01T12:00:00+00:00' }
    });
    await signIn(page);

    await expect.poll(() => descriptions(page)).toEqual(['Task 1', 'Task 2']);
    expect(await page.evaluate(() => window.__fake.upserts.length)).toBe(0);
  });

  test('quick local changes upload once, after a short delay', async ({ page }) => {
    await setUp(page);
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual([]);
    const uploadsBefore = await page.evaluate(() => window.__fake.upserts.length);

    await addTask(page, 'First');
    await addTask(page, 'Second');
    await addTask(page, 'Third');

    await expect.poll(() => remoteDescriptions(page)).toEqual(['First', 'Second', 'Third']);
    expect(await page.evaluate(() => window.__fake.upserts.length)).toBe(uploadsBefore + 1);
  });

  test('changes from another device appear when the app comes back into view', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);

    // Another device saves a newer list.
    await page.evaluate((tasks) => {
      window.__fake.remote = { tasks, updated_at: new Date(Date.now() + 60000).toISOString().replace('Z', '+00:00') };
      document.dispatchEvent(new Event('visibilitychange'));
    }, [task(1, { completed: true }), task(2)]);

    await expect.poll(() => descriptions(page)).toEqual(['Task 2', 'Task 1']);
    await expect(page.locator('.task').nth(1)).toHaveClass(/completed/);
  });

  test('when both devices changed, the newer change wins', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);

    // An older change from another device lands on the server...
    await page.evaluate((tasks) => {
      window.__fake.remote = { tasks, updated_at: new Date(Date.now() - 60000).toISOString().replace('Z', '+00:00') };
    }, [task(1), task(9)]);

    // ...but this device's change is newer, so it wins.
    await addTask(page, 'Local');
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1', 'Local']);
    expect(await descriptions(page)).toEqual(['Task 1', 'Local']);
  });

  test('editing a task while a remote change arrives keeps the edit in progress', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);

    await page.locator('.task-description').click();
    await page.evaluate((tasks) => {
      window.__fake.remote = { tasks, updated_at: new Date(Date.now() + 60000).toISOString().replace('Z', '+00:00') };
      document.dispatchEvent(new Event('visibilitychange'));
    }, [task(1), task(2)]);

    // The list doesn't re-render mid-edit...
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('simpleMITs')).length)).toBe(2);
    await expect(page.locator('.task')).toHaveCount(1);
    await expect(page.locator('.task-description')).toBeFocused();

    // ...and shows the remote change once the edit ends.
    await page.keyboard.press('Escape');
    await expect.poll(() => descriptions(page)).toEqual(['Task 1', 'Task 2']);
  });

  test('signing out keeps local tasks and stops syncing', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);

    await page.locator('#sync-button').click();
    await page.locator('#sync-sign-out-button').click();

    await expect(page.locator('#sync-signed-out')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('simpleMITs_sync'))).toBeNull();
    expect(await descriptions(page)).toEqual(['Task 1']);

    const uploadsBefore = await page.evaluate(() => window.__fake.upserts.length);
    await page.locator('#sync-modal .close-modal').click();
    await addTask(page, 'After sign-out');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__fake.upserts.length)).toBe(uploadsBefore);
  });

  test('deleting the account asks first, then removes server data and keeps local tasks', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);

    await page.locator('#sync-button').click();

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.locator('#sync-delete-button').click();
    expect(await page.evaluate(() => window.__fake.deleted)).toBe(false);

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#sync-delete-button').click();

    await expect(page.locator('#sync-signed-out')).toBeVisible();
    expect(await page.evaluate(() => window.__fake.deleted)).toBe(true);
    expect(await descriptions(page)).toEqual(['Task 1']);
  });
});
