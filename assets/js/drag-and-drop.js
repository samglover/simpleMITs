/* exported addDragHandlers */
/* global taskList, fetchMITs, listMITs */

let draggedTask;

/**
 * Drag & drop functionality.
 *
 * Mouse and pen dragging use Pointer Events rather than the native HTML5
 * drag-and-drop API. Chrome and Safari ignore the CSS `cursor` during a native
 * drag (and show a text cursor when the drag payload looks like text), so the
 * `grabbing` cursor never appeared. Pointer-based dragging keeps the cursor
 * under CSS control. Touch keeps its own handlers so page scrolling can be
 * blocked while a drag is in progress.
 *
 * @link https://codepen.io/retrofuturistic/pen/tlbHE?editors=0010
 * @param {Object} task Task node.
 */
function addDragHandlers(task) {
  let grabHandle = task.querySelector('.task-grab-handle');

  // Mouse and pen dragging via Pointer Events.
  grabHandle.addEventListener('pointerdown', handlePointerDown);

  // Touch dragging. Listeners live on the grab handle (not the whole task) so
  // the page still scrolls when a touch starts anywhere else on a task. Touch
  // events use implicit capture, so `touchmove` / `touchend` keep firing on the
  // handle once the drag has started. `passive: false` is required for
  // `preventDefault()` and silences Chrome's scroll-blocking listener warning.
  grabHandle.addEventListener('touchstart', handleTouchStart, { passive: false });
  grabHandle.addEventListener('touchmove', handleTouchMove, { passive: false });
  grabHandle.addEventListener('touchend', handleTouchEnd);
}

/**
 * Finds the task element under a viewport coordinate.
 *
 * @param {number} x Client X coordinate.
 * @param {number} y Client Y coordinate.
 * @return {?Element} The task under the point, or null.
 */
function taskFromPoint(x, y) {
  const element = document.elementFromPoint(x, y);

  for (let node of taskList.childNodes) {
    if (node === element || node.contains(element)) return node;
  }

  return null;
}

/**
 * Removes the drop-target highlight from every task.
 */
function clearOver() {
  taskList.childNodes.forEach(function (task) {
    task.classList.remove('over');
  });
}

/**
 * Moves draggedTask in front of targetTask, in the DOM and in local storage.
 *
 * @param {?Element} targetTask The task to drop in front of.
 */
function reorder(targetTask) {
  if (!targetTask || targetTask === draggedTask) return;

  taskList.insertBefore(draggedTask, targetTask);

  let /** @type {Array} */ mits = fetchMITs();
  let oldPosition, targetPosition;

  for (let i = 0; i < mits.length; i++) {
    if (mits[i].id == draggedTask.id) oldPosition = i;
    if (mits[i].id == targetTask.id) targetPosition = i;
  }

  let task = mits[oldPosition];
  mits.splice(oldPosition, 1);
  mits.splice(targetPosition, 0, task);

  localStorage.setItem('simpleMITs', JSON.stringify(mits));
  listMITs();
}

// Handles mouse and pen dragging via Pointer Events.
function handlePointerDown(event) {
  if (event.pointerType === 'touch') return;

  event.preventDefault();

  draggedTask = event.currentTarget.closest('.task');
  draggedTask.classList.add('dragging');
  document.body.classList.add('dragging-task');

  // Pointer capture keeps move/up events coming to the handle even when the
  // pointer leaves it.
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.addEventListener('pointermove', handlePointerMove);
  event.currentTarget.addEventListener('pointerup', handlePointerEnd);
  event.currentTarget.addEventListener('pointercancel', handlePointerEnd);
}

function handlePointerMove(event) {
  if (!draggedTask) return;

  const targetTask = taskFromPoint(event.clientX, event.clientY);

  clearOver();

  if (targetTask && targetTask !== draggedTask) targetTask.classList.add('over');
}

function handlePointerEnd(event) {
  if (!draggedTask) return;

  const handle = event.currentTarget;
  handle.removeEventListener('pointermove', handlePointerMove);
  handle.removeEventListener('pointerup', handlePointerEnd);
  handle.removeEventListener('pointercancel', handlePointerEnd);

  if (event.type !== 'pointercancel') {
    reorder(taskFromPoint(event.clientX, event.clientY));
  }

  draggedTask.classList.remove('dragging', 'over');
  document.body.classList.remove('dragging-task');
  clearOver();

  draggedTask = null;
}

// Handles touch dragging.
function handleTouchStart(event) {
  event.preventDefault();
  draggedTask = event.currentTarget.closest('.task');
  draggedTask.classList.add('dragging');
}

function handleTouchMove(event) {
  if (!draggedTask) return;

  event.preventDefault();
  const touch = event.touches[0];
  const targetTask = taskFromPoint(touch.clientX, touch.clientY);

  clearOver();

  if (targetTask && targetTask !== draggedTask) targetTask.classList.add('over');
}

function handleTouchEnd(event) {
  if (!draggedTask) return;

  const touch = event.changedTouches[0];
  reorder(taskFromPoint(touch.clientX, touch.clientY));

  draggedTask.classList.remove('dragging', 'over');
  clearOver();

  draggedTask = null;
}
