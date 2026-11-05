/* sambawa.dev uploads dashboard: files, embed settings, ShareX config.
   Talks to the worker's /api/*; the upload key lives in this browser's localStorage. */

(function () {
  'use strict';

  var KEY_STORE = 'uploadKey';
  var SEP = ' · ';
  var SAMPLE = { filename: 'screenshot.png', size: '412 KB', type: 'image/png' };
  var SAMPLE_IDS = { random: 'k3Fq9xPa', emoji: '🐸🚀🍕🔮', invisible: '' };

  var $ = function (id) { return document.getElementById(id); };
  var key = null;
  var settings = null;
  var files = [];
  var retentionDays = 180;

  /* ---------- api ---------- */

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: key }, opts.headers);
    return fetch('/api/' + path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status });
        return data;
      });
    });
  }

  // XHR (not fetch) for upload progress. Raw body + ?name= so the worker can stream it into R2.
  function uploadFile(file, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload?name=' + encodeURIComponent(file.name || 'paste.png'));
      xhr.setRequestHeader('Authorization', key);
      if (file.type) xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      xhr.onload = function () {
        var data = {};
        try { data = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Upload failed (' + xhr.status + ')'));
      };
      xhr.onerror = function () { reject(new Error('Network error')); };
      xhr.send(file);
    });
  }

  /* ---------- lock / unlock ---------- */

  function unlock(candidate) {
    key = candidate;
    return api('settings').then(function (s) {
      try { localStorage.setItem(KEY_STORE, key); } catch (e) {}
      settings = s;
      $('unlock').hidden = true;
      document.querySelector('.dash-tabs').hidden = false;
      $('lock').hidden = false;
      fillSettingsForm();
      showTab();
      return loadFiles();
    }).catch(function (err) {
      key = null;
      try { localStorage.removeItem(KEY_STORE); } catch (e) {}
      throw err;
    });
  }

  $('unlock-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('unlock-error').textContent = '';
    unlock($('key').value.trim()).catch(function (err) {
      $('unlock-error').textContent = err.status === 401 ? 'That key isn’t right.' : err.message;
    });
  });

  $('lock').addEventListener('click', function () {
    try { localStorage.removeItem(KEY_STORE); } catch (e) {}
    location.hash = '';
    location.reload();
  });

  /* ---------- tabs ---------- */

  var PANELS = ['files', 'embed', 'sharex'];
  function showTab() {
    if (!key) return;
    var tab = location.hash.slice(1);
    if (PANELS.indexOf(tab) === -1) tab = 'files';
    PANELS.forEach(function (p) { $(p).hidden = p !== tab; });
    document.querySelectorAll('.dash-tabs a').forEach(function (a) {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', showTab);

  /* ---------- files ---------- */

  function loadFiles() {
    return api('files').then(function (data) {
      files = data.files;
      retentionDays = data.retentionDays;
      $('retention').textContent = 'Files auto-delete after ' + retentionDays + ' days unless you press Keep.';
      renderFiles();
    });
  }

  function renderFiles(freshId) {
    var total = files.reduce(function (n, f) { return n + f.size; }, 0);
    $('stats').textContent = files.length + (files.length === 1 ? ' file' : ' files') + SEP + formatBytes(total);
    $('empty').hidden = files.length > 0;
    var grid = $('grid');
    grid.textContent = '';
    files.forEach(function (f) { grid.appendChild(fileCard(f, f.id === freshId)); });
  }

  function fileCard(f, fresh) {
    var li = el('li', 'file-card' + (fresh ? ' fresh' : ''));
    var thumb = el('a', 'thumb');
    thumb.href = f.url;
    thumb.target = '_blank';
    thumb.rel = 'noopener';
    if (/^image\//.test(f.type)) {
      var img = el('img');
      img.src = f.raw;
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
    } else if (/^video\//.test(f.type)) {
      var vid = el('video');
      vid.src = f.raw + '#t=0.1';
      vid.preload = 'metadata';
      vid.muted = true;
      thumb.appendChild(vid);
    } else {
      thumb.appendChild(el('span', 'ext', f.raw.split('.').pop()));
    }
    li.appendChild(thumb);

    var body = el('div', 'file-body');
    var name = el('p', 'file-name', f.name);
    name.title = f.name;
    body.appendChild(name);
    body.appendChild(el('p', 'file-meta muted mono', formatBytes(f.size) + SEP + formatDate(f.uploaded)));
    body.appendChild(el('p', 'file-meta mono' + (f.keep ? ' kept' : ' muted'),
      f.keep ? 'Kept forever' : 'Auto-deletes ' + formatDate(f.expires)));

    var actions = el('div', 'file-actions');
    var keep = el('button', 'link-btn small', f.keep ? 'Unkeep' : 'Keep');
    keep.type = 'button';
    keep.setAttribute('aria-pressed', String(f.keep));
    keep.title = f.keep ? 'Allow auto-delete after ' + retentionDays + ' days' : 'Never auto-delete this file';
    keep.addEventListener('click', function () { toggleKeep(f, keep); });
    var copy = el('button', 'link-btn small', 'Copy link');
    copy.type = 'button';
    copy.addEventListener('click', function () { copyLink(f.url); });
    var raw = el('button', 'link-btn small', 'Copy raw');
    raw.type = 'button';
    raw.addEventListener('click', function () { copyLink(f.raw); });
    var del = el('button', 'link-btn small danger', 'Delete');
    del.type = 'button';
    del.addEventListener('click', function () { deleteFile(f, del); });
    actions.append(copy, raw, keep, del);
    body.appendChild(actions);
    li.appendChild(body);
    return li;
  }

  function toggleKeep(f, btn) {
    btn.disabled = true;
    api('files/' + encodeURIComponent(f.id) + '/keep', { method: f.keep ? 'DELETE' : 'PUT' }).then(function (res) {
      f.keep = res.keep;
      f.expires = res.expires;
      renderFiles();
      toast(f.keep ? 'Kept forever' : 'Auto-deletes ' + formatDate(f.expires));
    }).catch(function (err) {
      btn.disabled = false;
      toast(err.message);
    });
  }

  function deleteFile(f, btn) {
    if (!confirm('Delete ' + f.name + '? The link stops working immediately.')) return;
    btn.disabled = true;
    api('files/' + encodeURIComponent(f.id), { method: 'DELETE' }).then(function () {
      files = files.filter(function (x) { return x.id !== f.id; });
      renderFiles();
      toast('Deleted');
    }).catch(function (err) {
      btn.disabled = false;
      toast(err.message);
    });
  }

  function handleFiles(list) {
    Array.prototype.forEach.call(list, function (file) {
      var row = el('li', '', file.name + ': 0%');
      $('queue').appendChild(row);
      uploadFile(file, function (p) {
        row.textContent = file.name + ': ' + Math.round(p * 100) + '%';
      }).then(function (res) {
        row.remove();
        files.unshift({
          id: res.id, name: res.name, size: res.size, type: res.type, url: res.url, raw: res.raw,
          uploaded: new Date().toISOString(), keep: res.keep, expires: res.expires
        });
        renderFiles(res.id);
        copyLink(res.url, 'Uploaded, link copied');
      }).catch(function (err) {
        row.className = 'error';
        row.textContent = file.name + ': ' + err.message;
      });
    });
  }

  var drop = $('dropzone');
  $('picker').addEventListener('change', function (e) { handleFiles(e.target.files); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach(function (t) {
    drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    drop.addEventListener(t, function () { drop.classList.remove('over'); });
  });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  });
  document.addEventListener('paste', function (e) {
    if (!key || $('files').hidden || !e.clipboardData.files.length) return;
    e.preventDefault();
    handleFiles(e.clipboardData.files);
  });

  /* ---------- embed settings ---------- */

  var form = $('settings-form');
  var field = function (name) { return form.elements.namedItem(name); };

  var EMBED_TEXT = ['siteName', 'siteUrl', 'authorName', 'authorUrl', 'title', 'description', 'color'];

  function fillSettingsForm() {
    var e = settings.embed;
    field('enabled').checked = e.enabled;
    EMBED_TEXT.forEach(function (k) { field(k).value = e[k]; });
    field('urlStyle').value = settings.url.style;
    field('idLength').value = settings.url.length;
    renderPreview();
  }

  function readSettingsForm() {
    var embed = { enabled: field('enabled').checked };
    EMBED_TEXT.forEach(function (k) { embed[k] = field(k).value; });
    return { embed: embed, url: { style: field('urlStyle').value, length: Number(field('idLength').value) } };
  }

  function fillTemplate(t) {
    var vars = Object.assign({ date: formatDate(new Date()), id: SAMPLE_IDS[field('urlStyle').value] }, SAMPLE);
    return t.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; });
  }

  function renderPreview() {
    var s = readSettingsForm();
    $('color-hex').textContent = s.embed.color;
    $('pv-link').textContent = location.origin + '/' + SAMPLE_IDS[s.url.style];
    $('pv-embed').hidden = !s.embed.enabled;
    $('pv-plain').hidden = s.embed.enabled;
    $('pv-embed').style.setProperty('--embed-color', s.embed.color);
    $('pv-site').textContent = fillTemplate(s.embed.siteName);
    $('pv-author').textContent = fillTemplate(s.embed.authorName);
    $('pv-title').textContent = fillTemplate(s.embed.title);
    $('pv-desc').textContent = fillTemplate(s.embed.description);
  }

  form.addEventListener('input', function () {
    renderPreview();
    $('settings-status').textContent = '';
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    $('settings-status').textContent = 'Saving…';
    api('settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readSettingsForm())
    }).then(function (saved) {
      settings = saved;
      fillSettingsForm();
      $('settings-status').textContent = 'Saved. Discord caches embeds, so links already posted keep their old look.';
    }).catch(function (err) {
      $('settings-status').textContent = 'Couldn’t save: ' + err.message;
    });
  });

  /* ---------- sharex ---------- */

  $('sxcu').addEventListener('click', function () {
    var config = {
      Version: '16.1.0',
      Name: location.host,
      DestinationType: 'ImageUploader, TextUploader, FileUploader',
      RequestMethod: 'POST',
      RequestURL: location.origin + '/api/upload',
      Headers: { Authorization: key },
      Body: 'MultipartFormData',
      FileFormName: 'file',
      URL: '{json:url}',
      ThumbnailURL: '{json:thumbnail}',
      DeletionURL: '{json:delete}',
      ErrorMessage: '{json:error}'
    };
    var blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = location.host + '.sxcu';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  /* ---------- helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function copyLink(url, message) {
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(function () { toast(message || 'Link copied'); })
      .catch(function () { toast((message ? 'Uploaded. ' : '') + 'Couldn’t copy; use the Copy button'); });
  }

  var toastTimer;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    var units = ['KB', 'MB', 'GB'];
    var i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < units.length - 1);
    return n.toFixed(n < 10 ? 1 : 0) + ' ' + units[i];
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ---------- boot ---------- */

  var saved = null;
  try { saved = localStorage.getItem(KEY_STORE); } catch (e) {}
  if (saved) unlock(saved).catch(function () {});
})();
