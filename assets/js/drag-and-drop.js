/* exported addDragHandlers */
/* global taskList, fetchMITs, listMITs */

let draggedTask;

/**
 * Drag & drop functionality.
 * 
 * @link https://codepen.io/retrofuturistic/pen/tlbHE?editors=0010
 * @param {Object} task Task node.
 */
function addDragHandlers(task) {
  // Adds event listeners for mouse events.
  task.addEventListener('dragstart', handleDragStart);
  task.addEventListener('dragover', handleDragOver);
  task.addEventListener('dragenter', handleDragEnter);
  task.addEventListener('dragleave', handleDragLeave);
  task.addEventListener('dragend', handleDragEnd);
  task.addEventListener('drop', handleDrop);
  
  // Adds event listeners for touch events.
  task.addEventListener('touchstart', handleTouchStart);
  task.addEventListener('touchmove', handleTouchMove);
  task.addEventListener('touchend', handleTouchEnd);
}

// Handles mouse drag and drop functions.
function handleDragStart(event) {
  draggedTask = this;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/html', this.outerHTML);
  this.classList.add('dragging');
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter() {
  this.classList.add('over');
}

function handleDragLeave() {
  this.classList.remove('over');
}

function handleDragEnd() {
  this.classList.remove('dragging', 'over');
  taskList.childNodes.forEach(function (task) {
    task.classList.remove('over');
  });
}

function handleDrop(event) {
  event.stopPropagation();

  if (draggedTask !== this) {
    // Moves the element.
    taskList.insertBefore(draggedTask, this);

    // Moves the object in local storage.
    let /** @type {Array} */ mits = fetchMITs();
    let oldPosition, targetPosition;

    for (let i = 0; i < mits.length; i++) {
      if (mits[i].id == draggedTask.id) oldPosition = i;
      if (mits[i].id == this.id) targetPosition = i;
    }

    let task = mits[oldPosition];
    mits.splice(oldPosition, 1);
    mits.splice(targetPosition, 0, task);
		
    localStorage.setItem('simpleMITs', JSON.stringify(mits));
    listMITs();
  }

  return false;
}

// Handles touch drag and drop functions.
function handleTouchStart() {
  draggedTask = this;
  this.classList.add('dragging');
}

function handleTouchMove(event) {
  if (!draggedTask) return;

  const touch = event.touches[0];
  const element = document.elementFromPoint(touch.clientX, touch.clientY);

  // Finds the task under the touch point.
  let targetTask = null;
  for (let node of taskList.childNodes) {
    if (node === element || node.contains(element)) {
      targetTask = node;
      break;
    }
  }

  // Removes 'over' class from all tasks.
  taskList.childNodes.forEach(function (task) {
    task.classList.remove('over');
  });

  // Adds 'over' class to the target task.
  if (targetTask && targetTask !== draggedTask) {
    targetTask.classList.add('over');
  }
}

function handleTouchEnd(event) {
  if (!draggedTask) return;

  const touch = event.changedTouches[0];
  const element = document.elementFromPoint(touch.clientX, touch.clientY);

  // Finds the task under the touch point.
  let targetTask = null;
  for (let node of taskList.childNodes) {
    if (node === element || node.contains(element)) {
      targetTask = node;
      break;
    }
  }

  if (targetTask && targetTask !== draggedTask) {
    // Moves the task.
    taskList.insertBefore(draggedTask, targetTask);

    // Moves the object in local storage.
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

  // Cleanup
  draggedTask.classList.remove('dragging', 'over');
  taskList.childNodes.forEach(function (task) {
    task.classList.remove('over');
  });
  
  draggedTask = null;
}
