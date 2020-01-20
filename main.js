$( function(){
  $( '#faqModal' ).load( 'faq.html' );
});


function getMITs() {

  let mits       = JSON.parse( localStorage.getItem( 'simpleMITs' ) );
  let taskList   = document.getElementById( 'taskList' );

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

    taskList.innerHTML += '<div class="list-group-item lead task ' + status + '" id="' + id + '">' +
                            '<div class="row mx-n2">' +
                              '<div class="col-auto px-2"><a type="button" class="badge badge-pill badge-secondary p-0 taskNum" href="#" onclick="changeStatus(\''+id+'\')"><span class="number">' + ( i + 1 ) + '</span><span class="checkmark">&check;</span></a></div>' +
                              '<div class="col align-items-center px-2">' +
                                '<p class="taskDesc mb-0" id="' + id + '_desc">' + desc + ' </p>' +
                              '</div>' +
                              '<div class="col col-auto px-2"><button type="button" class="close text-muted taskDel" onclick="delTask(\''+id+'\')">&times;</button></div>' +
                            '</div>' +
                          '</div>';


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
