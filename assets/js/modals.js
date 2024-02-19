if (document.readyState === "loading") {
  // Loading hasn't finished yet
  document.addEventListener("DOMContentLoaded", addModalEventListeners);
} else {
  // `DOMContentLoaded` has already fired
  addModalEventListeners();
}

function addModalEventListeners() {
  const modals = document.querySelectorAll('.modal-button');
  modals.forEach((element) => element.addEventListener('click', showModal));
}

function showModal(event) {
  let modalButton = event.target;
  let modal = document.getElementById(modalButton.dataset.modalId);
  let closeModalButton = modal.querySelector('.cancel, .close-modal');
  
  modal.classList.add('visible');
  modal.showModal();
  
  addEventListener('keyup', closeIfEsc);
  closeModalButton.addEventListener('click', () => {
    closeModal(modal);
  }, {once: true});
}

function closeIfEsc(event) {
  if (event.code === 'Escape') {
    closeModal();
  }
}

function closeModal(modal) {
  if (!modal) modal = document.querySelector('.modal.visible');
  removeEventListener('keyup', closeIfEsc);
  modal.classList.remove('visible');
  modal.close();
}