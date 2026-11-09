// sambawa.dev worker. The static site in public/ is served as-is; this adds a private
// file host on top: ShareX uploads, Discord embeds, and the API behind /dashboard.
// Files live in R2 under f/<id>; embed + URL settings live in one JSON object.
// A daily cron deletes files older than RETENTION_DAYS unless an empty keep/<id> marker exists.

const SETTINGS_KEY = 'config/settings.json';
const RETENTION_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_UPLOAD = 95 * 1024 * 1024; // Workers cap request bodies at 100 MB
const TEXT_PREVIEW_MAX = 256 * 1024;

const DEFAULT_SETTINGS = {
  embed: {
    enabled: true,
    title: '{filename}',
    description: '{size} · {date}',
    color: '#303030',
    siteName: 'sambawa.dev',
    siteUrl: 'https://sambawa.dev',
    authorName: '',
    authorUrl: '',
  },
  url: { style: 'random', length: 8 },
};

// [min, max] id length per URL style
const ID_LENGTHS = { random: [4, 32], emoji: [3, 16], invisible: [16, 48] };
const ID_ALPHABETS = {
  random: [...'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'],
  emoji: [...'😀😂😎🤖👻🎃🐸🐙🦊🐼🐧🦄🐝🍕🍔🍩🍉🍓🌮🥑🌵🌈🔥⭐🌙🍀🎲🎮🎧🚀🛸💎🔮🎈🧊🪐🐢🦖🐳🍄'],
  invisible: ['​', '‌', '‍', '⁠'],
};

const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4',
  txt: 'text/plain; charset=utf-8', log: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8',
  json: 'application/json', pdf: 'application/pdf', zip: 'application/zip',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(request, env, url);
      if (request.method === 'GET' || request.method === 'HEAD') {
        const res = await serveUpload(request, env, url);
        if (res) return res;
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error(err);
      return json({ error: 'Server error' }, 500);
    }
  },

  async scheduled(controller, env) {
    const purged = await purgeExpired(env);
    console.log(`retention: purged ${purged} file(s) older than ${RETENTION_DAYS} days`);
  },
};

async function purgeExpired(env) {
  const kept = await keptIds(env);
  const cutoff = Date.now() - RETENTION_DAYS * DAY_MS;
  const doomed = (await listAll(env, 'f/'))
    .filter((o) => o.uploaded.getTime() < cutoff && !kept.has(o.key.slice(2)))
    .map((o) => o.key);
  for (let i = 0; i < doomed.length; i += 1000) await env.UPLOADS.delete(doomed.slice(i, i + 1000));
  return doomed.length;
}

/* ---------- public file routes ---------- */

// /<id> is the embed/viewer page, /<id>.<ext> is the raw file.
function parseUploadPath(pathname) {
  let p;
  try { p = decodeURIComponent(pathname.slice(1)); } catch { return null; }
  if (!p || p.includes('/')) return null;
  const dot = p.lastIndexOf('.');
  return dot > 0 ? { id: p.slice(0, dot), raw: true } : { id: p, raw: false };
}

async function serveUpload(request, env, url) {
  const ref = parseUploadPath(url.pathname);
  if (!ref) return null;
  if (ref.raw) return serveRaw(request, env, ref.id);

  const settings = await getSettings(env);
  if (!settings.embed.enabled) return serveRaw(request, env, ref.id);

  const obj = await env.UPLOADS.head(fileKey(ref.id));
  if (!obj) return null;
  let text = null;
  if (isText(obj) && obj.size <= TEXT_PREVIEW_MAX) {
    text = await (await env.UPLOADS.get(fileKey(ref.id))).text();
  }
  return html(viewerPage(obj, ref.id, settings, url.origin, text));
}

async function serveRaw(request, env, id) {
  const obj = await env.UPLOADS.get(fileKey(id), { range: request.headers, onlyIf: request.headers });
  if (!obj) return null;

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'public, max-age=86400');
  headers.set('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName(obj, id))}`);
  // Uploads share an origin with the dashboard, so never let one run script here.
  headers.set('content-security-policy', 'sandbox');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-robots-tag', 'noindex');

  if (!('body' in obj)) return new Response(null, { status: 304, headers });

  let status = 200;
  if (request.headers.has('range') && obj.range) {
    const r = obj.range;
    const suffix = r.suffix != null;
    const offset = suffix ? obj.size - r.suffix : (r.offset ?? 0);
    const length = suffix ? r.suffix : (r.length ?? obj.size - offset);
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    status = 206;
  }
  return new Response(request.method === 'HEAD' ? null : obj.body, { status, headers });
}

/* ---------- API ---------- */

async function api(request, env, url) {
  const route = url.pathname.slice('/api/'.length);
  const method = request.method;

  // Public: oEmbed (Discord reads site name + author from it) and ShareX deletion links.
  if (route === 'oembed') return oembed(env, url);
  if (route === 'delete') return deletionLink(request, env, url);

  if (!authorized(request, env)) return json({ error: 'Unauthorized' }, 401);

  if (route === 'upload' && method === 'POST') return upload(request, env, url);
  if (route === 'files' && method === 'GET') return listFiles(env, url);
  // files/<id> (DELETE) and files/<id>/keep (PUT = never auto-delete, DELETE = normal retention)
  const fileRoute = /^files\/([^/]+)(\/keep)?$/.exec(route);
  if (fileRoute) {
    const id = decodeURIComponent(fileRoute[1]);
    if (!fileRoute[2] && method === 'DELETE') {
      await deleteUpload(env, id);
      return json({ ok: true });
    }
    if (fileRoute[2] && (method === 'PUT' || method === 'DELETE')) {
      const obj = await env.UPLOADS.head(fileKey(id));
      if (!obj) return json({ error: 'Not found' }, 404);
      if (method === 'PUT') await env.UPLOADS.put(keepKey(id), '');
      else await env.UPLOADS.delete(keepKey(id));
      return json({ keep: method === 'PUT', expires: method === 'PUT' ? null : expiryOf(obj.uploaded) });
    }
  }
  if (route === 'settings' && method === 'GET') return json(await getSettings(env));
  if (route === 'settings' && method === 'PUT') {
    const settings = normalizeSettings(await request.json().catch(() => ({})));
    await env.UPLOADS.put(SETTINGS_KEY, JSON.stringify(settings), { httpMetadata: { contentType: 'application/json' } });
    return json(settings);
  }
  return json({ error: 'Not found' }, 404);
}

function authorized(request, env) {
  if (!env.UPLOAD_KEY) return false;
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(env.UPLOAD_KEY);
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

// Accepts multipart (ShareX: FileFormName "file") or a raw body with ?name=<filename>.
async function upload(request, env, url) {
  let body, name, type, size;
  const ctype = request.headers.get('content-type') || '';
  if (ctype.startsWith('multipart/form-data')) {
    const file = (await request.formData()).get('file');
    if (!file || typeof file === 'string') return json({ error: 'Missing "file" field' }, 400);
    body = file; name = file.name; type = file.type; size = file.size;
  } else {
    size = Number(request.headers.get('content-length'));
    body = request.body; name = url.searchParams.get('name'); type = ctype;
  }
  if (!size) return json({ error: 'Empty upload' }, 400);
  if (size > MAX_UPLOAD) return json({ error: 'File too large (95 MB max)' }, 413);

  name = (name || 'upload').slice(0, 200);
  const ext = extensionOf(name) || extensionForType(type) || 'bin';
  if (!type || type === 'application/octet-stream') type = MIME[ext] || 'application/octet-stream';

  const settings = await getSettings(env);
  const id = await freshId(env, settings.url);
  const token = randomHex(16);
  await env.UPLOADS.put(fileKey(id), body, {
    httpMetadata: { contentType: type },
    customMetadata: { name, ext, del: token },
  });
  const keep = url.searchParams.get('keep') === '1';
  if (keep) await env.UPLOADS.put(keepKey(id), '');

  const links = linksFor(url.origin, id, ext);
  return json({
    ...links,
    id, name, size, type, keep,
    expires: keep ? null : expiryOf(new Date()),
    thumbnail: /^(image|video)\//.test(type) ? links.raw : '',
    delete: `${url.origin}/api/delete?id=${encodeURIComponent(id)}&token=${token}`,
  });
}

async function listFiles(env, url) {
  const [objects, kept] = await Promise.all([
    listAll(env, 'f/', ['httpMetadata', 'customMetadata']),
    keptIds(env),
  ]);
  const files = objects.map((o) => {
    const id = o.key.slice(2);
    const keep = kept.has(id);
    return {
      ...linksFor(url.origin, id, o.customMetadata?.ext || 'bin'),
      id,
      name: fileName(o, id),
      size: o.size,
      type: o.httpMetadata?.contentType || '',
      uploaded: o.uploaded.toISOString(),
      keep,
      expires: keep ? null : expiryOf(o.uploaded),
    };
  });
  files.sort((a, b) => b.uploaded.localeCompare(a.uploaded));
  return json({ files, retentionDays: RETENTION_DAYS });
}

async function listAll(env, prefix, include) {
  const objects = [];
  let cursor;
  do {
    const page = await env.UPLOADS.list({ prefix, cursor, include });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

async function keptIds(env) {
  return new Set((await listAll(env, 'keep/')).map((o) => o.key.slice('keep/'.length)));
}

async function deleteUpload(env, id) {
  await env.UPLOADS.delete([fileKey(id), keepKey(id)]);
}

async function oembed(env, url) {
  const { embed } = await getSettings(env);
  const id = url.searchParams.get('id') || '';
  const obj = id ? await env.UPLOADS.head(fileKey(id)) : null;
  const fill = (s) => (obj ? fillTemplate(s, obj, id) : s);
  const out = { type: 'link', version: '1.0' };
  if (embed.siteName) out.provider_name = fill(embed.siteName);
  if (embed.siteUrl) out.provider_url = embed.siteUrl;
  if (embed.authorName) out.author_name = fill(embed.authorName);
  if (embed.authorUrl) out.author_url = embed.authorUrl;
  return json(out);
}

// GET shows a confirm button (link unfurlers must not delete files); POST deletes.
async function deletionLink(request, env, url) {
  const id = url.searchParams.get('id') || '';
  const token = url.searchParams.get('token') || '';
  const obj = id && token ? await env.UPLOADS.head(fileKey(id)) : null;
  if (!obj || obj.customMetadata?.del !== token) {
    return html(shell('Not found', '', '<h1>Link expired</h1><p class="muted">This file doesn’t exist or was already deleted.</p>', 'not found'), 404);
  }
  const name = esc(fileName(obj, id));
  if (request.method === 'POST') {
    await deleteUpload(env, id);
    return html(shell('Deleted', '', `<h1>Deleted</h1><p class="muted">${name} is gone.</p>`, 'delete'));
  }
  return html(shell('Delete file', '', `<h1>Delete ${name}?</h1>
    <p class="muted">${formatBytes(obj.size)} · uploaded ${formatDate(obj.uploaded)}. This can’t be undone.</p>
    <form method="post"><button class="link-btn primary" type="submit">Delete file</button></form>`, 'delete'));
}

/* ---------- settings ---------- */

async function getSettings(env) {
  const obj = await env.UPLOADS.get(SETTINGS_KEY);
  const saved = obj ? await obj.json() : {};
  return {
    embed: { ...DEFAULT_SETTINGS.embed, ...saved.embed },
    url: { ...DEFAULT_SETTINGS.url, ...saved.url },
  };
}

// Missing fields fall back to defaults; fields sent empty stay empty (e.g. no title).
function normalizeSettings(input) {
  const e = { ...DEFAULT_SETTINGS.embed, ...input.embed };
  const u = { ...DEFAULT_SETTINGS.url, ...input.url };
  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  const link = (v) => (/^https?:\/\//i.test(str(v, 500)) ? str(v, 500) : '');
  const style = u.style in ID_LENGTHS ? u.style : 'random';
  const [min, max] = ID_LENGTHS[style];
  return {
    embed: {
      enabled: e.enabled !== false,
      title: str(e.title, 256),
      description: str(e.description, 1000),
      color: /^#[0-9a-f]{6}$/i.test(e.color) ? e.color : DEFAULT_SETTINGS.embed.color,
      siteName: str(e.siteName, 256),
      siteUrl: link(e.siteUrl),
      authorName: str(e.authorName, 256),
      authorUrl: link(e.authorUrl),
    },
    url: { style, length: Math.min(max, Math.max(min, Math.round(Number(u.length)) || 8)) },
  };
}

/* ---------- pages ---------- */

function viewerPage(obj, id, settings, origin, text) {
  const { embed } = settings;
  const type = obj.httpMetadata?.contentType || '';
  const name = fileName(obj, id);
  const { url, raw } = linksFor(origin, encodeURIComponent(id), obj.customMetadata?.ext || 'bin');
  const title = fillTemplate(embed.title, obj, id);
  const description = fillTemplate(embed.description, obj, id);

  const meta = [
    `<meta name="theme-color" content="${esc(embed.color)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    title && `<meta property="og:title" content="${esc(title)}">`,
    description && `<meta property="og:description" content="${esc(description)}">`,
    `<link type="application/json+oembed" href="${esc(`${origin}/api/oembed?id=${encodeURIComponent(id)}`)}">`,
  ];
  let media = '';
  if (type.startsWith('image/')) {
    meta.push(
      `<meta property="og:image" content="${esc(raw)}">`,
      `<meta name="twitter:image" content="${esc(raw)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
    );
    media = `<img src="${esc(raw)}" alt="${esc(name)}">`;
  } else if (type.startsWith('video/')) {
    meta.push(
      '<meta property="og:type" content="video.other">',
      `<meta property="og:video" content="${esc(raw)}">`,
      `<meta property="og:video:secure_url" content="${esc(raw)}">`,
      `<meta property="og:video:type" content="${esc(type)}">`,
      '<meta property="og:video:width" content="1280">',
      '<meta property="og:video:height" content="720">',
      '<meta name="twitter:card" content="player">',
    );
    media = `<video src="${esc(raw)}" controls playsinline preload="metadata"></video>`;
  } else if (type.startsWith('audio/')) {
    media = `<audio src="${esc(raw)}" controls preload="metadata"></audio>`;
  } else if (text !== null) {
    media = `<pre>${esc(text)}</pre>`;
  }

  const body = `
    <figure class="upload">${media}</figure>
    <div class="upload-info">
      <div>
        <h1>${esc(name)}</h1>
        <p class="muted mono">${formatBytes(obj.size)} · ${esc(type || 'file')} · ${formatDate(obj.uploaded)}</p>
      </div>
      <div class="upload-actions">
        <a class="link-btn" href="${esc(raw)}">Raw</a>
        <a class="link-btn primary" href="${esc(raw)}" download="${esc(name)}">Download</a>
      </div>
    </div>`;
  return shell(title || name, meta.filter(Boolean).join('\n  '), body);
}

function shell(title, head, body, label = 'file') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <meta name="color-scheme" content="dark light">
  <title>${esc(title)}</title>
  ${head}
  <script>
    (function () {
      var stored = null;
      try { stored = localStorage.getItem('theme'); } catch (e) {}
      if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
    })();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/system24.css">
  <link rel="stylesheet" href="/dashboard/uploads.css">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%231b1b1b'/%3E%3Ctext x='50' y='66' font-size='44' text-anchor='middle' font-family='monospace' fill='%2378c4d8'%3ESB%3C/text%3E%3C/svg%3E">
</head>
<body>
  <div class="page">
    <header class="topbar panel">
      <span class="label" aria-hidden="true">sambawa.dev</span>
      <a class="prompt" href="/"><span class="dim">~/</span>sam</a>
    </header>
    <main class="panel file-panel">
      <span class="label" aria-hidden="true">${esc(label)}</span>
      ${body}
    </main>
  </div>
</body>
</html>`;
}

/* ---------- helpers ---------- */

function fileKey(id) { return `f/${id}`; }
function keepKey(id) { return `keep/${id}`; }

function expiryOf(uploaded) {
  return new Date(new Date(uploaded).getTime() + RETENTION_DAYS * DAY_MS).toISOString();
}

function linksFor(origin, id, ext) {
  return { url: `${origin}/${id}`, raw: `${origin}/${id}.${ext}` };
}

function fileName(obj, id) { return obj.customMetadata?.name || id; }

function isText(obj) {
  const t = obj.httpMetadata?.contentType || '';
  return t.startsWith('text/') || t.startsWith('application/json');
}

function fillTemplate(template, obj, id) {
  const vars = {
    filename: fileName(obj, id),
    id,
    size: formatBytes(obj.size),
    date: formatDate(obj.uploaded),
    type: obj.httpMetadata?.contentType || '',
  };
  return String(template || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

async function freshId(env, { style, length }) {
  const alphabet = ID_ALPHABETS[style] || ID_ALPHABETS.random;
  for (let attempt = 0; attempt < 5; attempt++) {
    const picks = crypto.getRandomValues(new Uint32Array(length));
    const id = Array.from(picks, (n) => alphabet[n % alphabet.length]).join('');
    if (!(await env.UPLOADS.head(fileKey(id)))) return id;
  }
  throw new Error('Could not allocate a free id');
}

function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function extensionOf(name) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

function extensionForType(type) {
  const base = type.split(';')[0].trim();
  return Object.keys(MIME).find((ext) => MIME[ext].split(';')[0] === base) || '';
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function html(markup, status = 200) {
  return new Response(markup, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      'x-robots-tag': 'noindex',
    },
  });
}
