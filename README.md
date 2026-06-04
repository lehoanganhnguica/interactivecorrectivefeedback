# Writing Feedback Studio

A single-file browser app for marking student writing with editing mode, suggesting mode, feedback comments, IELTS band scoring, image prompts, session save/load, and standalone student exports.

## Quick Start

Open `index.html` in a modern browser. No build step, backend, account, or internet connection is required.

Use the **Download for offline use** button in the app to save a self-contained HTML copy. Open that downloaded file whenever you want to use the app offline.

The app is a static browser app and is designed to work on both macOS and Windows in current versions of Chrome, Edge, Firefox, and Safari.

## How The App Works

1. Fill in the assignment details, student name, and optional task prompt.
2. Use **Editing** mode to paste, type, import, or format the student's writing.
3. Add task prompt images in **Add image(s)**. For images inside the student writing, stay in **Editing** mode, click the writing area, then paste with **Cmd+V** on macOS or **Ctrl+V** on Windows.
4. Switch to **Suggesting** mode to mark changes:
   - teacher additions appear in bold green;
   - deleted student text remains visible in red strikethrough;
   - right-click a green addition to remove it;
   - right-click a red deletion to restore the original text;
   - undo and redo work for app edits.
5. Select text to add feedback comments. Choose a feedback type, write an explanation, and paste screenshots into the comment if useful.
6. Enter whole-band IELTS scores for the four criteria. The app calculates the overall band by averaging and rounding to the nearest half band.
7. Use the **Readability** controls below the formatting bar to switch between light, dark, and contrast themes, increase or decrease the student text size, and use **Default** to return the student export text to 18px.
8. Drag the bottom-right corner of a pasted writing image to resize it. Right-click a pasted writing image and choose **Remove image** to delete it.
9. Export for the student:
   - **Student HTML** downloads a standalone feedback page;
   - **PDF** opens the browser print dialog so you can save as PDF.

The **How it works** button beside **Download for offline use** shows these instructions inside the app.

## Sessions

The app autosaves the current draft in the same browser, so refreshing, accidentally closing the window, or reopening the app on the same device should restore the latest work.

Use **Save session** to download an editable JSON file containing the current writing, suggestions, comments, comment images, scores, task image, readability choices, and settings.

Use **Load session** to restore that JSON file later and continue marking.

Autosave is local to the browser and device. To move work to another browser or computer, use **Save session** and **Load session**.

Account sign-in and cloud session storage are possible, but they require an external backend such as Firebase or Supabase because GitHub Pages only hosts static files.

## CrushIELTS Logo

The CrushIELTS logo is off by default. Teachers working at CrushIELTS can enable it using the checkbox near the bottom of the teacher view. Other users can leave it off.

## Files

- `index.html` - the complete app
- `README.md` - usage notes

## GitHub Pages Deployment

1. Create a new GitHub repository.
2. Upload `index.html` and `README.md` to the repository root.
3. In the repository, open **Settings** -> **Pages**.
4. Set the source to deploy from the main branch root.
5. Open the published GitHub Pages URL after deployment finishes.

## Privacy And Offline Use

The app runs locally in the browser. It does not require a server. If you use the downloaded offline copy, the app can work entirely without internet access.
