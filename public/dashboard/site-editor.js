/* Dashboard site tab: edit the homepage blocks in config/site.json and flip between the homepage
   and the still building page. Forms are built from the schema in /js/site.js, and the preview is
   the same renderHome() the worker uses, so what you see here is what visitors get. */

import {
  BLOCK_TYPES, COMMON_FIELDS, PAGE_FIELDS, DEFAULT_SITE, MAX_BLOCKS,
  normalizeSite, newBlock, renderHome, safeHref,
} from '/js/site.js';

const $ = (id) => document.getElementById(id);
const clone = (x) => JSON.parse(JSON.stringify(x));

let api = null;
let toast = null;
let saved = null;   // last saved site, normalized
let draft = null;   // working copy; blocks carry a private _k key for the UI (dropped on save)
let nextKey = 1;
const openKeys = new Set();
let selectedKey = null;
let previewSize = 'desktop';

/* ---------- load / save ---------- */

function start(detail) {
  if (api) return;
  api = detail.api;
  toast = detail.toast;
  api('site').then((site) => {
    saved = site;
    setDraft(clone(site));
    renderMode();
  }).catch((err) => { $('site-status').textContent = 'Couldn’t load the site: ' + err.message; });
}

if (window.dashboard) start(window.dashboard);
document.addEventListener('dashboard:unlocked', (e) => start(e.detail));

function setDraft(site, keys) {
  draft = site;
  draft.blocks.forEach((b, i) => { b._k = keys && keys[i] ? keys[i] : nextKey++; });
  renderPageFields();
  renderBlocks();
  changed();
}

function snapshot(site) {
  const n = normalizeSite(site);
  return JSON.stringify({ page: n.page, blocks: n.blocks });
}

function isDirty() {
  return saved && draft && snapshot(draft) !== snapshot(saved);
}

function changed() {
  const dirty = isDirty();
  $('site-save').disabled = !dirty;
  $('site-discard').disabled = !dirty;
  $('site-status').textContent = dirty ? 'Unsaved changes' : '';
  schedulePreview();
}

$('site-save').addEventListener('click', () => {
  const keys = draft.blocks.map((b) => b._k);
  const body = normalizeSite(draft);
  $('site-save').disabled = true;
  $('site-status').textContent = 'Saving…';
  api('site', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: body.page, blocks: body.blocks }),
  }).then((site) => {
    saved = site;
    setDraft(clone(site), keys);
    toast(saved.mode === 'home' ? 'Saved. Live on sambawa.dev within a minute.' : 'Saved. Switch to Homepage to show it.');
  }).catch((err) => {
    $('site-save').disabled = false;
    $('site-status').textContent = 'Couldn’t save: ' + err.message;
  });
});

$('site-discard').addEventListener('click', () => {
  if (!confirm('Throw away your unsaved changes?')) return;
  setDraft(clone(saved));
});

$('site-reset').addEventListener('click', () => {
  if (!confirm('Replace the draft with the original portfolio content? Nothing changes live until you save.')) return;
  setDraft({ ...clone(DEFAULT_SITE), mode: saved.mode });
});

window.addEventListener('beforeunload', (e) => {
  if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------- mode toggle ---------- */

const MODE_NOTES = {
  home: 'Visitors see the homepage. Saving updates it right away (some visitors can see the old version for up to a minute).',
  building: 'Visitors see the still building page. Edit and save the homepage freely; nobody sees it until you switch to Homepage.',
};

function renderMode() {
  document.querySelectorAll('[data-mode]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.mode === saved.mode));
  });
  $('mode-note').textContent = MODE_NOTES[saved.mode];
}

document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (!saved || mode === saved.mode) return;
    const ask = mode === 'home'
      ? 'Show the homepage on sambawa.dev? It shows the last saved version' + (isDirty() ? ' (your unsaved changes are not included).' : '.')
      : 'Put the still building page back up on sambawa.dev?';
    if (!confirm(ask)) return;
    api('site/mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    }).then((site) => {
      saved.mode = site.mode;
      draft.mode = site.mode;
      renderMode();
      toast(mode === 'home' ? 'Homepage is live' : 'Still building page is live');
    }).catch((err) => toast('Couldn’t switch: ' + err.message));
  });
});

/* ---------- field widgets (built from the schema) ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function smallBtn(text, label, onClick, extra) {
  const b = el('button', 'link-btn small icon' + (extra ? ' ' + extra : ''), text);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', onClick);
  return b;
}

let fieldId = 0;

// Builds the input for one schema field, bound to obj[desc.key]. `rerender` is for list edits.
function field(obj, desc, rerender) {
  const id = 'f' + (++fieldId);
  if (desc.kind === 'list') return listField(obj, desc, rerender);

  if (desc.kind === 'check') {
    const wrap = el('label', 'check');
    const input = el('input');
    input.type = 'checkbox';
    input.checked = !!obj[desc.key];
    input.addEventListener('change', () => { obj[desc.key] = input.checked; onFieldChange(desc); });
    wrap.append(input, el('span', '', desc.label));
    return wrap;
  }

  const wrap = el('label');
  wrap.htmlFor = id;
  wrap.appendChild(el('span', '', desc.label));
  let input;
  if (desc.kind === 'select') {
    input = el('select');
    desc.options.forEach(([value, text]) => {
      const o = el('option', '', text);
      o.value = value;
      input.appendChild(o);
    });
    input.value = obj[desc.key] || desc.options[0][0];
  } else if (['textarea', 'rich', 'code', 'lines'].includes(desc.kind)) {
    input = el('textarea', desc.kind === 'code' ? 'code' : '');
    input.rows = desc.kind === 'code' ? 7 : desc.kind === 'lines' ? 4 : 3;
    if (desc.kind === 'code') input.wrap = 'off';
  } else {
    input = el('input');
    input.type = desc.kind === 'date' ? 'date' : desc.kind === 'email' ? 'email' : 'text';
  }
  input.id = id;
  if (desc.max) input.maxLength = desc.kind === 'lines' || desc.kind === 'csv' ? desc.max * 40 : desc.max;

  const value = obj[desc.key];
  if (desc.kind === 'lines') input.value = (value || []).join('\n');
  else if (desc.kind === 'csv') input.value = (value || []).join(', ');
  else if (desc.kind !== 'select') input.value = value || '';

  const warn = el('small', 'field-warn');
  const check = () => {
    warn.textContent = desc.kind === 'link' && input.value.trim() && !safeHref(input.value)
      ? 'Not used: links must start with https://, mailto:, / or #' : '';
  };
  input.addEventListener(desc.kind === 'select' ? 'change' : 'input', () => {
    if (desc.kind === 'lines') obj[desc.key] = input.value.split('\n').map((s) => s.trim()).filter(Boolean);
    else if (desc.kind === 'csv') obj[desc.key] = input.value.split(',').map((s) => s.trim()).filter(Boolean);
    else obj[desc.key] = input.value;
    check();
    onFieldChange(desc);
  });
  check();
  wrap.appendChild(input);
  if (desc.hint) wrap.appendChild(el('small', 'muted', desc.hint));
  wrap.appendChild(warn);
  return wrap;
}

// Repeating items (buttons, cards, rows, tag groups): each in its own box with move/remove.
function listField(obj, desc, rerender) {
  const items = obj[desc.key] = obj[desc.key] || [];
  const box = el('fieldset', 'list-field');
  box.appendChild(el('legend', '', desc.label));
  items.forEach((item, i) => {
    const row = el('div', 'list-item');
    const head = el('div', 'list-item-head');
    const name = item.title || item.label || item.heading || '';
    head.appendChild(el('span', 'muted', desc.item + ' ' + (i + 1) + (name ? ': ' + name : '')));
    const actions = el('div', 'mini-actions');
    actions.append(
      smallBtn('↑', 'Move ' + desc.item + ' up', () => { move(items, i, i - 1); rerender(); }),
      smallBtn('↓', 'Move ' + desc.item + ' down', () => { move(items, i, i + 1); rerender(); }),
      smallBtn('✕', 'Remove ' + desc.item, () => { items.splice(i, 1); rerender(); }, 'danger'),
    );
    head.appendChild(actions);
    row.appendChild(head);
    const fields = el('div', 'stack-form');
    desc.fields.forEach((f) => fields.appendChild(field(item, f, rerender)));
    row.appendChild(fields);
    box.appendChild(row);
  });
  const add = el('button', 'link-btn small', '+ Add ' + desc.item);
  add.type = 'button';
  add.addEventListener('click', () => { items.push(clone(desc.sample || {})); rerender(); });
  box.appendChild(add);
  return box;
}

function onFieldChange(desc) {
  // Labels show in the block headers, so refresh those without rebuilding the open forms.
  if (desc && (desc.key === 'label' || desc.key === 'hidden' || desc.key === 'width')) refreshHeads();
  changed();
}

function move(list, from, to) {
  if (to < 0 || to >= list.length) return;
  list.splice(to, 0, list.splice(from, 1)[0]);
}

/* ---------- page settings ---------- */

function renderPageFields() {
  const box = $('page-fields');
  box.textContent = '';
  PAGE_FIELDS.forEach((f) => box.appendChild(field(draft.page, f, renderPageFields)));
}

/* ---------- blocks ---------- */

const WIDTH_NAMES = { full: 'full', wide: '2/3', narrow: '1/3' };

function headText(b) {
  return BLOCK_TYPES[b.type].name + (b.label ? ' · ' + b.label : '');
}

function refreshHeads() {
  document.querySelectorAll('#blocks > li').forEach((li, i) => {
    const b = draft.blocks[i];
    li.querySelector('.block-name').textContent = headText(b);
    li.querySelector('.block-tags').textContent = WIDTH_NAMES[b.width] + (b.hidden ? ' · hidden' : '');
    li.classList.toggle('is-hidden', !!b.hidden);
    li.querySelector('[data-act="hide"]').textContent = b.hidden ? 'Show' : 'Hide';
  });
}

function renderBlocks() {
  const list = $('blocks');
  list.textContent = '';
  draft.blocks.forEach((b, i) => list.appendChild(blockCard(b, i)));
  if (!draft.blocks.length) list.appendChild(el('li', 'muted empty', 'No blocks yet. Add one below.'));
}

function blockCard(b, i) {
  const li = el('li', 'block-card' + (b.hidden ? ' is-hidden' : '') + (b._k === selectedKey ? ' selected' : ''));
  li.dataset.k = b._k;
  const open = openKeys.has(b._k);

  const head = el('div', 'block-head');
  const grip = el('span', 'grip', '⠿');
  grip.title = 'Drag to move';
  grip.setAttribute('aria-hidden', 'true');
  grip.addEventListener('pointerdown', () => { li.draggable = true; });
  grip.addEventListener('pointerup', () => { li.draggable = false; });

  const toggle = el('button', 'block-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.append(el('span', 'caret', open ? '▾' : '▸'), el('span', 'block-name', headText(b)),
    el('span', 'block-tags muted', WIDTH_NAMES[b.width] + (b.hidden ? ' · hidden' : '')));
  toggle.addEventListener('click', () => {
    if (openKeys.has(b._k)) openKeys.delete(b._k); else openKeys.add(b._k);
    select(b._k);
    renderBlocks();
  });

  const actions = el('div', 'mini-actions');
  const hide = smallBtn(b.hidden ? 'Show' : 'Hide', 'Hide or show this block', () => {
    b.hidden = !b.hidden;
    renderBlocks();
    changed();
  });
  hide.dataset.act = 'hide';
  hide.classList.remove('icon');
  actions.append(
    smallBtn('↑', 'Move block up', () => moveBlock(i, i - 1)),
    smallBtn('↓', 'Move block down', () => moveBlock(i, i + 1)),
    smallBtn('⧉', 'Duplicate block', () => {
      if (draft.blocks.length >= MAX_BLOCKS) return toast('Up to ' + MAX_BLOCKS + ' blocks');
      const copy = clone(b);
      copy.id = '';
      copy._k = nextKey++;
      draft.blocks.splice(i + 1, 0, copy);
      openKeys.add(copy._k);
      renderBlocks();
      changed();
    }),
    hide,
    smallBtn('✕', 'Delete block', () => {
      if (!confirm('Delete the "' + headText(b) + '" block? (Discard changes brings it back until you save.)')) return;
      draft.blocks.splice(i, 1);
      renderBlocks();
      changed();
    }, 'danger'),
  );
  head.append(grip, toggle, actions);
  li.appendChild(head);

  if (open) {
    const body = el('div', 'block-body stack-form');
    const rerender = () => { renderBlocks(); changed(); };
    const common = el('div', 'common-fields');
    COMMON_FIELDS.forEach((f) => common.appendChild(field(b, f, rerender)));
    body.appendChild(common);
    BLOCK_TYPES[b.type].fields.forEach((f) => body.appendChild(field(b, f, rerender)));
    li.appendChild(body);
  }

  // Drag to reorder (only from the grip, so text in the forms stays selectable).
  li.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
    li.classList.add('dragging');
  });
  li.addEventListener('dragend', () => {
    li.draggable = false;
    li.classList.remove('dragging');
    document.querySelectorAll('.drop-before, .drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
  });
  li.addEventListener('dragover', (e) => {
    if (!document.querySelector('.block-card.dragging')) return;
    e.preventDefault();
    const after = e.clientY > li.getBoundingClientRect().top + li.offsetHeight / 2;
    li.classList.toggle('drop-after', after);
    li.classList.toggle('drop-before', !after);
  });
  li.addEventListener('dragleave', () => li.classList.remove('drop-before', 'drop-after'));
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    let to = i + (li.classList.contains('drop-after') ? 1 : 0);
    if (from < to) to--;
    moveBlock(from, to);
  });
  return li;
}

function moveBlock(from, to) {
  if (to < 0 || to >= draft.blocks.length || from === to) return;
  move(draft.blocks, from, to);
  renderBlocks();
  changed();
}

function select(k) {
  selectedKey = k;
  highlightPreview();
}

// Add-block picker
const picker = $('add-type');
Object.keys(BLOCK_TYPES).forEach((type) => {
  const o = el('option', '', BLOCK_TYPES[type].name);
  o.value = type;
  picker.appendChild(o);
});
const showDesc = () => { $('add-desc').textContent = BLOCK_TYPES[picker.value].desc; };
picker.addEventListener('change', showDesc);
showDesc();

$('add-block').addEventListener('click', () => {
  if (!draft) return;
  if (draft.blocks.length >= MAX_BLOCKS) return toast('Up to ' + MAX_BLOCKS + ' blocks');
  const b = newBlock(picker.value);
  b._k = nextKey++;
  draft.blocks.push(b);
  openKeys.add(b._k);
  select(b._k);
  renderBlocks();
  changed();
  const card = document.querySelector('#blocks > li[data-k="' + b._k + '"]');
  if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

/* ---------- preview ---------- */

const frame = $('preview');
const box = $('preview-box');
let previewTimer = null;
let previewSite = null;

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 250);
}

function renderPreview() {
  if (!draft) return;
  let y = 0;
  try { y = frame.contentWindow.scrollY; } catch (e) {}
  previewSite = normalizeSite(draft);
  frame.onload = () => {
    try {
      frame.contentWindow.scrollTo(0, y);
      wirePreview(frame.contentDocument);
    } catch (e) {}
  };
  frame.srcdoc = renderHome(previewSite, { origin: location.origin });
}

// Same-origin srcdoc: clicking a box (not a link) opens that block in the editor.
function wirePreview(doc) {
  const style = doc.createElement('style');
  style.textContent = '[data-block]{cursor:pointer}[data-block].editing{outline:2px dashed var(--accent-2);outline-offset:4px}';
  doc.head.appendChild(style);
  doc.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const section = e.target.closest('[data-block]');
    if (!section) return;
    const idx = previewSite.blocks.findIndex((b) => b.id === section.dataset.block);
    const b = draft.blocks[idx];
    if (!b) return;
    openKeys.add(b._k);
    select(b._k);
    renderBlocks();
    const card = document.querySelector('#blocks > li[data-k="' + b._k + '"]');
    if (card) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  highlightPreview();
}

function highlightPreview() {
  let doc;
  try { doc = frame.contentDocument; } catch (e) { return; }
  if (!doc || !previewSite) return;
  doc.querySelectorAll('[data-block].editing').forEach((n) => n.classList.remove('editing'));
  const idx = draft.blocks.findIndex((b) => b._k === selectedKey);
  const id = idx >= 0 && previewSite.blocks[idx] ? previewSite.blocks[idx].id : null;
  const section = id && doc.querySelector('[data-block="' + id + '"]');
  if (section) {
    section.classList.add('editing');
    section.scrollIntoView({ block: 'nearest' });
  }
  document.querySelectorAll('#blocks > li').forEach((li) => li.classList.toggle('selected', Number(li.dataset.k) === selectedKey));
}

// Desktop renders at 1280px and scales down to fit; phone renders at 390px.
function fitPreview() {
  const width = previewSize === 'desktop' ? 1280 : 390;
  const scale = Math.min(1, box.clientWidth / width);
  frame.style.width = width + 'px';
  frame.style.height = (box.clientHeight / scale) + 'px';
  frame.style.transform = 'scale(' + scale + ')';
  frame.style.left = previewSize === 'phone' ? Math.max(0, (box.clientWidth - width * scale) / 2) + 'px' : '0';
}
new ResizeObserver(fitPreview).observe(box);

document.querySelectorAll('[data-size]').forEach((btn) => {
  btn.addEventListener('click', () => {
    previewSize = btn.dataset.size;
    document.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    fitPreview();
  });
});
