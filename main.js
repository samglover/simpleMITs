$( function(){
  $( '#faqModalBody' ).load( 'faq.html' );
});


function getMITs() {

  let mits = JSON.parse( localStorage.getItem( 'simpleMITs' ) );

  if ( !mits ) {
    mits = [];
  }

  let taskList      = document.getElementById( 'taskList' );
  let tasksNotDone  = 0;

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

  taskList.innerHTML = '';

  for ( let i = 0; i < mits.length; i++ ) {

    let id      = mits[ i ].id;
    let date    = mits[ i ].date;
    let desc    = mits[ i ].description;
    let status  = mits[ i ].status;

    if ( status == 'notDone' ) {
      tasksNotDone++;
    }

    taskList.innerHTML += '<div class="list-group-item lead task ' + status + '" id="' + id + '">' +
                            '<div class="row mx-n2">' +
                              '<div class="col-auto px-2"><a type="button" class="badge badge-pill badge-secondary p-0 taskNum" href="#" onclick="changeStatus(\''+id+'\')"><span class="number">' + ( i + 1 ) + '</span><span class="checkmark">&check;</span></a></div>' +
                              '<div class="col align-items-center px-2">' +
                                '<p class="taskDesc mb-0" id="' + id + '_desc">' + desc + ' </p>' +
                              '</div>' +
                              '<div class="col col-auto px-2"><button type="button" class="close text-muted taskDel" onclick="delTask(\''+id+'\')">&times;</button></div>' +
                            '</div>' +
                          '</div>';


    // Adds a label if the task is more than 1 day (24 hours) old.
    let thisDate  = new Date();
    let taskDate  = new Date( date );
    let timeDiff  = thisDate.getTime() - taskDate.getTime();
    let daysOld   = Math.floor( timeDiff / ( 1000 * 3600 * 24 ) );
    let days      = '';

    if ( daysOld > 0 ) {

      switch ( daysOld ) {

        case 1 :
          days = 'day';
          break;

        default :
          days = 'days';
          break;

      }

      let ageBadge  = '<span class="badge badge-pill badge-light text-muted">' + daysOld + ' ' + days + ' old</span>';

      $( ageBadge ).appendTo( '#' + id + '_desc' );

    }

  }


  // Adds a "Clear All" button if there is more than one task.
  if ( mits.length > 1 ) {

    $( '#clearAllButton' ).addClass( 'd-block' );

  }


  // Changes the field label depending on the number of .notDone tasks.
  let inputLabel = document.getElementById( 'newTaskInputLabel' );

  inputLabel.innerHTML = '';

  switch ( tasksNotDone ) {

    case 0 :
      inputLabel.innerHTML = 'What\'s the most important thing you could do today?';
      break;

    case 1 :
      inputLabel.innerHTML = 'What\'s the next really important thing you could do today?';
      break;

    case 2 :
      inputLabel.innerHTML = 'What\'s another important thing you could do today?';
      break;

    case 3 :
    case 4 :
      inputLabel.innerHTML = 'Need to make sure you get something else done today?';
      break;

    default :
      inputLabel.innerHTML = 'That\'s probably enough, but you can add more if you really want to.';
      // $( inputLabel ).addClass( 'sr-only' );
      break;

  }

}


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


function changeStatus( id ) {

  let mits = JSON.parse( localStorage.getItem( 'simpleMITs' ) );

  for ( let i = 0; i < mits.length; i++ ) {

    if ( mits[ i ].id == id ) {

      switch ( mits[ i ].status ) {

        case 'done' :
          mits[ i ].status = 'notDone';
          break;
        case 'notDone' :
          mits[ i ].status = 'done';
          break;

      }

    }

  }

  localStorage.setItem( 'simpleMITs', JSON.stringify( mits ) );

  getMITs();

}


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

function clearAll() {

  localStorage.removeItem( 'simpleMITs' );

  getMITs();

}
