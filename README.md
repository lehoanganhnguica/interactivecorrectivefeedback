# Writing Feedback Cloud Version

This is a separate GitHub Pages, Vercel, and Supabase-ready version of the Writing Feedback app. It keeps the original marking editor available for free guest use, then adds teacher and student account workspaces for saving, organizing, and sharing marked papers.

This version is intentionally static. There is no build step, so it can be opened locally or deployed as plain files.

## What This Version Adds

- Landing page with three choices: create account, log in, or continue as guest.
- Guest workspace that autosaves papers locally in the current browser.
- Teacher account workspace that autosaves collections and marked papers in Supabase.
- Student account workspace for opening shared marked papers as interactive read-only HTML exports.
- Teacher classes, student email rosters, and class-based paper sharing.
- Saved paper records keep the original editor session JSON, so teachers can reopen, edit, save, and export later.
- Shared paper records keep both the original session JSON and a generated student HTML export.
- Embedded copy of the existing editor at `editor.html`.
- Supabase SQL schema with row-level security in `supabase/schema.sql`.

## Local Preview

Open `index.html` directly, or run a small local static server:

```bash
python3 -m http.server 8780
```

Then open `http://127.0.0.1:8780`.

Guest mode works without any Supabase setup and autosaves to the current browser.

## Enable Supabase Account Mode

1. Create a Supabase project.
2. Open Supabase SQL editor, clear the editor completely, paste the full contents of `supabase/schema.sql` starting from line 1, then click Run.
3. Edit `config.js`.
4. Add your project values:

   ```js
   window.WFS_CONFIG = {
     supabaseUrl: "https://your-project.supabase.co",
     supabaseAnonKey: "your-public-anon-key"
   };
   ```

The anon key is safe to expose in the frontend when row-level security is enabled. Do not put the service-role key in this app.

## Deploy To GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open `Settings` -> `Pages`.
3. Set the source to deploy from the branch that contains this app.
4. Select `/root` if `index.html` is in the repository root.
5. Wait for GitHub to show the published site URL.
6. In Supabase, open `Authentication` -> `URL Configuration`.
7. Set `Site URL` to the GitHub Pages URL, such as `https://your-name.github.io/your-repo/`.
8. Add the same URL to the redirect allow list. You can also add `https://your-name.github.io/your-repo/**`.

GitHub Pages hosts the static app. Supabase handles auth, database storage, and row-level security.

## Deploy To Vercel

1. Push this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Keep the framework preset as static/no build, or leave build settings blank.
4. Deploy.

Vercel is optional. It can host the same static app if you prefer its preview deployments and rollback tools.

## Confirmation Email 404

If a Supabase confirmation email opens a GitHub Pages `404` page, check these two things:

1. Open the GitHub Pages URL directly before testing auth. If the app itself is 404, enable Pages in `Settings` -> `Pages`, select the correct branch and `/root` folder, and wait for the Pages deployment to finish.
2. In Supabase `Authentication` -> `URL Configuration`, make sure `Site URL` and the redirect allow list use the exact published app URL, including the repository path and trailing slash.

For GitHub Pages, use the app root URL as the redirect target. Do not use a route like `/auth/callback` unless that file actually exists in the static site.

## Data Model

- `profiles`: signed-in users with an `account_role` of `teacher` or `student`.
- `collections`: paper folders owned by a teacher.
- `papers`: saved marked papers owned by a teacher, optionally assigned to a collection.
- `papers.session_json`: the complete original editor session, including writing, comments, feedback types, scores, images, readability settings, and export settings.
- `classes`: teacher-owned class groups.
- `class_members`: student emails added to a teacher class.
- `paper_shares`: generated student HTML exports shared with specific student account emails.

Students see shares addressed to the email they used for their account. Teachers do not need admin-level user lookup; they add the student account email to a class, then share the current marked paper with that class.

## Teacher And Student Workflow

1. A teacher creates a teacher account.
2. The teacher creates a class in the `Classes` tab.
3. The teacher adds student account emails to the class roster.
4. The teacher marks a paper, opens the class, and chooses `Share current paper`.
5. Each student logs in with a student account using that email.
6. The shared paper appears in the student workspace, grouped by class.
7. Students open the shared paper as an interactive HTML export and click highlighted feedback to view the teacher comments.

For production use with very large image-heavy papers, consider moving export images to Supabase Storage instead of storing every generated HTML export directly in Postgres.

## Guest Mode

Guest mode uses browser local storage. It is meant for teachers who do not want accounts. It should be treated like the current offline app: useful immediately and autosaved on the same browser, but not synced across devices.

## Autosave Behavior

- The cloud workspace hides manual session import/export controls because papers autosave while teachers work.
- Signed-in users autosave paper session JSON to Supabase.
- Guest users autosave the same paper session JSON to local storage.
- The embedded editor keeps its export buttons near the editing controls, so teachers can export the current paper as Student HTML or PDF from the marking area.
