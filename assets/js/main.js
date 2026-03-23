/* exported changeStatus, delTask, clearCompleted, clearAll */
/* global closeModal, addDragHandlers */

// Waits for the document to load before doing things.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    addEventListeners();
    setFocus()
  });
} else {
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
  // Clears the task list.
  taskList.replaceChildren();

  let mits = fetchMITs();
  
  // Outputs the task list.
  for (let i = 0; i < mits.length; i++) {
    let id = mits[i].id;

    const task = document.createElement('li');
    task.id = id;
    task.classList.add('task');

    if (true === mits[i].completed) task.classList.add('completed');

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

    task.innerHTML = `
      <div class="task-grab-handle"></div>
      <button class="task-checkbox" href="#" role="checkbox" onclick="changeStatus('${id}')">
        <span class="number">${i + 1}</span>
        <span class="check"></span>
      </button>
      <div class="task-description-col">
        <span class="task-description" contenteditable="plaintext-only"></span>${taskAge}
      </div>        
      <button class="task-delete" onclick="delTask('${id}')"></button>
    `;
    task.querySelector('.task-description').textContent = mits[i].description.trim();

    taskList.append(task);
  }
  
  let tasks = taskList.childNodes; {
    tasks.forEach((task) => {
      // Enables dragging when the grab handles are clicked.
      addDragHandlers(task);
      
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
    try {
      mits = JSON.parse(mits);
      mits = validateMITs(mits);
    } catch (error) {
      console.error("Bad data in localStorage", error);
      localStorage.removeItem('simpleMITs');
      // TODO: Show an error message to the user.
      mits = [];
    } finally {
      mits = sortMITs(mits);
    }
  } else {
    mits = [];
  }

  return mits;
}


/**
 * Validates MIT objects and removes entries with invalid properties.
 *
 * A valid MIT must have:
 * - `id` as a UUID string
 * - `date` as a valid ISO-8601 UTC timestamp string
 * - `completed` as a boolean value
 *
 * Legacy `status` values are normalized to `completed`:
 * - `completed` => true
 * - empty string / null / undefined => false
 *
 * @param {Array} mits Array of MIT objects.
 * @return {Array} Filtered array containing only valid MIT objects.
 */
function validateMITs(mits) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isoTimestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  return mits.reduce((validMITs, task) => {
    if (!task || 'object' !== typeof task) return validMITs;

    // Checks task.id
    if ('string' !== typeof task.id) return validMITs;
    if (!uuidRegex.test(task.id)) return validMITs;

    // Checks task.date
    if ('string' !== typeof task.date) return validMITs;
    if (!isoTimestampRegex.test(task.date)) return validMITs;

    const parsedDate = new Date(task.date);
    if (Number.isNaN(parsedDate.getTime())) return validMITs;

    let completed = false;
    const hasCompletedProperty = Object.prototype.hasOwnProperty.call(task, 'completed');

    // Checks task.completed, or normalizes from legacy task.status.
    if (hasCompletedProperty) {
      if ('boolean' !== typeof task.completed) return validMITs;
      completed = task.completed;
    } else if ('completed' === task.status) {
      completed = true;
    } else if (null == task.status || '' === task.status) {
      completed = false;
    } else {
      return validMITs;
    }

    validMITs.push({
      ...task,
      completed
    });

    return validMITs;
  }, []);
}


/**
 * Sorts completed tasks to the end of the parsedMITs object.
 * 
 * @param {Array} mits Array of MIT objects.
 * @return array Sorted array of MIT objects (empty if there are none).
*/
function sortMITs(mits) {
  // Sorts completed tasks to the end of the list .
  mits.sort(function(a, b) {
    const completedA = true === a.completed ? 1 : 0;
    const completedB = true === b.completed ? 1 : 0;
    localStorage.setItem('simpleMITs', JSON.stringify(mits));
    return completedA - completedB;
  });

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
    completed: false
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
  
  thisMIT.completed = !thisMIT.completed;
  localStorage.setItem('simpleMITs', JSON.stringify(mits));
  
  taskList.classList.add('a-task-just-changed-status');
  
  listMITs();
  
  const controller = new AbortController();
  const checkboxes = taskList.querySelectorAll('.task-checkbox');

  const clearStatusClass = () => {
    taskList.classList.remove('a-task-just-changed-status');
    controller.abort();
  };

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('pointerleave', clearStatusClass, {
      once: true,
      signal: controller.signal
    });
  });
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
  let /** @type {Array} */ mits = fetchMITs();
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
  let /** @type {Array} */ mits = fetchMITs();
  for (let i = 0; i < mits.length; i++) {
    if (true === mits[i].completed) mits.splice(i);
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


/**
 * Sets the new-task field label based on the number of incomplete tasks.
 */
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