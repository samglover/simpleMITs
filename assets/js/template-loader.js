$(document).ready(function($) {
  // Load Template Parts
  $.get('template-parts/faq.html', function (faqContent) {
    $('#faq .modal-content').append(faqContent);
  });
});
