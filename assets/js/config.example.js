/* exported SIMPLEMITS_CONFIG */

/**
 * Optional Supabase settings for syncing tasks across devices.
 *
 * To use sync locally, copy this file to config.js (which git ignores) and
 * fill in your own project's values. On GitHub Pages, the deploy workflow
 * writes config.js from the SUPABASE_URL and SUPABASE_KEY repository
 * variables instead. See supabase/README.md.
 *
 * Without config.js, or with these values empty, sync is off: the app works
 * entirely from local storage, and the Sync button stays hidden.
 *
 * The key is Supabase's public "anon" (or "publishable") key. It is meant to
 * be public; row-level security in supabase/setup.sql protects the data.
 * Never put the service-role (secret) key here.
 */
const SIMPLEMITS_CONFIG = {
	supabaseUrl: '',
	supabaseKey: ''
};
