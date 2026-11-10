# Notes

## 2026-11-10 — Live homepage editor

**Where to edit:** sambawa.dev/dashboard → **4:site**. To get there, use the upload key, or click the theme toggle 10 times in 5 seconds.

**Top bar:**
- **Homepage / Still building page** switches what visitors see. It saves right away and asks you to confirm first.
- **Save homepage** publishes your edits. **Discard changes** goes back to the last save.

**Blocks:**
- Each block is a box on the page, listed top to bottom.
- Drag a block by its ⠿ grip, or use ↑ ↓ to move it.
- ⧉ duplicates a block, **Hide** keeps it but stops showing it, and ✕ deletes it.
- Click a block's name to open its fields.

**Fields on every block:**
- **Label** is the word on the box's border, and the nav tab if **Show in top nav** is ticked.
- **Width** is Full, Two thirds or One third. Two-thirds and one-third blocks sit side by side on wide screens.

**Block types:**
- **Intro** has an ASCII banner, text and buttons.
- **List** has rows with a title and subtitle, plus an optional progress bar with start and end dates.
- **Tags** is groups of chips, comma separated.
- **Cards** are for projects, jobs and certificates.
  - **Compact** style is for certificates.
  - Put a name in **GitHub repo name** to pull the description, language and stars live.
- **Text** is paragraphs and buttons.
- **Image:** copy raw on a file in the files tab, then paste it as the URL.
- **GitHub activity** shows the contribution calendar.
- **Contact** has a big email link, buttons and small print. `{year}` in the small print becomes the current year.

**Text formatting:** `**bold**`, `[text](https://link)`, and a blank line starts a new paragraph.

**Links:** only `https://`, `mailto:`, `/path` and `#section` links work. Anything else gets a red "Not used" warning.

**Preview:** shows unsaved changes, at desktop or phone width. Click any box in the preview to jump to its fields.

**After saving:** the live page can take up to a minute to show the change (60 s in-memory cache per Cloudflare server).

**Starting over:** "Start over from the original portfolio" at the bottom refills the draft with the design/system24-site content. Nothing goes live until you save.
