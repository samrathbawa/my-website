# Portfolio Site — sambawa.dev

## Goal
Static portfolio site on Cloudflare Pages (custom domain sambawa.dev) showing a curated list of GitHub repos, with card details fetched live client-side from the GitHub API. No backend, no tokens in client code.

## Decisions
- Username: unnamedburrito · intro: placeholder (marked EDIT ME) · links: GitHub, LinkedIn (sam-bawa), samrathbawa@outlook.com
- 2026-07-03: Sam changed sourcing from `featured`-topic filter to a **curated repo list** in `CONFIG.repos` (js/app.js). Maintenance docs live in AGENTS.md (README is public-facing).
- Provisional repo list (awaiting Sam's final list): ForzaFFB, gwyf-helper, claude-auto-retry-windows, CS2450-UI-project, CanvasResponder, unreal-modding

## Done
- [x] Scaffold: index.html, css/style.css, js/app.js (no framework, no build step)
- [x] Single API call, 30-min localStorage cache, rate-limit → stale-cache fallback → friendly error
- [x] Cards: title, description, language dot, stars/forks, topics, relative date, repo + Live/Demo links
- [x] Sort control (recency/stars/name) + language filter; dark mode (pre-paint script + toggle)
- [x] README (public), AGENTS.md (agent maintenance manual), .gitignore
- [x] Verified end-to-end in headless Edge: LIVE fetch (6 cards), CACHED on reload, stale-cache fallback with API blocked, error card with no cache, both themes screenshotted
- [x] Committed
- [x] 2026-11-03: Swapped in new resume (source: Projects/employment/Samrath_Bawa_Resume.tex). Rebuilt design/resume-print.html → public/assets PDF (1 page, no phone/city), on-page sheet, hero skill chips; resume.tex synced

## Remaining
- [ ] Sam confirms final repo list → update CONFIG.repos in js/app.js
- [ ] [MANUAL — Sam] Push to GitHub, connect Cloudflare Pages (no build command, output `/`), add sambawa.dev + www custom domains
- [ ] Sam rewrites hero intro placeholder when ready
- [x] 2026-11-03: Resume PDF now built from LaTeX via design/build_resume.py (strips phone/city). Pushes to main auto-deploy via Cloudflare (verified live)

## 2026-11-04: Image host (upload.systems replacement)
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
- [ ] [MANUAL — Sam] Download .sxcu from sambawa.dev/dashboard → ShareX tab, double-click to import
- [ ] [MANUAL — Sam] Delete Pages project `my-site` (no domain now; still builds on push)

## 2026-11-08: Holding page
- [x] sambawa.dev `/` now shows an "under construction" landing (name, resume, GitHub, LinkedIn, email). Hidden dashboard door kept on the theme toggle.
- Full portfolio page parked at `design/portfolio-index.html` (not served). Restore: `git mv design/portfolio-index.html public/index.html`
- [x] 2026-11-08: Resume PDF updated from Samrath_Bawa_Resume_1.tex via build_resume.py (phone/city stripped), verified live at /resume

## 2026-11-08: system24 redesigns (local only, not deployed)
- [x] design/system24-discord/index.html: Discord-layout portfolio in system24 style (channels, chat, members, input jumps channels)
- [x] design/system24-site/index.html: same style as a normal scrolling page (tmux-style tabs + status bar, keys 1-6)
- [ ] Sam picks one to go live (would replace public/index.html holding page)
- [x] 2026-11-08: system24-site audited against vault UI/UX guide (research/2026-11-08-website-ui-ux-design-guide.md): AA contrast, landmarks + skip link + real headings, 16px body, 44px targets, light theme (system24 light flavor) following OS + toggle, removed single-key shortcuts, verb+object CTAs, sticky bar only on wide screens. Verified 320px reflow + both themes in headless Edge.
- [x] 2026-11-08: system24-site is now the live homepage (public/index.html; resume links -> /resume). Dashboard + worker file/delete pages restyled on shared public/css/system24.css (old css/style.css + js/main.js now unused, kept for restoring design/portfolio-index.html). Hidden dashboard door kept on the theme toggle.
- [x] design/system24-template/index.html: shareable copy with all personal info replaced by placeholders (CONFIG.user empty skips GitHub fetches)
