# Changelog

All notable changes to this project will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## 1.0.6 - 2025-03-10

### Changed
- Remove focus after the user presses enter, escape, or removes the focus from the task description.
- Re-style task descriptions on focus.


## 1.0.5 - 2024-09-03

### Changed
- Switched the order of the confirm and cancel buttons so that the confirm button is in the lower right, more prominent position.

### Removed
- Removed unnecessary class in the FAQ file.


## 1.0.4 - 2024-03-21

### Changed
- Added the Jost font.
- Adjusted the vertical alignment of the task-age tag so that it is vertically centered on the line.
- Make task-age tags all-caps.
- Added event.preventDefault() to saveTask() to stop it from adding a ? to the URL when adding a task.


## 1.0.3 - 2024-02-28

### Changed
- Removed animation event listener when changing task status because if the mouse left the checkbox the function would not complete, meaning the task status would not change.


## 1.0.2 - 2024-02-22

### Changed
- Changed all background properties to explicit declarations to make inheritance work better.

### Fixed
- Using display:flex on the .task-list element was screwing with .task height on Safari. Fixed by making .task-list a block element with bottom margins instead.
- Similarly, using display:grid on modal containers was forcing them to full height on Safari. Fixed by adding a sub-container to the `dialog` element.


## 1.0.1 - 2024-02-19

### Changed
- Closing modals with Escape key now fires on keydown instead of keyup.
- The add-task input now gets focus when the page loads.


## 1.0 - 2024-02-18

### Added
- You can finally edit tasks!

### Changed
- New look! Now that simpleMITs no longer relies on Bootstrap, it needed its own look.
- Also, no more Bootstrap modals. Modals are now handled by /assets/js/modals.js and /assets/scss/_modals.scss.
- Added SASS now that it needs more CSS.
- Logo and icons are now SVGs.
- jQuery and Chance are now stored locally for faster access.
- jQuery updated to 3.7.
- Reduce the maximum width.
- Now uses createElement to create tasks as nodes rather than just injecting HTML.
- Now uses CSS instead of Javascript for showing and hiding the clear-task buttons.
- Dragging and dropping now has more helpful graphical indicators, including grab handles to initiate dragging.
- Updated the FAQ.

### Removed
- Removed Bootstrap.
- Removed PNG icons and images.
- Removed /ico.


## 0.3.2 - 2020-10-31

### Changed
- Layout tweaks.


## 0.3.1 - 2020-10-28

### Added
- ARIA labels for accessibility.
- Define page regions.

### Changed
- Remove spaces after task descriptions.

### Fixed
- Fix cursors related to drag-and-drop tasks.


## 0.3.0 - 2020-03-28

### Added
- Drag-and-drop reordering.

### Changed
- Minor tweaks to streamline the code and prepare for future features.


## 0.2.4 - 2020-02-15

### Changed
- Clear Done button changed to Clear Completed.
- Clicking Clear Completed pops up a modal confirmation dialog.


## 0.2.3 - 2020-02-03

### Changed
- Move Clear Done button to the left.


## 0.2.2 - 2020-01-26

### Added
- Clear Done button.


## 0.2.1 - 2020-01-22

### Fixed
- Clicking Clear All in the modal also dismisses the modal.


## 0.2.0 - 2020-01-22

### Added
- If there is more than one task, use the Clear All button to clear them all at once.

### Changed
- The input field label changes depending on the number of uncompleted tasks.


## 0.1.0 - 2020-01-21

### Added
- Logo, favicon, and app icons.
- Tasks can be added, completed, and deleted.
- Tasks show a badge if they are more than 24 hours old.
- FAQ.
