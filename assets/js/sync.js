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
	message.textContent = error
		? `Couldn't send the link: ${error.message}`
		: `Check ${email} for a sign-in link.`;
}

async function signOut() {
	// Upload any pending changes before signing out.
	await syncNow();
	await stopSyncing();
}

async function deleteAccount() {
	const confirmed = window.confirm('Delete your sync account and the copy of your tasks on the sync server? The tasks on this device will stay.');
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
	renderSyncUI();
}


/**
 * Syncing
 */

function handleLocalChange() {
	if (!syncUser) return;

	saveSyncMeta({
		...loadSyncMeta(),
		dirty: true,
		localUpdatedAt: new Date().toISOString()
	});

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

async function pushTasks(userId, tasks) {
	const startMeta = loadSyncMeta();
	const updatedAt = startMeta.localUpdatedAt || new Date().toISOString();

	const { data, error } = await syncClient
		.from('user_data')
		.upsert({ user_id: userId, tasks, updated_at: updatedAt })
		.select('updated_at')
		.single();

	if (error) throw error;

	// If tasks changed again during the upload, stay dirty and sync again.
	const meta = loadSyncMeta();
	const changedMeanwhile = meta.localUpdatedAt !== startMeta.localUpdatedAt;

	saveSyncMeta({
		userId,
		lastSyncedAt: data.updated_at,
		localUpdatedAt: meta.localUpdatedAt || updatedAt,
		dirty: changedMeanwhile
	});

	if (changedMeanwhile) syncAgain = true;
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
 * Re-renders the task list, unless the user is editing a task description.
 * In that case it waits until they finish.
 */
function refreshTaskList() {
	const active = document.activeElement;

	if (active && active.classList.contains('task-description')) {
		active.addEventListener('blur', () => listMITs(), { once: true });
		return;
	}

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
