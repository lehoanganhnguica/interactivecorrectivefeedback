# Deploying Writing Feedback Studio On GitHub Pages

This package is a static website. It does not need a build step, server, database, or API key.

## Files To Upload

- `index.html`
- `README.md`
- `.nojekyll`
- `DEPLOYMENT.md` (optional, for your own reference)

## GitHub Pages Steps

1. Create a new GitHub repository.
2. Upload the package files to the repository root.
3. Open the repository **Settings**.
4. Go to **Pages**.
5. Set **Build and deployment** to deploy from a branch.
6. Choose the `main` branch and `/ (root)` folder.
7. Save and wait for GitHub to publish the site.

## Compatibility Notes

- Works as a static browser app on macOS and Windows.
- Recommended browsers: current Chrome, Edge, Firefox, or Safari.
- For images inside the writing area, use **Cmd+V** on macOS or **Ctrl+V** on Windows while the editor is in Editing mode.
- Pasted writing images can be resized by dragging the bottom-right corner and removed through right-click.
- Autosave uses the browser's local storage, so drafts restore on the same device and browser after refresh or accidental close.
- Use **Save session** and **Load session** to move editable work between devices or browsers.
