# sambawa.dev: roadmap

Personal site + private file host on Cloudflare: Worker `my-website` (custom domain sambawa.dev) serving `public/`, R2 bucket `sambawa-uploads`, secret `UPLOAD_KEY`. Pushes to `main` auto-deploy.

## Resume here
- Next step: M5 — Sam keeps editing the live homepage in the site tab; report layout bugs.

## Roadmap

### M1 Portfolio site (static, live GitHub cards)
Goal: static portfolio on Cloudflare showing a curated list of GitHub repos, card details fetched client-side. No backend, no tokens in client code.
- Username: unnamedburrito · intro: placeholder (marked EDIT ME) · links: GitHub, LinkedIn (sam-bawa), samrathbawa@outlook.com
- 2026-07-03: Sam changed sourcing from `featured`-topic filter to a **curated repo list** in `CONFIG.repos` (js/app.js). Maintenance docs live in AGENTS.md (README is public-facing).
- [x] Scaffold: index.html, css/style.css, js/app.js (no framework, no build step)
- [x] Single API call, 30-min localStorage cache, rate-limit → stale-cache fallback → friendly error
- [x] Cards: title, description, language dot, stars/forks, topics, relative date, repo + Live/Demo links
- [x] Sort control (recency/stars/name) + language filter; dark mode (pre-paint script + toggle)
- [x] README (public), AGENTS.md (agent maintenance manual), .gitignore
- [x] Verified end-to-end in headless Edge: LIVE fetch (6 cards), CACHED on reload, stale-cache fallback with API blocked, error card with no cache, both themes screenshotted
- [x] 2026-11-03: Swapped in new resume (source: Projects/employment/Samrath_Bawa_Resume.tex). Rebuilt design/resume-print.html → public/assets PDF (1 page, no phone/city), on-page sheet, hero skill chips; resume.tex synced
- [x] 2026-11-03: Resume PDF now built from LaTeX via design/build_resume.py (strips phone/city). Pushes to main auto-deploy via Cloudflare (verified live)

### M2 Image host (upload.systems replacement)
Worker (`src/worker.js`) in front of the static site + R2 bucket `sambawa-uploads`. Secret `UPLOAD_KEY` guards uploads.
- [x] POST /api/upload (multipart `file` or raw body + `?name=`, optional `?keep=1`), returns {url, raw, thumbnail, delete}
- [x] /<id> → Discord embed page (og/twitter tags, theme-color, oEmbed site name + author), human viewer
- [x] /<id>.<ext> → raw file (Range support, sandboxed CSP)
- [x] Deletion URL with confirm page; dashboard delete
- [x] Settings in R2: embed title/description/color/site/author with {placeholders}, URL style (random / invisible / emoji)
- [x] /dashboard: key login, drag-drop/paste upload, gallery w/ copy + keep + delete, embed editor w/ preview, ShareX .sxcu download
- [x] 180-day auto-delete via daily cron; per-file Keep exemption (keep/<id> marker)
- [x] Verified locally with `wrangler dev` + headless Edge; purge tested against backdated fake bucket
- [x] R2 enabled, bucket created, UPLOAD_KEY set on Worker `my-website` (Sam)
- [x] 2026-11-05: sambawa.dev moved from Pages project `my-site` to Worker `my-website` (custom domain in wrangler.jsonc); Worker builds from GitHub, root `/`
- [x] Hidden door: 10 theme toggles within 5 s → /dashboard/ (verified live)
- [x] Sam tested dashboard upload, Discord embed, keep, delete on workers.dev

### M3 system24 redesign + holding page
- [x] 2026-11-08: sambawa.dev `/` shows an "under construction" landing (name, resume, GitHub, LinkedIn, email). Hidden dashboard door kept on the theme toggle.
- Old portfolio parked at `design/portfolio-index.html` (not served).
- [x] 2026-11-08: Resume PDF updated from Samrath_Bawa_Resume_1.tex via build_resume.py (phone/city stripped), verified live at /resume
- [x] design/system24-discord/index.html: Discord-layout portfolio in system24 style (channels, chat, members, input jumps channels)
- [x] design/system24-site/index.html: same style as a normal scrolling page (tmux-style tabs + status bar)
- [x] 2026-11-08: system24-site audited against vault UI/UX guide (research/2026-11-08-website-ui-ux-design-guide.md): AA contrast, landmarks + skip link + real headings, 16px body, 44px targets, light theme following OS + toggle, removed single-key shortcuts, verb+object CTAs, sticky bar only on wide screens. Verified 320px reflow + both themes in headless Edge.
- [x] 2026-11-08: Dashboard + worker file/delete pages restyled on shared public/css/system24.css (old css/style.css + js/main.js now unused, kept for restoring design/portfolio-index.html)
- [x] design/system24-template/index.html: shareable copy with all personal info replaced by placeholders
- [x] 2026-11-09: Stop-slop pass on homepage + dashboard copy; full portfolio saved to design/system24-site/index.html
- [x] 2026-11-09: public/index.html is a system24 "still building this site" page (resume, GitHub, LinkedIn, email; theme toggle hidden door kept); copy "You can contact me below."
- [x] Buttons: wide-gap double frame + filled resume (from design/double-frame-options.html), reviewed twice by ui-ux-reviewer; light accent-1 darkened to 46% for hover contrast

### M4 Live homepage editor (2026-11-10)
Homepage content is blocks in R2 (`config/site.json`); the Worker renders `/` from it, so edits need no rebuild.
- [x] public/js/site.js: block schema + validation + HTML renderer (shared by Worker, editor, preview)
- [x] public/css/home.css + public/js/home.js: homepage styles/behaviour pulled out of design/system24-site
- [x] Worker: `/` renders blocks (mode "home") or serves public/index.html (mode "building"); GET/PUT /api/site, PUT /api/site/mode; 60 s in-memory cache of site.json
- [x] Dashboard "site" tab: mode toggle, page settings, add/reorder/drag/duplicate/hide/delete blocks, edit text + links, live preview (desktop/phone), click a box in the preview to edit it
- [x] Verified with wrangler dev + headless Edge: API auth (401), bad mode (400), save keeps mode, both modes on `/`, editor edit/add/move/hide/save, link warning, phone width (no overflow), no console errors
- [x] 2026-11-10: Pushed (ce17739), deployed; verified live: editor files 200, `/` still the building page, /api/site 401 without key
- [x] Sam tested the site tab on sambawa.dev/dashboard
- [x] 2026-11-10: Card top edges vanished in the scaled preview / after wrapped titles: now a real border cut by the title's background (052c143)

### M5 Homepage live
- [ ] Sam edits the homepage content in the site tab until happy
- [x] 2026-11-10: Sam flipped the toggle to Homepage (live)
- [x] 2026-11-11: Homepage buttons + theme toggle now use the chosen wide-gap double frame (home.css had kept the old flat style)
- [ ] Sam confirms final repo list (repo cards: set "GitHub repo name" on a card)

### M6 Cleanup
- [ ] [MANUAL — Sam] Download .sxcu from sambawa.dev/dashboard → ShareX tab, double-click to import
- [ ] [MANUAL — Sam] Delete Pages project `my-site` (no domain now; still builds on push)
- [ ] Remove unused public/css/style.css + public/js/main.js once the old portfolio is no longer needed
