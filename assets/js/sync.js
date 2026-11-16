/* global SIMPLEMITS_CONFIG, loadTasks, saveTasks, onTasksSaved, loadSyncMeta, saveSyncMeta, clearSyncMeta, listMITs */

/**
 * Optional sync of tasks across devices, using Supabase.
 *
 * The app always reads and writes local storage. When someone is signed in,
 * this file copies their task list to and from one row in the `user_data`
 * table. If the list changed in two places, the most recent change wins.
 *
 * Per-device bookkeeping (see loadSyncMeta in storage.js):
 * - userId:         the user this bookkeeping belongs to
 * - lastSyncedAt:   the remote `updated_at` this device last saw or wrote
 * - localUpdatedAt: when tasks last changed on this device
 * - dirty:          true if local changes haven't been uploaded yet
 */

const SYNC_PUSH_DELAY = 1000;

let syncClient = null;
let syncUser = null;
let syncPushTimer = null;
let syncInFlight = null;
let syncAgain = false;
let pendingEmail = '';

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initSync);
} else {
	initSync();
}

function isSyncConfigured() {
	return Boolean(
		'undefined' !== typeof SIMPLEMITS_CONFIG
		&& SIMPLEMITS_CONFIG.supabaseUrl
		&& SIMPLEMITS_CONFIG.supabaseKey
		&& window.supabase
	);
}

function initSync() {
	if (!isSyncConfigured()) return;

	syncClient = window.supabase.createClient(SIMPLEMITS_CONFIG.supabaseUrl, SIMPLEMITS_CONFIG.supabaseKey);

	document.getElementById('sync-button').hidden = false;
	document.getElementById('sync-sign-in-form').addEventListener('submit', sendSignInLink);
	document.getElementById('sync-code-form').addEventListener('submit', verifySignInCode);
	document.getElementById('sync-different-email-button').addEventListener('click', useDifferentEmail);
	document.getElementById('sync-sign-out-button').addEventListener('click', signOut);
	document.getElementById('sync-delete-button').addEventListener('click', deleteAccount);

	onTasksSaved(handleLocalChange);

	// Pull changes when the app comes back into view, and flush pending changes when it's hidden.
	document.addEventListener('visibilitychange', () => {
		if ('visible' === document.visibilityState || loadSyncMeta().dirty) syncNow();
	});
	window.addEventListener('online', syncNow);

	// Supabase advises against calling its other methods inside this callback, so the work is deferred.
	syncClient.auth.onAuthStateChange((event, session) => {
		setTimeout(() => handleSession(session), 0);
	});
}


/**
 * Session handling
 */

function handleSession(session) {
	const user = session ? session.user : null;
	const userChanged = (user ? user.id : null) !== (syncUser ? syncUser.id : null);

	syncUser = user;
	renderSyncUI();

	if (user && userChanged) syncNow();
}

async function sendSignInLink(event) {
	event.preventDefault();

	const form = event.target;
	const submitButton = form.querySelector('button[type="submit"]');
	const email = form.querySelector('input[type="email"]').value.trim();
	const message = document.getElementById('sync-sign-in-message');

	if (!email) return;

	submitButton.disabled = true;
	message.textContent = 'Sending…';

	const { error } = await syncClient.auth.signInWithOtp({
		email,
		options: { emailRedirectTo: window.location.origin + window.location.pathname }
	});

	submitButton.disabled = false;

	if (error) {
		message.textContent = `Couldn't send the link: ${error.message}`;
		return;
	}

	// The email has a link and a code. The link opens in the default browser,
	// which on iPhone isn't a Home Screen app (they have separate storage), so
	// the code lets people sign in right here instead.
	pendingEmail = email;
	form.hidden = true;
	document.getElementById('sync-code-form').hidden = false;
	document.getElementById('sync-different-email').hidden = false;
	message.textContent = `We sent a sign-in link and code to ${email}. Click the link or enter the code here.`;
	document.getElementById('sync-code-input').focus();
}

async function verifySignInCode(event) {
	event.preventDefault();

	const form = event.target;
	const submitButton = form.querySelector('button[type="submit"]');
	const token = form.querySelector('input').value.replace(/\s/g, '');
	const message = document.getElementById('sync-sign-in-message');

	if (!token || !pendingEmail) return;

	submitButton.disabled = true;
	message.textContent = 'Checking…';

	const { error } = await syncClient.auth.verifyOtp({ email: pendingEmail, token, type: 'email' });

	submitButton.disabled = false;

	if (error) {
		message.textContent = `That code didn't work: ${error.message}`;
		return;
	}

	// Supabase reports the sign-in through onAuthStateChange, which updates the
	// screen. Reset the form for the next time someone signs in.
	resetSignInForm();
}

function useDifferentEmail() {
	resetSignInForm();
	document.getElementById('sync-email-input').focus();
}

/**
 * Shows the email form again, empty, for the next time someone signs in.
 */
function resetSignInForm() {
	const form = document.getElementById('sync-sign-in-form');
	const codeForm = document.getElementById('sync-code-form');

	pendingEmail = '';
	form.reset();
	form.hidden = false;
	codeForm.reset();
	codeForm.hidden = true;
	document.getElementById('sync-different-email').hidden = true;
	document.getElementById('sync-sign-in-message').textContent = '';
}

async function signOut() {
	// Upload any pending changes before signing out.
	await syncNow();
	while (syncInFlight) await syncInFlight;
	await stopSyncing();
}

async function deleteAccount() {
	const confirmed = window.confirm('This will delete your sync account and your data stored on the sync server. Your tasks will still be stored on this device.');
	if (!confirmed) return;

	// Stop syncing first, so an in-flight upload can't recreate the data.
	const user = syncUser;
	syncUser = null;
	clearTimeout(syncPushTimer);
	if (syncInFlight) await syncInFlight;

	const { error } = await syncClient.rpc('delete_account');

	if (error) {
		syncUser = user;
		setSyncStatus(`Couldn't delete your account: ${error.message}`);
		return;
	}

	await stopSyncing();
}

/**
 * Signs out on this device only, and forgets this device's sync bookkeeping.
 * Local tasks are kept.
 */
async function stopSyncing() {
	syncUser = null;
	clearTimeout(syncPushTimer);
	clearSyncMeta();
	await syncClient.auth.signOut({ scope: 'local' });
	resetSignInForm();
	renderSyncUI();
}


/**
 * Syncing
 */

function handleLocalChange() {
	const meta = loadSyncMeta();
	if (!syncUser && !meta.userId) return;

	saveSyncMeta({
		...meta,
		dirty: true,
		localUpdatedAt: new Date().toISOString()
	});

	if (!syncUser) return;

	clearTimeout(syncPushTimer);
	syncPushTimer = setTimeout(syncNow, SYNC_PUSH_DELAY);
}

/**
 * Runs a sync, or queues one if a sync is already running.
 *
 * @return {Promise} Resolves when the current sync finishes.
 */
function syncNow() {
	if (!syncUser) return Promise.resolve();

	clearTimeout(syncPushTimer);

	if (syncInFlight) {
		syncAgain = true;
		return syncInFlight;
	}

	syncInFlight = runSync()
		.catch((error) => {
			console.error('Sync failed', error);
			setSyncStatus(window.navigator.onLine
				? 'Sync failed. It will try again when you make a change or come back to the app.'
				: 'Offline. Your changes will sync when you reconnect.');
		})
		.finally(() => {
			syncInFlight = null;
			if (syncAgain) {
				syncAgain = false;
				syncNow();
			}
		});

	return syncInFlight;
}

async function runSync() {
	const userId = syncUser.id;

	const { data: remote, error } = await syncClient
		.from('user_data')
		.select('tasks, updated_at')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) throw error;
	if (!syncUser || syncUser.id !== userId) return;

	// Everything from here to the upload is synchronous, so a change the user
	// makes while the download was in progress can't be overwritten.
	const meta = loadSyncMeta();
	const local = loadTasks();
	let tasksToPush = null;

	if (meta.userId !== userId) {
		// First sync for this user on this device: keep tasks from both sides.
		if (!remote) {
			tasksToPush = local;
		} else {
			const merged = mergeTasks(remote.tasks, local);
			const changed = !sameTasks(merged, remote.tasks);

			saveTasks(merged, { fromSync: true });
			saveSyncMeta({
				userId,
				lastSyncedAt: remote.updated_at,
				localUpdatedAt: changed ? new Date().toISOString() : remote.updated_at,
				dirty: changed
			});
			refreshTaskList();

			if (changed) tasksToPush = merged;
		}
	} else if (!remote) {
		tasksToPush = local;
	} else {
		const remoteChanged = remote.updated_at !== meta.lastSyncedAt;
		const remoteWins = remoteChanged && (!meta.dirty || isNewer(remote.updated_at, meta.localUpdatedAt));

		if (remoteWins) {
			saveTasks(remote.tasks, { fromSync: true });
			saveSyncMeta({ ...meta, lastSyncedAt: remote.updated_at, dirty: false });
			refreshTaskList();
		} else if (meta.dirty) {
			tasksToPush = local;
		}
	}

	if (tasksToPush) await pushTasks(userId, tasksToPush);

	setSyncStatus(`Last synced at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
}

/**
 * Uploads tasks with the save_tasks database function, which only saves them
 * if they're newer than the stored list. If a newer list from another device
 * is already there, it wins and replaces this device's list.
 */
async function pushTasks(userId, tasks) {
	const startMeta = loadSyncMeta();
	const updatedAt = startMeta.localUpdatedAt || new Date().toISOString();

	const { data, error } = await syncClient
		.rpc('save_tasks', { new_tasks: tasks, new_updated_at: updatedAt })
		.single();

	if (error) throw error;
	if (!syncUser || syncUser.id !== userId) return;

	const meta = loadSyncMeta();
	const changedMeanwhile = meta.localUpdatedAt !== startMeta.localUpdatedAt;

	if (changedMeanwhile) {
		// Tasks changed again during the upload. Stay dirty, and let the next
		// sync compare the newest local change with what's stored.
		saveSyncMeta({ ...meta, userId, lastSyncedAt: data.accepted ? data.saved_updated_at : meta.lastSyncedAt, dirty: true });
		syncAgain = true;
		return;
	}

	if (!data.accepted) {
		// The stored list is newer, usually because another device saved first,
		// so it wins. (If this exact upload was already saved by an earlier
		// attempt, the stored list is this one, and nothing changes.)
		saveTasks(data.saved_tasks, { fromSync: true });
		refreshTaskList();
	}

	saveSyncMeta({
		userId,
		lastSyncedAt: data.saved_updated_at,
		localUpdatedAt: meta.localUpdatedAt || updatedAt,
		dirty: false
	});
}


/**
 * Helpers
 */

/**
 * Combines two task lists: remote tasks in their order, then local tasks the
 * remote list doesn't have.
 */
function mergeTasks(remoteTasks, localTasks) {
	const remoteList = Array.isArray(remoteTasks) ? remoteTasks : [];
	const remoteIds = new Set(remoteList.map((task) => task && task.id));
	return remoteList.concat(localTasks.filter((task) => task && !remoteIds.has(task.id)));
}

function sameTasks(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

function isNewer(a, b) {
	return !b || Date.parse(a) > Date.parse(b);
}

/**
 * Re-renders the task list, unless the user is editing a task description or
 * dragging a task. In those cases it waits until they finish.
 */
function refreshTaskList() {
	const active = document.activeElement;

	if (active && active.classList.contains('task-description')) {
		active.addEventListener('blur', () => listMITs(), { once: true });
		return;
	}

	// Re-rendering mid-drag would replace the dragged element and break the drag.
	if (document.querySelector('.task.dragging')) {
		document.getElementById('task-list').addEventListener('taskdragend', renderAfterDrag, { once: true });
		return;
	}

	listMITs();
}

// A named function, so several syncs during one drag add only one listener.
function renderAfterDrag() {
	listMITs();
}

function renderSyncUI() {
	const signedIn = Boolean(syncUser);

	document.getElementById('sync-signed-out').hidden = signedIn;
	document.getElementById('sync-signed-in').hidden = !signedIn;
	document.getElementById('sync-email').textContent = signedIn ? syncUser.email : '';
	document.getElementById('sync-button').classList.toggle('signed-in', signedIn);

	if (!signedIn) setSyncStatus('');
}

function setSyncStatus(text) {
	document.getElementById('sync-status').textContent = text;
}
