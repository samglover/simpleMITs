import { test, expect } from './fixtures.js';

// A stand-in for the Supabase client, so sync can be tested without a server.
// State lives on window.__fake; tests read and change it with page.evaluate().
const fakeSupabase = `
// Responses arrive on a later turn of the event loop, as real network
// responses do, so other code can run while a request is in progress.
function networkDelay() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

window.supabase = {
  createClient() {
    const listeners = [];
    const state = window.__fake = {
      user: null,
      remote: null,
      upserts: [],
      otpEmails: [],
      verifyCalls: [],
      deleted: false,
      signIn(user) {
        state.user = user;
        listeners.forEach((cb) => cb('SIGNED_IN', { user }));
      },
      // Ends the session without signing out, as when a login expires.
      loseSession() {
        state.user = null;
        listeners.forEach((cb) => cb('SIGNED_OUT', null));
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
        // Accepts the code '123456' and signs in as that email address.
        async verifyOtp({ email, token, type }) {
          state.verifyCalls.push({ email, token, type });
          if ('123456' !== token) return { data: {}, error: { message: 'Token has expired or is invalid' } };
          state.signIn({ id: '00000000-0000-4000-8000-000000000001', email });
          return { data: {}, error: null };
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
              await networkDelay();
              return { data: state.remote ? structuredClone(state.remote) : null, error: null };
            } }; } };
          },
        };
      },
      rpc(name, args) {
        if ('save_tasks' === name) {
          return { async single() {
            // Lets a test act just before this upload lands: change the stored
            // list, as if another device had uploaded first, or return a
            // promise to hold the upload until the test releases it.
            if (state.beforeSave) {
              const beforeSave = state.beforeSave;
              state.beforeSave = null;
              await beforeSave();
            }
            await networkDelay();

            // Like the real function: save only if newer than what's stored.
            const current = state.remote;
            if (!current || Date.parse(current.updated_at) < Date.parse(args.new_updated_at)) {
              // Postgres returns timestamps as +00:00, not Z.
              const updated_at = args.new_updated_at.replace('Z', '+00:00');
              state.remote = { tasks: structuredClone(args.new_tasks), updated_at };
              state.upserts.push(structuredClone(args.new_tasks));
              return { data: { saved_tasks: structuredClone(args.new_tasks), saved_updated_at: updated_at, accepted: true }, error: null };
            }
            return { data: { saved_tasks: structuredClone(current.tasks), saved_updated_at: current.updated_at, accepted: false }, error: null };
          } };
        }

        if ('delete_account' === name) {
          state.deleted = true;
          state.remote = null;
        }
        return Promise.resolve({ error: null });
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

// Holds the next upload until releaseUpload() is called. Optionally changes the
// stored list first, as if another device had uploaded a newer one.
function holdNextUpload(page, newerRemoteTasks = null) {
  return page.evaluate((tasks) => {
    window.__uploadHeld = false;
    window.__fake.beforeSave = () => new Promise((resolve) => {
      if (tasks) {
        window.__fake.remote = { tasks, updated_at: new Date(Date.now() + 60000).toISOString().replace('Z', '+00:00') };
      }
      window.__uploadHeld = true;
      window.__releaseUpload = resolve;
    });
  }, newerRemoteTasks);
}

function releaseUpload(page) {
  return page.evaluate(() => window.__releaseUpload());
}

function syncMeta(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('simpleMITs_sync')));
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

    await expect(page.locator('#sync-sign-in-message')).toHaveText('We sent a sign-in link and code to test@example.com. Click the link or enter the code here.');
    await expect(page.locator('#sync-sign-in-form')).toBeHidden();
    await expect(page.locator('#sync-code-input')).toBeFocused();
    expect(await page.evaluate(() => window.__fake.otpEmails)).toEqual(['test@example.com']);
  });

  test('entering the emailed code signs in, after a wrong code shows an error', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });

    await page.locator('#sync-button').click();
    await page.fill('#sync-email-input', 'test@example.com');
    await page.press('#sync-email-input', 'Enter');

    await page.fill('#sync-code-input', '000000');
    await page.press('#sync-code-input', 'Enter');
    await expect(page.locator('#sync-sign-in-message')).toHaveText("That code didn't work: Token has expired or is invalid");
    await expect(page.locator('#sync-signed-out')).toBeVisible();

    // Spaces are ignored, since some email apps show codes as "123 456".
    await page.fill('#sync-code-input', '123 456');
    await page.press('#sync-code-input', 'Enter');

    await expect(page.locator('#sync-signed-in')).toBeVisible();
    await expect(page.locator('#sync-email')).toHaveText('test@example.com');
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);
    expect(await page.evaluate(() => window.__fake.verifyCalls.at(-1))).toEqual({ email: 'test@example.com', token: '123456', type: 'email' });
  });

  test('"Use a different email" returns to an empty email form', async ({ page }) => {
    await setUp(page);

    await page.locator('#sync-button').click();
    await page.fill('#sync-email-input', 'typo@example.con');
    await page.press('#sync-email-input', 'Enter');
    await expect(page.locator('#sync-code-form')).toBeVisible();

    await page.locator('#sync-different-email-button').click();

    await expect(page.locator('#sync-sign-in-form')).toBeVisible();
    await expect(page.locator('#sync-email-input')).toHaveValue('');
    await expect(page.locator('#sync-email-input')).toBeFocused();
    await expect(page.locator('#sync-code-form')).toBeHidden();
    await expect(page.locator('#sync-different-email')).toBeHidden();
    await expect(page.locator('#sync-sign-in-message')).toHaveText('');
  });

  test('?modal=sync opens the Sync screen on load', async ({ page }) => {
    await setUp(page);
    await page.goto('/?modal=sync');
    await expect(page.locator('#sync')).toBeVisible();
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

    // As if a sign-in link had been sent from this device before signing in.
    await page.evaluate(() => { document.getElementById('sync-sign-in-form').hidden = true; });

    await page.locator('#sync-button').click();
    await page.locator('#sync-sign-out-button').click();

    await expect(page.locator('#sync-signed-out')).toBeVisible();
    await expect(page.locator('#sync-sign-in-form')).toBeVisible();
    await expect(page.locator('#sync-code-form')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('simpleMITs_sync'))).toBeNull();
    expect(await descriptions(page)).toEqual(['Task 1']);

    const uploadsBefore = await page.evaluate(() => window.__fake.upserts.length);
    await page.locator('#sync .close-modal').click();
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

  test('an upload that arrives after a newer one from another device takes the newer list', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);

    // Another device uploads a newer list after this device checked the
    // server, but before this device's upload lands.
    await page.evaluate((tasks) => {
      window.__fake.beforeSave = () => {
        window.__fake.remote = { tasks, updated_at: new Date(Date.now() + 60000).toISOString().replace('Z', '+00:00') };
      };
    }, [task(1), task(2, { description: 'From another device' })]);

    await addTask(page, 'Older local change');

    await expect.poll(() => descriptions(page)).toEqual(['Task 1', 'From another device']);
    expect(await remoteDescriptions(page)).toEqual(['Task 1', 'From another device']);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('simpleMITs_sync')).dirty)).toBe(false);
  });

  test('a retried upload that was already saved counts as saved', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);

    // As if an earlier attempt of this same upload was saved but its response
    // was lost: the stored list already has this upload's timestamp.
    await page.evaluate(() => {
      window.__fake.beforeSave = () => {
        const meta = JSON.parse(localStorage.getItem('simpleMITs_sync'));
        const tasks = JSON.parse(localStorage.getItem('simpleMITs'));
        window.__fake.remote = { tasks, updated_at: meta.localUpdatedAt.replace('Z', '+00:00') };
      };
    });

    await addTask(page, 'Second');

    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('simpleMITs_sync')).dirty)).toBe(false);
    expect(await descriptions(page)).toEqual(['Task 1', 'Second']);
    expect(await remoteDescriptions(page)).toEqual(['Task 1', 'Second']);
  });

  test('signing out waits for an upload queued during the current one', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);

    // Start an upload and hold it, then make another change while it's in progress.
    await holdNextUpload(page);
    await addTask(page, 'First change');
    await expect.poll(() => page.evaluate(() => window.__uploadHeld)).toBe(true);
    await addTask(page, 'Second change');

    await page.locator('#sync-button').click();
    await page.locator('#sync-sign-out-button').click();
    await releaseUpload(page);

    await expect(page.locator('#sync-signed-out')).toBeVisible();
    expect(await remoteDescriptions(page)).toEqual(['Task 1', 'First change', 'Second change']);
  });

  test('changes made after the session ends upload when the same account signs back in', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);
    const uploadsBefore = await page.evaluate(() => window.__fake.upserts.length);

    await page.evaluate(() => window.__fake.loseSession());
    await addTask(page, 'Made while signed out');

    // Recorded, but not uploaded without a session.
    expect((await syncMeta(page)).dirty).toBe(true);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__fake.upserts.length)).toBe(uploadsBefore);

    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1', 'Made while signed out']);
  });

  test('an upload response that arrives after the session ends is ignored', async ({ page }) => {
    await setUp(page, { localTasks: [task(1)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1']);

    // Hold an upload that the server will reject in favor of another device's list.
    await holdNextUpload(page, [task(9, { description: 'From another device' })]);
    await addTask(page, 'Local change');
    await expect.poll(() => page.evaluate(() => window.__uploadHeld)).toBe(true);
    const metaBefore = await syncMeta(page);

    await page.evaluate(() => window.__fake.loseSession());
    await releaseUpload(page);
    await page.waitForTimeout(300);

    // Neither the tasks nor this device's sync bookkeeping change.
    expect(await descriptions(page)).toEqual(['Task 1', 'Local change']);
    expect(await syncMeta(page)).toEqual(metaBefore);
  });

  test('a change that arrives mid-drag waits for the drop, and deleting the dragged task loses nothing else', async ({ page }) => {
    await setUp(page, { localTasks: [task(1), task(2), task(3)] });
    await signIn(page);
    await expect.poll(() => remoteDescriptions(page)).toEqual(['Task 1', 'Task 2', 'Task 3']);

    // Start dragging Task 3.
    const handle = await page.locator('.task:nth-child(3) .task-grab-handle').boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - 10);

    // Another device deletes Task 3, and the change arrives mid-drag. Its
    // timestamp is now, so the drop that follows is the newest change and gets
    // uploaded, as it would be in real use.
    await page.evaluate((tasks) => {
      window.__fake.remote = { tasks, updated_at: new Date().toISOString().replace('Z', '+00:00') };
      document.dispatchEvent(new Event('visibilitychange'));
    }, [task(1), task(2)]);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('simpleMITs')).length)).toBe(2);

    // The list isn't re-rendered while dragging.
    await expect(page.locator('.task.dragging')).toHaveCount(1);
    await expect(page.locator('.task')).toHaveCount(3);

    // Drop on Task 1. The deleted task is gone, and nothing else is lost.
    const target = await page.locator('.task:nth-child(1)').boundingBox();
    await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2);
    await page.mouse.up();

    await expect.poll(() => descriptions(page)).toEqual(['Task 1', 'Task 2']);
    await expect(page.locator('.task.dragging')).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(await remoteDescriptions(page)).toEqual(['Task 1', 'Task 2']);
  });
});
