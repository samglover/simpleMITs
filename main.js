$( function(){
  $( '#faqModalBody' ).load( 'faq.html' );
});


// Fetches the list of MITs from the browser's local storage and sorts them by
// status, outputs them, adds labels to old tasks, and adds the new task input
// label.
function getMITs() {

  let mits = JSON.parse( localStorage.getItem( 'simpleMITs' ) );

  if ( !mits ) {
    mits = [];
  }

  let taskList = document.getElementById( 'taskList' );

  // Sorts the task list by status (done/notDone).
  //
  // Since there are only two statuses and done is "less than" notDone because
  // D comes before N in the alphabet, this is a pretty simple sorting function.
  mits.sort( function ( a, b ) {

    const statusA = a.status.toUpperCase();
    const statusB = b.status.toUpperCase();

    let comparison = 0;

    if ( statusA > statusB ) {
      comparison = 1;
    } else if ( statusA < statusB ) {
      comparison = -1;
    }

    return comparison * -1;

  });

  // Outputs the task list.
  taskList.innerHTML = '';

  for ( let i = 0; i < mits.length; i++ ) {

    let id      = mits[ i ].id;
    let date    = mits[ i ].date;
    let desc    = mits[ i ].description.trim();
    let status  = mits[ i ].status;

    taskList.innerHTML += '<div class="list-group-item lead task ' + status + '" id="' + id + '" draggable="true">' +
                            '<div class="row mx-n2">' +
                              '<div class="col-auto px-2"><a type="button" class="badge badge-pill badge-secondary p-0 taskNum" href="#" onclick="changeStatus( \''+id+'\' )"><span class="number">' + ( i + 1 ) + '</span><span class="checkmark">&check;</span></a></div>' +
                              '<div class="col align-items-center px-2">' +
                                '<span class="taskDesc mb-0" id="' + id + '_desc">' + desc + '</span>' +
                              '</div>' +
                              '<div class="col col-auto px-2"><button type="button" class="close text-muted taskDel" onclick="delTask( \''+id+'\' )">&times;</button></div>' +
                            '</div>' +
                          '</div>';


    // Adds a label if the task is more than 1 day (24 hours) old.
    let thisDate  = new Date();
    let taskDate  = new Date( date );
    let timeDiff  = thisDate.getTime() - taskDate.getTime();
    let daysOld   = Math.floor( timeDiff / ( 1000 * 3600 * 24 ) );
    let days      = '';

    if ( daysOld > 0 ) {

      days = daysOld > 1 ? 'days' : 'day';

      let ageBadge  = '<span class="badge badge-pill badge-light taskDesc-badge text-muted">' + daysOld + ' ' + days + ' old</span>';

      $( ageBadge ).insertAfter( '#' + id + '_desc' );

    }

  }

  localStorage.setItem( 'simpleMITs', JSON.stringify( mits ) );

  let tasks = taskList.childNodes;
  [].forEach.call( tasks, addDragHandlers );

  let tasksNotDone  = $( '.task.notDone' ).length;
  let tasksDone     = $( '.task.done' ).length;

  // Shows a "Clear All" button if there is more than one task.
  if ( tasksDone > 1 ) {
    $( '#clearCompletedButton' ).show();
  } else {
    $( '#clearCompletedButton' ).hide();
  }

  // Shows a "Clear All" button if there is more than one task.
  if ( mits.length > 1 ) {
    $( '#clearAllButton' ).show();
  } else {
    $( '#clearAllButton' ).hide();
  }


  // Changes the field label depending on the number of .notDone tasks.
  let inputLabel = document.getElementById( 'newTaskInputLabel' );

  inputLabel.innerHTML = '';

  switch ( tasksNotDone ) {

    case 0:
      inputLabel.innerHTML = 'What\'s the most important thing you could do today?';
      break;

    case 1:
      inputLabel.innerHTML = 'What\'s the next really important thing you could do today?';
      break;

    case 2:
      inputLabel.innerHTML = 'What\'s another important thing you could do today?';
      break;

    case 3:
    case 4:
      inputLabel.innerHTML = 'Need to make sure you get something else done today?';
      break;

    default:
      inputLabel.innerHTML = 'That\'s probably enough, but you can add more if you really want to.';
      break;

  }

}


// Drag & Drop
// Based on https://codepen.io/retrofuturistic/pen/tlbHE?editors=0010
function addDragHandlers( elem ) {
  elem.addEventListener( 'dragstart', handleDragStart, false );
  // elem.addEventListener( 'dragenter', handleDragEnter, false )
  elem.addEventListener( 'dragover', handleDragOver, false );
  elem.addEventListener( 'dragleave', handleDragLeave, false );
  elem.addEventListener( 'drop', handleDrop, false );
  elem.addEventListener( 'dragend', handleDragEnd, false );
}

  function handleDragStart( e ) {

    draggedTask = this;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData( 'text/html', this.outerHTML );

    this.classList.add( 'dragging' );

  }

  /*
  function handleDragEnter( e ) {
  }
  */

  function handleDragOver( e ) {

    if ( e.preventDefault ) {
      e.preventDefault();
    }

    if ( this != draggedTask && this != draggedTask.nextSibling ) {
      this.classList.add( 'over' );
    }

    e.dataTransfer.dropEffect = 'move';

    return false;

  }

  function handleDragLeave( e ) {
    this.classList.remove( 'over' );
  }

  function handleDrop( e ) {

    if ( e.stopPropagation ) {
      e.stopPropagation(); // Stops some browsers from redirecting.
    }

    // Don't do anything if dropping in the same place.
    if ( draggedTask != this) {

      this.parentNode.removeChild( draggedTask );

      let draggedTaskHTML = e.dataTransfer.getData( 'text/html' );
      this.insertAdjacentHTML( 'beforebegin', draggedTaskHTML );

      let taskList  = document.querySelectorAll( '#taskList .task' );
      let mits      = JSON.parse( localStorage.getItem( 'simpleMITs' ) );
      let newMITs   = [];

      for ( let i = 0; i < taskList.length; i++ ) {

        for ( let x = 0; x < mits.length; x++ ) {

          if ( mits[ x ].id == taskList[ i ].id ) {

            newMITs[ i ] = mits[ x ];

          }

        }

      }

      localStorage.setItem( 'simpleMITs', JSON.stringify( newMITs ) );

      addDragHandlers( this.previousSibling );

      getMITs();

    }

    this.classList.remove( 'over' );

    return false;

  }

  function handleDragEnd( e ) {
    this.classList.remove( 'dragging' );
  }


// Handles saving new tasks entered into the newTaskForm.
document.getElementById( 'newTaskForm' ).addEventListener( 'submit', saveTask );

function saveTask( e ) {

  let taskID      = chance.guid();
  let taskDate    = new Date();
  let taskDesc    = document.getElementById( 'newTaskInput' ).value;
  let taskStatus  = 'notDone';

  if ( !taskDesc ) {
    return;
  }

  let task = {
    id: taskID,
    date: taskDate,
    description: taskDesc,
    status: taskStatus,
  }

  if ( localStorage.getItem( 'simpleMITs' ) === null ) {

    let mits = [];
    mits.push( task );
    localStorage.setItem( 'simpleMITs', JSON.stringify( mits ) );

  } else {

    let mits = JSON.parse( localStorage.getItem( 'simpleMITs' ) );
    mits.push( task );
    localStorage.setItem( 'simpleMITs', JSON.stringify( mits ) );

  }

  document.getElementById( 'newTaskForm' ).reset();

  getMITs();

  e.preventDefault();

}


// Handles checking off (or un-checking) tasks.
function changeStatus( id ) {

  let mits = JSON.parse( localStorage.getItem( 'simpleMITs' ) );

  for ( let i = 0; i < mits.length; i++ ) {

    if ( mits[ i ].id == id ) {

      switch ( mits[ i ].status ) {

        case 'done':
          mits[ i ].status = 'notDone';
          break;

        case 'notDone':
          mits[ i ].status = 'done';
          break;

      }

    }

  }

  localStorage.setItem( 'simpleMITs', JSON.stringify( mits ) );

  getMITs();

}


// Handles deleting tasks by clicking on the X.
function delTask( id ) {

  let mits = JSON.parse( localStorage.getItem( 'simpleMITs' ) );

  for ( let i = 0; i < mits.length; i++ ) {

    if ( mits[ i ].id == id ) {
      mits.splice( i, 1 );
    }

  }

  localStorage.setItem( 'simpleMITs', JSON.stringify( mits ) );

  getMITs();

}


// Handles clearing all completed tasks at once, if there are two or more.
function clearCompleted() {

  let mits = JSON.parse( localStorage.getItem( 'simpleMITs' ) );

  for ( let i = 0; i < mits.length; i++ ) {

    // Deletes all tasks after the first .done task found.
    if ( mits[ i ].status == 'done' ) {
      mits.splice( i );
    }

  }

  localStorage.setItem( 'simpleMITs', JSON.stringify( mits ) );

  getMITs();

}


// Clears all tasks (and the localStorage).
function clearAll() {

  localStorage.removeItem( 'simpleMITs' );

  getMITs();

}
