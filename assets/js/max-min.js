$(document).ready(function($) {
	let maximized = localStorage.getItem('simpleMITs_maximized');
	
	if (maximized) {
		maximize();
	} else {
		minimize();
	}

	$('.max-min-button').click(function() {
		if ($(this).hasClass('maximize')) {
			maximize();
		} else {
			minimize();
		}
	});
	
	function maximize() {
		$('.page-container').addClass('maximized').css('--root-size', '24px')
		$('.max-min-button').removeClass('maximize').addClass('minimize');
		$('.max-min-button .screen-reader-text').text('Minimize');
		
		localStorage.setItem('simpleMITs_maximized', true);
	}
	
	function minimize() {
		$('.page-container').removeClass('maximized').css('--root-size', '18px')
		$('.max-min-button').removeClass('minimize').addClass('maximize');
		$('.max-min-button .screen-reader-text').text('Maximize');
		
		localStorage.removeItem('simpleMITs_maximized');
	}
});
