if (document.readyState === "loading") {
  // Loading hasn't finished yet
  document.addEventListener("DOMContentLoaded", addModalEventListeners);
} else {
  // `DOMContentLoaded` has already fired
  addModalEventListeners();
}

function addModalEventListeners() {
  const modalButtons = document.querySelectorAll('.modal-button');
  modalButtons.forEach((button) => button.addEventListener('click', showModal));
}

// Waits for `load` so other scripts (like sync.js) have finished showing or
// hiding their modal buttons.
addEventListener('load', openModalFromURL);

/**
 * Opens the modal named in the URL's `modal` parameter, if any. The value is
 * a modal button's `data-modal-id`, for example `?modal=faq`. Modals whose
 * button is hidden (like Sync, when sync isn't set up) don't open.
 */
function openModalFromURL() {
  const modalId = new URLSearchParams(window.location.search).get('modal');
  if (!modalId) return;

  const modalButtons = Array.from(document.querySelectorAll('.modal-button'));
  const modalButton = modalButtons.find((button) => button.dataset.modalId === modalId);
  if (!modalButton || modalButton.hidden) return;

  openModal(document.getElementById(modalId));
}

function showModal(event) {
  openModal(document.getElementById(event.currentTarget.dataset.modalId));
}

function openModal(modal) {
  if (!modal) return;

  const closeModalButton = modal.querySelector('.cancel, .close-modal');

  modal.classList.add('visible');
  modal.showModal();

  addEventListener('keydown', closeIfEsc);
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
  removeEventListener('keydown', closeIfEsc);
  modal.classList.remove('visible');
  modal.close();
  clearModalURLParam();
}

/**
 * Removes the `modal` parameter from the URL, without reloading or adding a
 * history entry, so a reload doesn't reopen the modal.
 */
function clearModalURLParam() {
  const url = new window.URL(window.location.href);
  if (!url.searchParams.has('modal')) return;

  url.searchParams.delete('modal');
  window.history.replaceState(window.history.state, '', url);
}