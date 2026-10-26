$(document).ready(function($) {
	let prefs = localStorage.getItem('simpleMITs_prefs');

	if (prefs) {
    prefs = JSON.parse(prefs);
	} else {
		// Defaults
		prefs = {
			'maximized': false,
			'size': '16px'
		};
	}
	
	const pageContainer = document.querySelector('.page-container');

	// Restore from prefs
	pageContainer.style.setProperty('--root-size', prefs.size);

	if (prefs.maximized) {
		maximize();
	} else {
		minimize();
	}


	// Size buttons
	let minSize = 10;
	let maxSize = 26;
	let increment = 2;

	updateSizeButtons();

	$('.increase-size-button').click(function() {
		let size = getSize();

		if (size < maxSize) {
			pageContainer.style.setProperty('--root-size', size + increment + 'px');
			prefs.size = size + increment + 'px';
			localStorage.setItem('simpleMITs_prefs', JSON.stringify(prefs));
			updateSizeButtons();
		}
	});

	$('.decrease-size-button').click(function() {
		let size = getSize();
		
		if (size > minSize) {
			$(pageContainer).css('--root-size', size - increment + 'px');
			prefs.size = size - increment + 'px';
			localStorage.setItem('simpleMITs_prefs', JSON.stringify(prefs));
			updateSizeButtons();
		}
	});

	// Disables the size buttons at the size limits
	function updateSizeButtons() {
		let size = getSize();
		$('.increase-size-button').prop('disabled', size >= maxSize);
		$('.decrease-size-button').prop('disabled', size <= minSize);
	}
	
	function getSize() {
		let currentSize = window.getComputedStyle(pageContainer).getPropertyValue('--root-size').trim();
		return Number.parseInt(currentSize, 10);
	}

	
	// Maximize/minimize button
	$('.max-min-button').click(function() {
		if ($(this).hasClass('maximize')) {
			maximize();
		} else {
			minimize();
		}
	});
	
	function maximize() {
		$(pageContainer).addClass('maximized')
		$('.max-min-button').removeClass('maximize').addClass('minimize');
		$('.max-min-button .screen-reader-text').text('Minimize');

		prefs.maximized = true;
		localStorage.setItem('simpleMITs_prefs', JSON.stringify(prefs));
	}
	
	function minimize() {
		$(pageContainer).removeClass('maximized')
		$('.max-min-button').removeClass('minimize').addClass('maximize');
		$('.max-min-button .screen-reader-text').text('Maximize');
		
		prefs.maximized = false;
		localStorage.setItem('simpleMITs_prefs', JSON.stringify(prefs));
	}
});
