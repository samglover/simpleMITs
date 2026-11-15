/* exported loadTasks, saveTasks, clearTasks, onTasksSaved, loadPrefs, savePrefs, loadSyncMeta, saveSyncMeta, clearSyncMeta */

/**
 * All reads and writes of persisted data go through this file.
 */

const TASKS_KEY = 'simpleMITs';
const PREFS_KEY = 'simpleMITs_prefs';
const SYNC_META_KEY = 'simpleMITs_sync';

const tasksSavedListeners = [];

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
 * Reads a plain object from local storage.
 *
 * @param {string} key Storage key.
 * @return {Object} The stored object, or an empty object.
 */
function readObject(key) {
	const value = readJSON(key);
	const isObject = value && 'object' === typeof value && !Array.isArray(value);
	return isObject ? value : {};
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
 * Listeners registered with onTasksSaved() are notified, unless the save came
 * from sync itself (so remote changes don't get pushed straight back).
 *
 * @param {Array} tasks
 * @param {Object} [options]
 * @param {boolean} [options.fromSync] True when sync is writing remote data.
 */
function saveTasks(tasks, options = {}) {
	localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
	if (options.fromSync) return;
	tasksSavedListeners.forEach((listener) => listener(tasks));
}

/**
 * Removes all tasks.
 */
function clearTasks() {
	saveTasks([]);
}

/**
 * Registers a function to call after the user changes their tasks.
 *
 * @param {Function} listener Called with the saved task array.
 */
function onTasksSaved(listener) {
	tasksSavedListeners.push(listener);
}

/**
 * Returns stored prefs merged over the given defaults.
 *
 * @param {Object} defaults
 * @return {Object}
 */
function loadPrefs(defaults) {
	return { ...defaults, ...readObject(PREFS_KEY) };
}

/**
 * Saves the prefs object.
 *
 * @param {Object} prefs
 */
function savePrefs(prefs) {
	localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Returns this device's sync bookkeeping, or an empty object.
 *
 * @return {Object}
 */
function loadSyncMeta() {
	return readObject(SYNC_META_KEY);
}

/**
 * Saves this device's sync bookkeeping.
 *
 * @param {Object} meta
 */
function saveSyncMeta(meta) {
	localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
}

/**
 * Removes this device's sync bookkeeping (on sign-out).
 */
function clearSyncMeta() {
	localStorage.removeItem(SYNC_META_KEY);
}
