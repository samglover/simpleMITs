# Setting up sync

Sync is optional. Without Supabase settings in `assets/js/config.js`, simpleMITs works entirely from the browser's local storage and the Sync button is hidden.

`config.js` isn't in the repo, so a fork or downloaded copy never syncs to someone else's Supabase project. Each copy uses its own settings: a local file for development, and repository variables when deployed to GitHub Pages.

To turn on sync:

1. **Create a Supabase project** at [supabase.com](https://supabase.com). The free plan is enough.
2. **Create the table and permissions.** In the project's **SQL Editor**, paste and run [`setup.sql`](setup.sql).
3. **Set the sign-in redirect URLs.** Under **Authentication → URL Configuration**:
   - Set **Site URL** to `https://simplemits.com`.
   - Add these **Redirect URLs**: `https://simplemits.com` and `http://localhost:3471` (for local testing).
4. **Check that email sign-in is on.** Under **Authentication → Sign In / Providers**, the **Email** provider should be enabled. It is by default.
5. **Customize the emails (optional).** Under **Authentication → Emails**, edit the **Magic Link** and **Confirm signup** templates so they mention simpleMITs. New users get the "Confirm signup" email the first time they sign in.
6. **Find your project URL and key.**
   - **Project URL:** under **Project Settings → Data API**, copy the **Project URL**. It looks like `https://<project-ref>.supabase.co`, where the project ref is the ID in your dashboard's address bar.
   - **Key:** under **Project Settings → API Keys**, copy the public key (labeled *publishable* or *anon*). Never use the *secret* or *service_role* key; it bypasses all permissions.
7. **Add them for local development.** Copy `assets/js/config.example.js` to `assets/js/config.js` and fill in both values. Git ignores `config.js`, so it stays on your computer.
8. **Add them for GitHub Pages.** In your GitHub repository:
   - Under **Settings → Secrets and variables → Actions → Variables**, add repository variables named `SUPABASE_URL` and `SUPABASE_KEY`.
   - Under **Settings → Pages**, set **Source** to **GitHub Actions**.

   On each push to `main`, [the deploy workflow](../.github/workflows/deploy.yml) writes `config.js` from those variables and publishes the site. If the variables aren't set, the site deploys with sync turned off.

## Before launch

- **Email sending limits.** Supabase's built-in email only sends a few emails per hour and isn't meant for production. Set up your own email provider under **Authentication → Emails → SMTP Settings**.
- **Free projects pause.** Supabase pauses free projects after about a week with no activity. Check the current terms, and consider the paid plan if the app may go quiet for that long.
- **Privacy.** With sync turned on, you store users' email addresses and tasks. Update the FAQ and add a privacy policy before inviting people to use it.

## How sync works

- The app always reads and writes local storage, so it stays fast and works offline.
- When someone is signed in, their whole task list is stored as one row in `user_data`. Changes upload about a second after they're made, and the app checks for changes from other devices when it opens or comes back into view.
- The first time someone signs in on a device, tasks from the device and the server are combined, so nothing is lost.
- After that, if the list changed on two devices before either could sync, the most recent change wins and the other is discarded.
- Display preferences (text size, maximized/minimized) are not synced; each device keeps its own.
- Signing out or deleting the account leaves the tasks on that device in place.
