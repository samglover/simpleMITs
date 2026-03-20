$(document).ready(function($) {
	let prefs = localStorage.getItem('simpleMITs_prefs');

	if (prefs) {
    prefs = JSON.parse(prefs);
	} else {
		prefs = {
			'maximized': false
		};
	}
	
	// Maximize/minimize
	if (prefs.maximized) {
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
		$('.page-container').addClass('maximized')
		$('.max-min-button').removeClass('maximize').addClass('minimize');
		$('.max-min-button .screen-reader-text').text('Minimize');

		prefs.maximized = true;
		localStorage.setItem('simpleMITs_prefs', JSON.stringify(prefs));
	}
	
	function minimize() {
		$('.page-container').removeClass('maximized')
		$('.max-min-button').removeClass('minimize').addClass('maximize');
		$('.max-min-button .screen-reader-text').text('Maximize');
		
		prefs.maximized = false;
		localStorage.setItem('simpleMITs_prefs', JSON.stringify(prefs));
	}
});
