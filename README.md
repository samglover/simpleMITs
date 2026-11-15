# simpleMITs

A simple tool for keeping track of your Most Important Tasks (MITs). Use it at [simpleMITs.com](https://simplemits.com). [Read more in the FAQ.](https://simplemits.com?modal=faq)

Built by [Sam Glover](https://samglover.net). 

[Changelog](https://github.com/samglover/simpleMITs/blob/master/CHANGELOG.md)

## Host simpleMITs yourself

simpleMITs is a static site: HTML, CSS, and JavaScript, with no server code. You can host your own copy anywhere that serves static files. Sync is optional and off by default.

### On GitHub Pages

1. **Fork this repository.**
2. **Delete the `CNAME` file**, which points to simplemits.com. To use your own domain, add it under **Settings → Pages → Custom domain** instead.
3. **Turn on GitHub Actions.** GitHub disables workflows in forks until you enable them on your fork's **Actions** tab.
4. **Publish with GitHub Actions.** Under **Settings → Pages**, set **Source** to **GitHub Actions**.
5. **Deploy.** Push to `main`, or run the **Deploy to GitHub Pages** workflow from the **Actions** tab. Your copy will be at `https://<your-username>.github.io/simpleMITs/`, or at your custom domain.

### Anywhere else

Upload the repository's files to any static host or web server, such as Netlify, Cloudflare Pages, or your own server. There's nothing to build; the compiled CSS is already in the repo. You can leave out the development files (`tests/`, `scripts/`, `.github/`, `package.json`, and so on).

### On your own computer

The page needs to be served over HTTP. Opening `index.html` directly from your files won't load the FAQ. With [Node.js](https://nodejs.org/) installed:

```sh
npx serve . -l 3471
```

Then open <http://localhost:3471>.

### Turning on sync

To let people sync their tasks across devices, you need your own free [Supabase](https://supabase.com) project. Your copy never connects to simplemits.com's database: the Supabase settings live in `assets/js/config.js`, which isn't in this repository. Follow the steps in [supabase/README.md](supabase/README.md), using your site's address wherever it says `simplemits.com`.

Once sync is on, you're responsible for your users' email addresses and tasks, so update the FAQ and add a privacy policy that says who can access their data.

### Development

To change styles, edit the SCSS in `assets/scss/` and run `npm install` once, then `npm run dev` to rebuild the CSS as you work (or `npm run build` for a compressed build). Run the tests with `npm test`.

### License

simpleMITs is licensed under the [GNU General Public License v3.0](LICENSE). You're free to host, change, and share it. If you distribute a modified version, it must also be under the GPL.
