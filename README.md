# sambawa.dev

Personal portfolio for Samrath (Sam) Bawa. One static page — no framework, no build step.
Project cards and the contribution calendar load live from GitHub, so they're never stale.

## Structure

```
public/            ← static files (served as-is)
  index.html
  css/style.css
  js/main.js       ← curated repo list lives in CONFIG at the top
  assets/resume.pdf
  dashboard/       ← uploads dashboard (sambawa.dev/dashboard)
src/worker.js      ← file host: ShareX uploads, Discord embeds, retention cron
wrangler.jsonc     ← Worker config: R2 bucket, cron, static assets
design/            ← not deployed: wireframe + resume print source
resume.tex         ← not deployed (contains private contact details)
PRODUCT.md         ← design context (register, principles)
DESIGN.md          ← visual system (tokens, type, motion)
```

## Editing

- **Add/remove a project card**: edit `CONFIG.repos` in `public/js/main.js` AND add/remove
  the matching `<li class="project-card" data-repo="...">` in `index.html` (static fallback
  keeps the site useful without JavaScript).
- **Regenerate the resume PDF** after editing `../employment/Samrath_Bawa_Resume.tex`:
  ```
  python design/build_resume.py
  ```
  Compiles a copy with phone + city stripped (needs MiKTeX `pdflatex`) into
  `public/assets/Sam Bawa Resume.pdf`. The on-page resume in `index.html` is hand-written
  HTML, so update it to match. `design/resume-print.html` is the old HTML print source, no longer used.

## Homepage (edited live)

`sambawa.dev/dashboard` → **site** tab. The homepage is a list of blocks saved in R2
(`config/site.json`). The Worker renders `/` from it on each request, so edits need no rebuild.
A toggle switches `/` between the homepage and the static "still building" page (`public/index.html`).

- `public/js/site.js`: block types and their fields, validation and the HTML renderer. The Worker,
  the editor forms and the preview all use it. To add a block type, edit this file and `public/css/home.css`.
- `public/js/home.js`: homepage behaviour (theme toggle, nav, clock, GitHub cards + calendar).
- `public/dashboard/site-editor.*`: the editor.
- API (upload key required): `GET/PUT /api/site` (page + blocks), `PUT /api/site/mode` (`home` | `building`).

## Uploads (ShareX + Discord embeds)

`sambawa.dev/dashboard` → unlock with the upload key → upload, copy links, delete,
edit the Discord embed, pick the link style, and download the ShareX config.

- `/<id>` is the embed page Discord unfurls; `/<id>.<ext>` is the raw file.
- Files auto-delete after 180 days (`RETENTION_DAYS` in `src/worker.js`, daily cron).
  Press **Keep** on a file to exempt it, or upload with `?keep=1`.
- Storage: R2 bucket `sambawa-uploads` (`f/<id>` files, `keep/<id>` markers, `config/settings.json`).

One-time setup:
```
npx wrangler login
npx wrangler r2 bucket create sambawa-uploads
npx wrangler secret put UPLOAD_KEY        # paste a long random string
```
Served by the Worker `my-website` (custom domain `sambawa.dev` is declared in `wrangler.jsonc`).
Its GitHub build uses root directory `/` and deploy command `npx wrangler deploy`.
Hidden way in: click the theme toggle 10 times within 5 seconds.

Local: put `UPLOAD_KEY=anything` in `.dev.vars` (gitignored), then `npx wrangler dev`.

## Local preview

```
python -m http.server 8199 --directory public
```

## Deploy — Cloudflare Workers (free)

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
3. Build settings: **no build command**, output directory = `public`.
4. After the first deploy: Custom domains → add `sambawa.dev` and `www.sambawa.dev`
   (domain is already on Cloudflare, so DNS is one click).

$0/month. HTTPS and CDN automatic. Every push to `main` redeploys.
