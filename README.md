# Writing Feedback Studio

A single-file browser app for marking student writing with editing mode, suggesting mode, feedback comments, IELTS band scoring, image prompts, session save/load, and standalone student exports.

## Quick Start

Open `index.html` in a browser. No build step, backend, account, or internet connection is required.

Use the **Download for offline use** button in the app to save a self-contained HTML copy. Open that downloaded file whenever you want to use the app offline.

## How The App Works

1. Fill in the assignment details, student name, and optional task prompt.
2. Use **Editing** mode to paste, type, import, or format the student's writing.
3. Add task images by uploading them in **Add image(s)** or by pasting images into the app.
4. Switch to **Suggesting** mode to mark changes:
   - teacher additions appear in green;
   - deleted student text remains visible in red strikethrough;
   - undo and redo work for app edits.
5. Select text to add feedback comments. Choose a feedback type, write an explanation, and paste screenshots into the comment if useful.
6. Enter whole-band IELTS scores for the four criteria. The app calculates the overall band by averaging and rounding to the nearest half band.
7. Export for the student:
   - **Student HTML** downloads a standalone feedback page;
   - **PDF** opens the browser print dialog so you can save as PDF.

The **How it works** button beside **Download for offline use** shows these instructions inside the app.

## Sessions

Use **Save session** to download an editable JSON file containing the current writing, suggestions, comments, comment images, scores, task image, and settings.

Use **Load session** to restore that JSON file later and continue marking.

## CrushIELTS Logo

The CrushIELTS logo is off by default. Teachers working at CrushIELTS can enable it using the checkbox near the bottom of the teacher view. Other users can leave it off.

## Files

- `index.html` - the complete app
- `README.md` - usage notes

## Privacy And Offline Use

The app runs locally in the browser. It does not require a server. If you use the downloaded offline copy, the app can work entirely without internet access.
