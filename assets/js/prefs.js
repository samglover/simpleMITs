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

	$('.increase-size-button').click(function() {
		let size = getSize();

		if (size < maxSize) {
			$('.decrease-size-button').prop('disabled', false)
			pageContainer.style.setProperty('--root-size', size + increment + 'px');
			prefs.size = size + increment + 'px';
			localStorage.setItem('simpleMITs_prefs', JSON.stringify(prefs));

			if (size == maxSize - increment) {
				this.disabled = true;
			}
		}
	});

	$('.decrease-size-button').click(function() {
		let size = getSize();
		
		if (size > minSize) {
			$('.increase-size-button').prop('disabled', false)
			$(pageContainer).css('--root-size', size - increment + 'px');
			prefs.size = size + increment - 'px';
			localStorage.setItem('simpleMITs_prefs', JSON.stringify(prefs));
			
			if (size == minSize + increment) {
				$(this).prop('disabled', true);
			}
		}
	});
	
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
