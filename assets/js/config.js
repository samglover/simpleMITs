/* exported SIMPLEMITS_CONFIG */

/**
 * Optional Supabase settings for syncing tasks across devices.
 *
 * Leave both values empty to disable sync. The app then works entirely from
 * local storage, and the Sync button stays hidden.
 *
 * The key is Supabase's public "anon" (or "publishable") key. It is meant to
 * be public; row-level security in supabase/setup.sql protects the data.
 * Never put the service-role (secret) key here.
 */
const SIMPLEMITS_CONFIG = {
	supabaseUrl: '',
	supabaseKey: ''
};
