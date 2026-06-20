# Interactive Corrective Feedback — GitHub Pages package

This folder contains the current deployable version of the app.

## Package contents

- `index.html` — the complete self-contained app
- `.nojekyll` — tells GitHub Pages to serve the files directly

No build command, package manager, server, or external assets are required.

## Deploy by uploading files on GitHub

1. Open the `interactivecorrectivefeedback` repository on GitHub.
2. Switch to the branch used by GitHub Pages, usually `main`.
3. At the repository root, replace the existing `index.html` with the one in this folder.
4. Upload `.nojekyll` as well.
5. Commit the changes.
6. Open **Settings → Pages** and confirm that the site is deployed from the correct branch and the repository root (`/`).
7. Wait for the Pages deployment to finish, then hard-refresh the website:
   - Windows: `Ctrl + F5`
   - macOS: `Command + Shift + R`

## Important

Upload the files *inside* this folder to the repository root. Do not upload the containing folder as a subfolder, or GitHub Pages will continue serving the old root-level `index.html`.

The app stores autosaved work in the browser. Replacing `index.html` does not intentionally erase saved work, but keeping a backup session is recommended before deployment.
