## Project overview

simpleMITs is a lightweight web app built with vanilla HTML, CSS (SCSS), and JavaScript. There are no frameworks—keep it that way.

## General guidelines

- Prioritize simple, readable code
- Avoid adding dependencies—use vanilla JS, not libraries
- Keep functions small and focused on a single responsibility

## Code formatting

- Use tabs that are 2 spaces wide

## JavaScript

- Source files live in `assets/js/`
- Use single quotes for strings
- Use `const` and `let`; avoid `var`
- Prefer `querySelector` / `querySelectorAll` over jQuery when writing new code
- Keep DOM manipulation and logic separate

## CSS / SCSS

- Write styles in SCSS under `assets/scss/`
- Follow the existing partial structure (e.g. `_buttons.scss`, `_forms.scss`)
- Use variables from `_variables.scss` rather than hardcoding values

## HTML

- Keep markup semantic and accessible
- Use `aria-*` attributes where appropriate
- Avoid inline styles