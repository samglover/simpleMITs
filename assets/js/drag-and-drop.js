/* exported addDragHandlers */
/* global taskList, fetchMITs, listMITs */

let draggedTask;
let dragScrollY = 0;

// Away from the grab handle, a touch drag starts on a long press so a normal
// touch can still scroll the list.
const LONG_PRESS_MS = 400;
const LONG_PRESS_MOVE_TOLERANCE = 12;
let longPressTimer = null;
let touchStartPoint = null;

/**
 * Drag & drop functionality.
 *
 * Mouse and pen dragging use Pointer Events rather than the native HTML5
 * drag-and-drop API. Chrome and Safari ignore the CSS `cursor` during a native
 * drag (and show a text cursor when the drag payload looks like text), so the
 * `grabbing` cursor never appeared. Pointer-based dragging keeps the cursor
 * under CSS control.
 *
 * Touch dragging starts immediately from the grab handle, or on a long press
 * anywhere else on a task; a shorter touch (or one that moves before the press
 * registers) scrolls the list as usual.
 *
 * While a drag is in progress the page is locked so it cannot scroll out from
 * under the task: `html.dragging-task` sets `overflow: hidden` for mouse and
 * pen, and a non-passive `touchmove` listener blocks touch scrolling (iOS
 * Safari ignores `overflow: hidden` for touch).
 *
 * @link https://codepen.io/retrofuturistic/pen/tlbHE?editors=0010
 * @param {Object} task Task node.
 */
function addDragHandlers(task) {
  // Mouse and pen dragging via Pointer Events.
  let grabHandle = task.querySelector('.task-grab-handle');
  grabHandle.addEventListener('pointerdown', handlePointerDown);

  // Touch dragging: immediate from the grab handle, long press elsewhere.
  task.addEventListener('touchstart', handleTouchStart, { passive: true });
  task.addEventListener('touchmove', handleTouchMove, { passive: false });
  task.addEventListener('touchend', handleTouchEnd, { passive: false });
  task.addEventListener('touchcancel', handleTouchEnd);
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
 * Prevents a touch from scrolling the page. Added to the document only while a
 * drag is in progress.
 *
 * @param {TouchEvent} event Touch event.
 */
function blockTouchScroll(event) {
  event.preventDefault();
}

/**
 * Starts a drag: marks the task, locks page scrolling and clears any text
 * selection left over from a long press.
 *
 * @param {Element} task Task node being dragged.
 */
function startDragging(task) {
  draggedTask = task;
  dragScrollY = window.scrollY;

  task.classList.add('dragging');
  document.documentElement.classList.add('dragging-task');
  document.addEventListener('touchmove', blockTouchScroll, { passive: false });

  const selection = window.getSelection();
  if (selection) selection.removeAllRanges();
}

/**
 * Ends a drag: clears drag state, unlocks scrolling and restores the scroll
 * position (rebuilding the list can otherwise leave the page jumped).
 */
function stopDragging() {
  document.removeEventListener('touchmove', blockTouchScroll, { passive: false });

  if (draggedTask) draggedTask.classList.remove('dragging', 'over');
  document.documentElement.classList.remove('dragging-task');
  clearOver();
  window.scrollTo(0, dragScrollY);

  draggedTask = null;
}

/**
 * Highlights the task currently under the pointer or finger as the drop target.
 *
 * @param {number} x Client X coordinate.
 * @param {number} y Client Y coordinate.
 */
function updateDropTarget(x, y) {
  const targetTask = taskFromPoint(x, y);

  clearOver();

  if (targetTask && targetTask !== draggedTask) targetTask.classList.add('over');
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

  startDragging(event.currentTarget.closest('.task'));

  // Pointer capture keeps move/up events coming to the handle even when the
  // pointer leaves it.
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.addEventListener('pointermove', handlePointerMove);
  event.currentTarget.addEventListener('pointerup', handlePointerEnd);
  event.currentTarget.addEventListener('pointercancel', handlePointerEnd);
}

function handlePointerMove(event) {
  if (!draggedTask) return;

  updateDropTarget(event.clientX, event.clientY);
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

  stopDragging();
}

// Handles touch dragging.
function handleTouchStart(event) {
  if (draggedTask || event.touches.length > 1) return;

  const touch = event.touches[0];
  const task = event.currentTarget;
  touchStartPoint = { x: touch.clientX, y: touch.clientY };

  // The grab handle starts a drag right away; anywhere else needs a long press.
  if (event.target.closest('.task-grab-handle')) {
    startDragging(task);
    return;
  }

  longPressTimer = setTimeout(function () {
    longPressTimer = null;
    startDragging(task);
    if (navigator.vibrate) navigator.vibrate(10);
  }, LONG_PRESS_MS);
}

function handleTouchMove(event) {
  const touch = event.touches[0];

  // Before the long press registers, any real movement means the user is
  // scrolling, so cancel the pending drag and let the scroll happen.
  if (!draggedTask) {
    if (longPressTimer && touchStartPoint) {
      const movedX = Math.abs(touch.clientX - touchStartPoint.x);
      const movedY = Math.abs(touch.clientY - touchStartPoint.y);

      if (movedX > LONG_PRESS_MOVE_TOLERANCE || movedY > LONG_PRESS_MOVE_TOLERANCE) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    return;
  }

  event.preventDefault();
  updateDropTarget(touch.clientX, touch.clientY);
}

function handleTouchEnd(event) {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }

  if (!draggedTask) return;

  // Suppress the click the browser synthesizes after the drag, so it doesn't
  // land on a task and open the description for editing.
  if (event.cancelable) event.preventDefault();

  if (event.type !== 'touchcancel') {
    const touch = event.changedTouches[0];
    reorder(taskFromPoint(touch.clientX, touch.clientY));
  }

  stopDragging();
}
