import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('page loads with the add task form focused', async ({ page }) => {
  await expect(page.locator('#add-task-input')).toBeFocused();
  await expect(page.locator('#add-task-form label')).toHaveText(
    "What's the most important thing you could do today?"
  );
});

test('can add a task', async ({ page }) => {
  await page.fill('#add-task-input', 'Write tests');
  await page.press('#add-task-input', 'Enter');
  await expect(page.locator('.task-description')).toHaveText('Write tests');
});

test('task input is cleared after adding a task', async ({ page }) => {
  await page.fill('#add-task-input', 'Write tests');
  await page.press('#add-task-input', 'Enter');
  await expect(page.locator('#add-task-input')).toHaveValue('');
});

test('can complete a task', async ({ page }) => {
  await page.fill('#add-task-input', 'Write tests');
  await page.press('#add-task-input', 'Enter');
  await page.locator('.task-checkbox').click();
  await expect(page.locator('.task')).toHaveClass(/completed/);
});

test('can un-complete a task', async ({ page }) => {
  await page.fill('#add-task-input', 'Write tests');
  await page.press('#add-task-input', 'Enter');
  await page.locator('.task-checkbox').click();
  await page.locator('.task-checkbox').click();
  await expect(page.locator('.task')).not.toHaveClass(/completed/);
});

test('can delete a task', async ({ page }) => {
  await page.fill('#add-task-input', 'Write tests');
  await page.press('#add-task-input', 'Enter');
  await page.locator('.task-delete').click();
  await expect(page.locator('.task')).toHaveCount(0);
});

test('can clear all tasks', async ({ page }) => {
  await page.fill('#add-task-input', 'First task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Second task');
  await page.press('#add-task-input', 'Enter');

  await page.locator('#clear-all-button').click();
  await page.locator('#clear-all-modal .confirm').click();

  await expect(page.locator('.task')).toHaveCount(0);
});

test('can clear completed tasks', async ({ page }) => {
  await page.fill('#add-task-input', 'First task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Second task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Third task');
  await page.press('#add-task-input', 'Enter');

  // Complete two tasks. After each completion the list re-sorts (completed to
  // end), so clicking nth(0) twice completes First then Second, leaving Third.
  await page.locator('.task-checkbox').nth(0).click();
  await page.locator('.task-checkbox').nth(0).click();

  await page.locator('#clear-completed-button').click();
  await page.locator('#clear-completed-modal .confirm').click();

  await expect(page.locator('.task')).toHaveCount(1);
  await expect(page.locator('.task-description')).toHaveText('Third task');
});

test('form label updates as tasks are added', async ({ page }) => {
  await expect(page.locator('#add-task-form label')).toHaveText(
    "What's the most important thing you could do today?"
  );

  await page.fill('#add-task-input', 'First task');
  await page.press('#add-task-input', 'Enter');
  await expect(page.locator('#add-task-form label')).toHaveText(
    "What's the next important thing you could do today?"
  );

  await page.fill('#add-task-input', 'Second task');
  await page.press('#add-task-input', 'Enter');
  await expect(page.locator('#add-task-form label')).toHaveText(
    "What's another important thing you could do today?"
  );
});

test('can reorder tasks by dragging', async ({ page }) => {
  await page.fill('#add-task-input', 'First task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Second task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Third task');
  await page.press('#add-task-input', 'Enter');

  // Drag "Third task" (last) to before "First task" (first)
  await page.locator('.task:nth-child(3) .task-grab-handle').dragTo(
    page.locator('.task:nth-child(1)')
  );

  const tasks = page.locator('.task-description');
  await expect(tasks.nth(0)).toHaveText('Third task');
  await expect(tasks.nth(1)).toHaveText('First task');
  await expect(tasks.nth(2)).toHaveText('Second task');
});

test('reordered task order persists after reload', async ({ page }) => {
  await page.fill('#add-task-input', 'First task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Second task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Third task');
  await page.press('#add-task-input', 'Enter');

  await page.locator('.task:nth-child(3) .task-grab-handle').dragTo(
    page.locator('.task:nth-child(1)')
  );

  await page.reload();

  const tasks = page.locator('.task-description');
  await expect(tasks.nth(0)).toHaveText('Third task');
  await expect(tasks.nth(1)).toHaveText('First task');
  await expect(tasks.nth(2)).toHaveText('Second task');
});

test('completed task snaps back when dragged before an active task', async ({ page }) => {
  await page.fill('#add-task-input', 'First task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Second task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Third task');
  await page.press('#add-task-input', 'Enter');

  // Complete "First task" — sort moves it to the end: [Second, Third, First(completed)]
  await page.locator('.task-checkbox').nth(0).click();

  // Try to drag "First task" (completed, nth(2)) before "Second task" (active, nth(0))
  await page.locator('.task:nth-child(3) .task-grab-handle').dragTo(
    page.locator('.task:nth-child(1)')
  );

  // Sort should push the completed task back to the end
  const tasks = page.locator('.task-description');
  await expect(tasks.nth(0)).toHaveText('Second task');
  await expect(tasks.nth(1)).toHaveText('Third task');
  await expect(tasks.nth(2)).toHaveText('First task');
  await expect(page.locator('.task').nth(2)).toHaveClass(/completed/);
});

test('active task snaps back when dragged after completed tasks', async ({ page }) => {
  await page.fill('#add-task-input', 'First task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Second task');
  await page.press('#add-task-input', 'Enter');
  await page.fill('#add-task-input', 'Third task');
  await page.press('#add-task-input', 'Enter');

  // Complete "Second task" (nth(1)) — sort: [First, Third, Second(completed)]
  await page.locator('.task-checkbox').nth(1).click();
  // Complete "Third task" (now nth(1)) — sort: [First, Third(completed), Second(completed)]
  await page.locator('.task-checkbox').nth(1).click();

  // Try to drag "First task" (active, nth(0)) to drop on the last completed task (nth(2))
  // This places First at the end in storage; sort should pull it back to the front
  await page.locator('.task:nth-child(1) .task-grab-handle').dragTo(
    page.locator('.task:nth-child(3)')
  );

  const tasks = page.locator('.task-description');
  await expect(tasks.nth(0)).toHaveText('First task');
  await expect(page.locator('.task').nth(0)).not.toHaveClass(/completed/);
  await expect(page.locator('.task').nth(1)).toHaveClass(/completed/);
  await expect(page.locator('.task').nth(2)).toHaveClass(/completed/);
});

test('tasks persist after page reload', async ({ page }) => {
  await page.fill('#add-task-input', 'Write tests');
  await page.press('#add-task-input', 'Enter');

  await page.reload();

  await expect(page.locator('.task-description')).toHaveText('Write tests');
});

test('completed status persists after page reload', async ({ page }) => {
  await page.fill('#add-task-input', 'Write tests');
  await page.press('#add-task-input', 'Enter');
  await page.locator('.task-checkbox').click();

  await page.reload();

  await expect(page.locator('.task')).toHaveClass(/completed/);
});
