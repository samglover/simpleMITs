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

function listMITs() {
  while(taskList.firstChild) taskList.removeChild(taskList.lastChild); // Clears the task list.

  let mits = fetchMITs();
  if (mits.length == 0) return;
  
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
        <span class="check">&check;</span>
      </button>
      <div class="task-description-col">
        <span class="task-description" contenteditable="plaintext-only">${mits[i].description.trim()}</span>
        ${taskAge}
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
      let oldDesc = taskDesc.innerText;
      taskDesc.addEventListener('focusin', () => {
        addEventListener('keydown', updateDescIfEnter);

        taskDesc.addEventListener('focusout', () => {
          removeEventListener('keydown', updateDescIfEnter);
          updateDescription(task);
        });

        function updateDescIfEnter(event) {
          if (
            (event.code === 'Enter' || event.code === 'Escape')
            && !event.shiftKey
          ) {
            event.preventDefault();
            event.target.blur();
            updateDescription(task);
            return false;
          }
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
 */
function updateDescription(task) {
  let mits = fetchMITs();
  let thisMIT;
  for (let i = 0; i < mits.length; i++) {
    if (mits[i].id == task.id) thisMIT = mits[i];
  }
  let desc = task.querySelector('.task-description');
  thisMIT.description = desc.innerText.trim();
  localStorage.setItem('simpleMITs', JSON.stringify(mits));
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
  let incompleteTasks = document.querySelectorAll('.task:not(.completed)').length;
  let addTaskInputLabel = document.querySelector('#add-task-form label');
  // let addTaskInput = document.querySelector('#add-task-form input');
  switch (incompleteTasks) {
    case 0:
      addTaskInputLabel.innerText = 'What\'s the most important thing you could do today?';
      // addTaskInput.setAttribute('placeholder', 'What\'s the most important thing you could do today?');
      break;
    case 1:
      addTaskInputLabel.innerText = 'What\'s the next really important thing you could do today?';
      // addTaskInput.setAttribute('placeholder', 'What\'s the next really important thing you could do today?');
      break;
    case 2:
      addTaskInputLabel.innerText = 'What\'s another important thing you could do today?';
      // addTaskInput.setAttribute('placeholder', 'What\'s another important thing you could do today?');
      break;
    case 3:
    case 4:
      addTaskInputLabel.innerText = 'Need to make sure you get something else done today?';
      // addTaskInput.setAttribute('placeholder', 'Need to make sure you get something else done today?');
      break;
    default:
      addTaskInputLabel.innerText = 'That\'s probably enough, but you can add more if you really want to.';
      // addTaskInput.setAttribute('placeholder', 'That\'s probably enough, but you can add more if you really want to.');
      break;
  }
}


/**
 * Drag & drop functionality.
 * 
 * @link https://codepen.io/retrofuturistic/pen/tlbHE?editors=0010
 * @param {Object} task Task node.
 */
function addDragHandlers(task) {
  task.addEventListener('dragstart', handleDragStart);
  task.addEventListener('dragover', handleDragOver);
  task.addEventListener('dragenter', handleDragEnter);
  task.addEventListener('dragleave', handleDragLeave);
  task.addEventListener('dragend', handleDragEnd);
  task.addEventListener('drop', handleDrop);
}

  function handleDragStart(event) {
    draggedTask = this;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', this.outerHTML);
    this.classList.add('dragging');
  }

  function handleDragOver(event) {
    event.preventDefault();
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