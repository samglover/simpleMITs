// Waits for the document to load before doing things.
if (document.readyState === "loading") {
  // Loading hasn't finished yet
  document.addEventListener("DOMContentLoaded", () => {
    addEventListeners();
    setFocus()
  });
} else {
  // `DOMContentLoaded` has already fired
  addEventListeners();
  setFocus();
}

function addEventListeners() {
  document.getElementById('add-task-form').addEventListener('submit', saveTask);
}

function setFocus() {
  document.getElementById('add-task-input').focus();
}

const taskList = document.getElementById('task-list');
const defaultAddTaskInputLabel = document.querySelector('#add-task-form label').innerText;
const defaultAddTaskInputPlaceholder = document.querySelector('#add-task-form input').getAttribute('placeholder');

function listMITs() {
  while(taskList.firstChild) taskList.removeChild(taskList.lastChild); // Clears the task list.

  let mits = fetchMITs();
  // if (mits.length == 0) return;
  
  // Outputs the task list.
  for (let i = 0; i < mits.length; i++) {
    let id = mits[i].id;

    const newTask = document.createElement('li');
    newTask.id = id;
    newTask.classList.add('task');

    if (mits[i].status) newTask.classList.add(mits[i].status);

    // Adds a label if the task is more than 1 day (24 hours) old.
    let taskAge = '';
    let taskDate  = new Date(mits[i].date);
    let thisDate  = new Date();
    let timeDiff  = thisDate.getTime() - taskDate.getTime();
    let daysOld   = Math.floor(timeDiff / (1000 * 3600 * 24));

    if (daysOld > 0) {
      let days = daysOld > 1 ? 'days' : 'day';
      taskAge  = '<span class="task-age">' + daysOld + ' ' + days + ' old</span>';
    }

    newTask.innerHTML = `
      <div class="task-grab-handle"></div>
      <button class="task-checkbox" href="#" role="checkbox" onclick="changeStatus('${id}')">
        <span class="number">${i + 1}</span>
        <span class="check"></span>
      </button>
      <div class="task-description-col">
        <span class="task-description" contenteditable="plaintext-only">${mits[i].description.trim()}</span>${taskAge}
      </div>        
      <button class="task-delete" onclick="delTask('${id}')"></button>
    `;

    taskList.append(newTask);
  }
  
  let tasks = taskList.childNodes; {
    tasks.forEach((task) => {
      // Enables dragging when the grab handles are clicked.
      addDragHandlers(task);

      let grabHandle = task.querySelector('.task-grab-handle');
      grabHandle.addEventListener('mousedown', makeTaskDraggable);

      function makeTaskDraggable(event) {
        task.setAttribute('draggable', true);
      }
      
      // Handles task editing.
      let taskDesc = task.querySelector('.task-description');
      let taskDescText = taskDesc.innerText;

      taskDesc.addEventListener('focusin', () => {        
        addEventListener('keydown', updateDescIf);
        addEventListener('pointerdown', updateDescIf);

        function updateDescIf(event) {
          // Returns if the user clicks on the task description.
          if (
            'pointerdown' == event.type
            && taskDesc == event.target
          ) return;

          // Returns if Enter, Tab, or Escape are pressed.
          if (
            'keydown' == event.type
            && 'Enter' !== event.code
            && 'Tab' !== event.code
            && 'Escape' !== event.code
          ) return;

          // Returns if Shift + Enter is pressed.
          if (
            'Enter' == event.code
            && true == event.shiftKey
          ) return;
          
          switch (event.code) {
            case 'Enter':
              taskDescText = taskDesc.innerText;
              break;
            case 'Tab':
              if (false == event.shiftKey) taskDescText = taskDesc.innerText;
              break;
          }

          event.preventDefault();
          removeEventListener('keydown', updateDescIf);
          removeEventListener('pointerdown', updateDescIf);
          taskDesc.blur();
          
          updateDescription(task, taskDescText);
        }
      });
    });
  }

  addTaskInputLabel();
}

/**
 * Fetches and sorts MITs from local storage.
 * 
 * @return array Sorted array of MITs (empty if there are none).
 */
function fetchMITs() {
  let mits = localStorage.getItem('simpleMITs');
  if (mits) {
    mits = JSON.parse(mits);
    // Sorts completed tasks to the end of the list (uses alphabetical sorting, 'completed' >< '').
    mits.sort(function(a, b) {
      const statusA = a.status.toLowerCase();
      const statusB = b.status.toLowerCase();
      let comparison = 0;
      if (statusA > statusB) {
        comparison = -1;
      } else if (statusA < statusB) {
        comparison = 1;
      }
      localStorage.setItem('simpleMITs', JSON.stringify(mits));
      return comparison * -1;
    });
  } else {
    mits = [];
  }
  return mits;
}


/**
 * Handles saving new tasks entered into the #new-task-form.
 * 
 * @param {*} event
 */
function saveTask(event) {
  event.preventDefault();
  let taskDesc = document.getElementById('add-task-input').value;
  if (!taskDesc) return;
  let mits = fetchMITs();
  let newTask = {
    id: chance.guid(),
    date: new Date(),
    description: taskDesc,
    status: ''
  }
  mits.push(newTask);
  localStorage.setItem('simpleMITs', JSON.stringify(mits));
  document.getElementById('add-task-form').reset();
  listMITs();
}


/**
 * Handles completing and uncompleting tasks.
 * 
 * @param {string} id The task's `id` attribute.
 */
function changeStatus(id) {
  let mits = fetchMITs();
  let thisMIT; // This will be the object in the browser's local storage.
  for (let i = 0; i < mits.length; i++) {
    if (mits[i].id == id) thisMIT = mits[i];
  }
  let thisElement = document.getElementById(thisMIT.id);
  let thisNum = thisElement.querySelector('.task-checkbox .number');
  let thisCheck = thisElement.querySelector('.task-checkbox .check');
  let thisCheckOrNum;
  switch (thisMIT.status) {
    case 'completed': // i.e., we're un-completing this task.
      thisMIT.status = '';
      thisCheckOrNum = thisNum;
      break;
    default:
      thisMIT.status = 'completed';
      thisCheckOrNum = thisCheck;
    }
  localStorage.setItem('simpleMITs', JSON.stringify(mits));
  listMITs();
  
  taskList.classList.add('a-task-just-changed-status');
  setTimeout(() => {
    taskList.classList.remove('a-task-just-changed-status');
  }, 750);
}


/**
 * Updates the task description.
 * 
 * @param {Object} task Task node.
 * @param {string} taskDescText The new task description.
 */
function updateDescription(task, taskDescText) {
  let mits = fetchMITs();
  let thisMIT;
  for (let i = 0; i < mits.length; i++) {
    if (mits[i].id == task.id) thisMIT = mits[i];
  }
  thisMIT.description = taskDescText.trim();
  localStorage.setItem('simpleMITs', JSON.stringify(mits));
  listMITs();
}


/**
 * Handles deleting tasks by clicking on the X.
 * 
 * @param {string} id The task's `id` attribute.
 */
function delTask(id) {
  let mits = fetchMITs();
  for (let i = 0; i < mits.length; i++) {
    if (mits[i].id == id) mits.splice(i, 1);
  }
  localStorage.setItem('simpleMITs', JSON.stringify(mits));
  listMITs();
}


/**
 * Handles clearing all completed tasks at once, if there are two or more.
 */
function clearCompleted() {
  let mits = fetchMITs();
  for (let i = 0; i < mits.length; i++) {
    if (mits[i].status == 'completed') mits.splice(i);
  }
  localStorage.setItem('simpleMITs',JSON.stringify(mits));
  closeModal();
  listMITs();
}


/**
 * Clears all tasks and the local storage.
 */
function clearAll() {
  localStorage.removeItem('simpleMITs');
  closeModal();
  listMITs();
}


function addTaskInputLabel() {
  let addTaskInput = document.querySelector('#add-task-form input');
  let addTaskInputLabel = document.querySelector('#add-task-form label');
  let incompleteTasks = taskList.querySelectorAll('.task:not(.completed)').length;
  let inputPlaceholder = defaultAddTaskInputPlaceholder;
  let inputLabelText = addTaskInputLabel.innerText;

  if (incompleteTasks > 0) inputPlaceholder = 'Add another important task';
  if (incompleteTasks <= 4) {
    switch (incompleteTasks) {
      case 0:
        inputLabelText = defaultAddTaskInputLabel;
        break;
      case 1:
        inputLabelText = 'What\'s the next important thing you could do today?';
        break;
      case 2:
        inputLabelText = 'What\'s another important thing you could do today?';
        break;
      case 3:
      case 4:
        inputLabelText = 'Need to make sure you get something else done today?';
        break;
    }
  } else {
    inputLabelText = 'That\'s probably enough for today, but you can add more if you really want to.';
    inputPlaceholder = 'Add another task';
  }

  addTaskInputLabel.innerText = inputLabelText;
  addTaskInput.setAttribute('placeholder', inputPlaceholder);
}


/**
 * Drag & drop functionality.
 * 
 * @link https://codepen.io/retrofuturistic/pen/tlbHE?editors=0010
 * @param {Object} task Task node.
 */
function addDragHandlers(task) {
  // Mouse events
  task.addEventListener('dragstart', handleDragStart);
  task.addEventListener('dragover', handleDragOver);
  task.addEventListener('dragenter', handleDragEnter);
  task.addEventListener('dragleave', handleDragLeave);
  task.addEventListener('dragend', handleDragEnd);
  task.addEventListener('drop', handleDrop);
  
  // Touch events
  task.addEventListener('touchstart', handleTouchStart);
  task.addEventListener('touchmove', handleTouchMove);
  task.addEventListener('touchend', handleTouchEnd);
}

  // Mouse drag and drop functions
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
      // Move the element.
      taskList.insertBefore(draggedTask, this);

      // Move the object in local storage.
      let mits = fetchMITs();
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

  // Touch drag and drop functions
  function handleTouchStart(event) {
    draggedTask = this;
    this.classList.add('dragging');
  }

  function handleTouchMove(event) {
    if (!draggedTask) return;

    const touch = event.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    // Find which task is under the touch point
    let targetTask = null;
    for (let node of taskList.childNodes) {
      if (node === element || node.contains(element)) {
        targetTask = node;
        break;
      }
    }

    // Remove 'over' class from all tasks
    taskList.childNodes.forEach(function (task) {
      task.classList.remove('over');
    });

    // Add 'over' class to the target task
    if (targetTask && targetTask !== draggedTask) {
      targetTask.classList.add('over');
    }
  }

  function handleTouchEnd(event) {
    if (!draggedTask) return;

    const touch = event.changedTouches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    // Find which task is under the touch point
    let targetTask = null;
    for (let node of taskList.childNodes) {
      if (node === element || node.contains(element)) {
        targetTask = node;
        break;
      }
    }

    if (targetTask && targetTask !== draggedTask) {
      // Move the element
      taskList.insertBefore(draggedTask, targetTask);

      // Move the object in local storage
      let mits = fetchMITs();
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