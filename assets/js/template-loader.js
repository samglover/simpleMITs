$(document).ready(function($) {
  // Load Template Parts
  $.get('/template-parts/faq.html', function (faqContent) {
    $('#faq-modal .modal-content').append(faqContent);
  });
});
