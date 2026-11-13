/* exported loadTasks, saveTasks, clearTasks, loadPrefs, savePrefs */

/**
 * All reads and writes of persisted data go through this file, so a sync
 * backend can be added in one place later.
 */

const TASKS_KEY = 'simpleMITs';
const PREFS_KEY = 'simpleMITs_prefs';

/**
 * Reads and parses a JSON value from local storage.
 *
 * @param {string} key Storage key.
 * @return {*} Parsed value, or null if missing or unparseable.
 */
function readJSON(key) {
	const raw = localStorage.getItem(key);
	if (!raw) return null;

	try {
		return JSON.parse(raw);
	} catch (error) {
		console.error('Bad data in localStorage', error);
		localStorage.removeItem(key);
		return null;
	}
}

/**
 * Returns the stored task array (unvalidated), or an empty array.
 *
 * @return {Array}
 */
function loadTasks() {
	const tasks = readJSON(TASKS_KEY);
	return Array.isArray(tasks) ? tasks : [];
}

/**
 * Saves the full task array.
 *
 * @param {Array} tasks
 */
function saveTasks(tasks) {
	localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

/**
 * Removes all stored tasks.
 */
function clearTasks() {
	localStorage.removeItem(TASKS_KEY);
}

/**
 * Returns stored prefs merged over the given defaults.
 *
 * @param {Object} defaults
 * @return {Object}
 */
function loadPrefs(defaults) {
	const prefs = readJSON(PREFS_KEY);
	const isObject = prefs && 'object' === typeof prefs && !Array.isArray(prefs);
	return { ...defaults, ...(isObject ? prefs : {}) };
}

/**
 * Saves the prefs object.
 *
 * @param {Object} prefs
 */
function savePrefs(prefs) {
	localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
