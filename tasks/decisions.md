# Decisions

- **Hosting:** sambawa.dev is served by the Cloudflare **Worker** `my-website` (static assets from `public/` + R2 bucket `sambawa-uploads`). It is not served by the Pages project `my-site`.
- **Free tier:** Workers on the free plan fail instead of billing when over the limit. R2 is the only part that can bill (over 10 GB stored, 1M writes or 10M reads a month). The homepage keeps `site.json` in memory for 60 s, so page views rarely read R2.
- **Homepage content lives in R2, not in code (2026-11-10):** `config/site.json` holds the page settings, the blocks and the mode. It is edited in the dashboard's site tab. The Worker renders `/` on each request, so edits need no rebuild.
- **One renderer:** `public/js/site.js` holds the block schema, validation and HTML. The Worker, the editor forms and the live preview all use it. A new block type means editing this file plus `public/css/home.css`.
- **Mode toggle:** `building` serves the static `public/index.html` unchanged. `home` serves the rendered blocks. If R2 can't be read, the Worker falls back to the building page. The default mode is `building`.
- **Links are whitelisted:** only `https://`, `http://`, `mailto:`, `/path` and `#anchor` links are kept. Everything else is dropped on save and on render.
- **Resume:** `/resume` redirects to the PDF, which is built from LaTeX by `design/build_resume.py`. Phone and city are stripped only for the site copy.
