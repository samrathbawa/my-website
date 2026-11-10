/* sambawa.dev homepage: block schema, validation and HTML renderer.
   Shared by the worker (renders `/` from config/site.json in R2), the dashboard's site editor
   (builds its forms from BLOCK_TYPES) and the editor's live preview. No DOM or Node APIs here. */

export const MODES = ['building', 'home'];
export const MAX_BLOCKS = 40;
const MAX_ITEMS = 40;

const BUTTONS = {
  key: 'buttons', label: 'Buttons', kind: 'list', item: 'button',
  fields: [
    { key: 'label', label: 'Text', kind: 'text', max: 80 },
    { key: 'href', label: 'Link', kind: 'link', hint: 'https://…, mailto:…, /resume or #section' },
    { key: 'primary', label: 'Filled (main button)', kind: 'check' },
  ],
  sample: { label: 'New button', href: 'https://', primary: false },
};

const RICH_HINT = '**bold**, [text](https://link). Blank line = new paragraph.';

export const PAGE_FIELDS = [
  { key: 'title', label: 'Browser tab title', kind: 'text', max: 120 },
  { key: 'description', label: 'Search / link preview description', kind: 'textarea', max: 300 },
  { key: 'prompt', label: 'Name in the top bar (~/name)', kind: 'text', max: 30 },
  { key: 'github', label: 'GitHub username (repo cards + activity)', kind: 'text', max: 39 },
];

export const COMMON_FIELDS = [
  { key: 'label', label: 'Label (on the box border + nav tab)', kind: 'text', max: 40 },
  { key: 'width', label: 'Width', kind: 'select', options: [['full', 'Full width'], ['wide', 'Two thirds'], ['narrow', 'One third']] },
  { key: 'nav', label: 'Show in top nav', kind: 'check' },
  { key: 'hidden', label: 'Hidden (kept, not shown)', kind: 'check' },
];

// Each type: name + description for the picker, its own fields, and a sample for "Add block".
export const BLOCK_TYPES = {
  intro: {
    name: 'Intro', desc: 'Big banner, intro text and buttons',
    fields: [
      { key: 'banner', label: 'ASCII banner (optional)', kind: 'code', max: 4000 },
      { key: 'heading', label: 'Heading (screen-reader only when there is a banner)', kind: 'text', max: 120 },
      { key: 'text', label: 'Text', kind: 'rich', max: 2000, hint: RICH_HINT },
      BUTTONS,
    ],
    sample: { label: 'about', width: 'wide', nav: true, heading: 'Your name', text: 'A sentence or two about you.', buttons: [] },
  },
  list: {
    name: 'List', desc: 'Short rows (title + subtitle), optional progress bar',
    fields: [
      {
        key: 'items', label: 'Rows', kind: 'list', item: 'row',
        fields: [
          { key: 'title', label: 'Title', kind: 'text', max: 120 },
          { key: 'subtitle', label: 'Subtitle', kind: 'text', max: 200 },
        ],
        sample: { title: 'Title', subtitle: 'Subtitle' },
      },
      { key: 'progressLabel', label: 'Progress bar label (blank = no bar)', kind: 'text', max: 60 },
      { key: 'progressStart', label: 'Progress start', kind: 'date' },
      { key: 'progressEnd', label: 'Progress end', kind: 'date' },
    ],
    sample: { label: 'now', width: 'narrow', items: [{ title: 'Title', subtitle: 'Subtitle' }] },
  },
  chips: {
    name: 'Tags', desc: 'Groups of small tags (skills, tools)',
    fields: [
      {
        key: 'groups', label: 'Groups', kind: 'list', item: 'group',
        fields: [
          { key: 'heading', label: 'Heading', kind: 'text', max: 60 },
          { key: 'items', label: 'Tags (comma separated)', kind: 'csv', max: 60 },
        ],
        sample: { heading: 'group', items: ['one', 'two'] },
      },
    ],
    sample: { label: 'stack', width: 'full', nav: true, groups: [{ heading: 'group', items: ['one', 'two'] }] },
  },
  cards: {
    name: 'Cards', desc: 'Boxes for projects, jobs, certificates',
    fields: [
      { key: 'text', label: 'Intro line (optional)', kind: 'rich', max: 1000, hint: RICH_HINT },
      BUTTONS,
      { key: 'style', label: 'Card style', kind: 'select', options: [['normal', 'Normal'], ['compact', 'Compact (title + one line)']] },
      {
        key: 'cards', label: 'Cards', kind: 'list', item: 'card',
        fields: [
          { key: 'title', label: 'Title', kind: 'text', max: 160 },
          { key: 'href', label: 'Title link (optional)', kind: 'link' },
          { key: 'kicker', label: 'Small line under the title', kind: 'text', max: 160 },
          { key: 'when', label: 'Date (right side)', kind: 'text', max: 60 },
          { key: 'text', label: 'Description', kind: 'rich', max: 1500, hint: RICH_HINT },
          { key: 'bullets', label: 'Bullet points (one per line)', kind: 'lines', max: 400 },
          { key: 'foot', label: 'Footer line', kind: 'text', max: 300 },
          { key: 'repo', label: 'GitHub repo name (fills description, language, stars live)', kind: 'text', max: 100 },
        ],
        sample: { title: 'New card', kicker: '', text: 'What it is.' },
      },
    ],
    sample: { label: 'projects', width: 'full', nav: true, style: 'normal', cards: [{ title: 'New card', text: 'What it is.' }] },
  },
  text: {
    name: 'Text', desc: 'Paragraphs and buttons',
    fields: [
      { key: 'heading', label: 'Heading (optional)', kind: 'text', max: 120 },
      { key: 'text', label: 'Text', kind: 'rich', max: 4000, hint: RICH_HINT },
      BUTTONS,
    ],
    sample: { label: 'notes', width: 'full', text: 'Write something here.' },
  },
  image: {
    name: 'Image', desc: 'A picture (paste a link from the files tab)',
    fields: [
      { key: 'src', label: 'Image URL', kind: 'link', hint: 'Copy raw on a file in the files tab, paste here' },
      { key: 'alt', label: 'Alt text (describe the image)', kind: 'text', max: 300 },
      { key: 'caption', label: 'Caption (optional)', kind: 'rich', max: 500 },
      { key: 'href', label: 'Link when clicked (optional)', kind: 'link' },
    ],
    sample: { label: 'image', width: 'full', src: '', alt: '' },
  },
  activity: {
    name: 'GitHub activity', desc: 'Contribution calendar from GitHub',
    fields: [{ key: 'user', label: 'GitHub username (blank = page setting)', kind: 'text', max: 39 }],
    sample: { label: 'activity', width: 'full', nav: true },
  },
  contact: {
    name: 'Contact', desc: 'Big email link, buttons, small print',
    fields: [
      { key: 'text', label: 'Text', kind: 'rich', max: 1000, hint: RICH_HINT },
      { key: 'email', label: 'Email', kind: 'email' },
      BUTTONS,
      { key: 'fineprint', label: 'Small print ({year} = current year)', kind: 'text', max: 200 },
    ],
    sample: { label: 'contact', width: 'full', nav: true, text: 'Email is the fastest way to reach me.', email: '', buttons: [], fineprint: '© {year}' },
  },
};

/* ---------- defaults (the system24 portfolio from design/system24-site) ---------- */

const RESUME = 'https://sambawa.dev/resume';
const GITHUB = 'https://github.com/samrathbawa';
const LINKEDIN = 'https://www.linkedin.com/in/sam-bawa/';
const EMAIL = 'samrathbawa@outlook.com';
const BANNER = `███████╗ █████╗ ███╗   ███╗    ██████╗  █████╗ ██╗    ██╗ █████╗
██╔════╝██╔══██╗████╗ ████║    ██╔══██╗██╔══██╗██║    ██║██╔══██╗
███████╗███████║██╔████╔██║    ██████╔╝███████║██║ █╗ ██║███████║
╚════██║██╔══██║██║╚██╔╝██║    ██╔══██╗██╔══██║██║███╗██║██╔══██║
███████║██║  ██║██║ ╚═╝ ██║    ██████╔╝██║  ██║╚███╔███╔╝██║  ██║
╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝    ╚═════╝ ╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═╝`;

export const DEFAULT_SITE = {
  mode: 'building',
  page: {
    title: 'Sam Bawa · race car firmware, CS at Cal Poly Pomona',
    description: 'Samrath Bawa: CS student at Cal Poly Pomona and software captain on Bronco Electric Motorsports, writing firmware for an electric race car.',
    prompt: 'sam',
    github: 'samrathbawa',
  },
  blocks: [
    {
      id: 'about', type: 'intro', label: 'about', width: 'wide', nav: true,
      banner: BANNER,
      heading: 'Samrath Bawa',
      text: "I write firmware for an electric race car. I'm software captain on Bronco Electric Motorsports, our Formula SAE Electric student team, where I lead 7 developers and own the CAN bus network that ties the car's Teensy 4.1 and ESP32 boards together. On the side I build sim-racing tools.",
      buttons: [
        { label: 'Download resume (PDF) ↓', href: RESUME, primary: true },
        { label: 'GitHub ↗', href: GITHUB },
        { label: 'LinkedIn ↗', href: LINKEDIN },
        { label: 'Email me', href: `mailto:${EMAIL}` },
      ],
    },
    {
      id: 'now', type: 'list', label: 'now', width: 'narrow',
      items: [
        { title: 'Software Captain', subtitle: 'Bronco Electric Motorsports · since Oct 2026' },
        { title: 'AI Training Fellow', subtitle: 'Handshake AI · since Jul 2026' },
        { title: 'B.S. Computer Science', subtitle: "Cal Poly Pomona · GPA 3.61 · Dean's List" },
      ],
      progressLabel: 'degree progress', progressStart: '2025-08-21', progressEnd: '2029-05-20',
    },
    {
      id: 'stack', type: 'chips', label: 'stack', width: 'full', nav: true,
      groups: [
        { heading: 'languages', items: ['C++', 'Java', 'Python', 'R', 'JavaScript', 'HTML', 'CSS', 'x86 Assembly'] },
        { heading: 'embedded', items: ['Teensy 4.1', 'ESP32', 'CAN bus', 'PlatformIO', 'Altium', 'KiCad'] },
        { heading: 'cad + analysis', items: ['SolidWorks', 'Fusion 360', 'Ansys (FEA)'] },
        { heading: 'tools', items: ['Git', 'pandas', 'JUnit', 'REST APIs'] },
      ],
    },
    {
      id: 'projects', type: 'cards', label: 'projects', width: 'full', nav: true, style: 'normal',
      cards: [
        { title: 'ForzaFFB', href: `${GITHUB}/ForzaFFB`, kicker: 'GitHub repo', repo: 'ForzaFFB', text: 'Turns live car data from a racing game into steering forces on a real wheel, using virtual device drivers.' },
        { title: 'macro', href: `${GITHUB}/macro`, kicker: 'GitHub repo', repo: 'macro' },
        {
          title: 'Race car dashboard and steering wheel display', kicker: 'Teensy · CAN bus · Altium',
          bullets: [
            'Designed a sunlight readable CAN wheel display and a Teensy 4.1 dashboard schematic for the car',
            "Migrated the team's ESP32 sensor board from KiCad to Altium, verifying all 110 parts and 75 nets",
          ],
        },
        {
          title: 'Accelerator pedal stress analysis', kicker: 'SolidWorks · Ansys',
          bullets: [
            'Ran FEA on the pedal shock mounts, found the stock part too close to failing, and designed an aluminum pedal stop (safety factor 2.4)',
            'Built a posable 95th percentile driver model in SolidWorks to check the car against the FSAE driver fit rules',
          ],
        },
      ],
    },
    { id: 'activity', type: 'activity', label: 'activity', width: 'full', nav: true },
    {
      id: 'certifications', type: 'cards', label: 'certifications', width: 'full', style: 'compact',
      cards: [
        { title: 'Supervised Machine Learning: Regression and Classification', href: 'https://www.coursera.org/account/accomplishments/records/83KXJAZGQYKS', kicker: 'Stanford CPD · DeepLearning.AI' },
        { title: 'Advanced Learning Algorithms', href: 'https://www.coursera.org/account/accomplishments/records/KDFBJ7DLZZNN', kicker: 'Stanford CPD · DeepLearning.AI' },
        { title: 'Unsupervised Learning, Recommenders, Reinforcement Learning', href: 'https://www.coursera.org/account/accomplishments/records/LH78K3N42TT5', kicker: 'Stanford CPD · DeepLearning.AI' },
        { title: 'Claude 101', href: 'https://verify.skilljar.com/c/8kb7ysbuvvz6', kicker: 'Anthropic' },
      ],
    },
    {
      id: 'resume', type: 'cards', label: 'resume', width: 'full', nav: true, style: 'normal',
      text: 'Highlights below. The one-page PDF has the rest.',
      buttons: [{ label: 'Download resume (PDF) ↓', href: RESUME, primary: true }],
      cards: [
        {
          title: 'Software Captain', kicker: 'Bronco Electric Motorsports (FSAE Electric)', when: 'Oct 2026 – present',
          bullets: [
            "Lead a software team of 7 on the electric race car and set its code, Git, and documentation standards",
            "Develop the car's firmware in C++ for Teensy 4.1 and ESP32 microcontrollers using PlatformIO, and own the CAN bus network linking the dashboard, wheel display, and sensor board",
            "Review team members' pull requests to enforce the team's code standards",
            "Refactored last year's full firmware codebase into modules the new car runs on",
          ],
        },
        {
          title: 'B.S. Computer Science', kicker: 'Cal Poly Pomona', when: '2025 – 2029',
          text: "GPA 3.61 · Dean's List",
          foot: 'Data Structures and Algorithms, Computer Organization and Assembly, Systems Programming, C++, Discrete Structures, UI Design, Probability and Statistics',
        },
        {
          title: 'AI Training Fellow', kicker: 'Handshake AI · remote', when: 'Jul 2026 – present',
          bullets: [
            'Design hard questions about charts, tables, and images to find where AI models break, tagging each by the kind of reasoning it tests',
            'Author money and tax questions that take five or more documents to answer',
            'Build grading rubrics that score AI answers point by point, and document what each answer got wrong as training data',
            "Rate and caption AI generated video, images, and audio against the project's style guide",
          ],
        },
        { title: 'Vice President', kicker: 'Woodbridge HS Web Dev Club', when: '2023 – 2025', text: 'Taught members HTML, CSS, and JavaScript and built websites for other clubs and teachers.' },
        { title: 'Jr. Auxiliary Volunteer', kicker: 'Hoag Hospital', when: '2024 – 2025', text: 'Helped patients and visitors find their way around the hospital and pushed wheelchairs.' },
      ],
    },
    {
      id: 'contact', type: 'contact', label: 'contact', width: 'full', nav: true,
      text: 'Email is the fastest way to reach me.',
      email: EMAIL,
      buttons: [
        { label: 'GitHub ↗', href: GITHUB },
        { label: 'LinkedIn ↗', href: LINKEDIN },
        { label: 'Download resume (PDF) ↓', href: RESUME },
      ],
      fineprint: '© {year} Samrath Bawa',
    },
  ],
};

/* ---------- validation ---------- */

const str = (v, max = 200) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '').trim().slice(0, max);

// http(s), mailto, site-relative paths and #anchors only; anything else (javascript: etc.) is dropped.
export function safeHref(v) {
  const s = str(v, 2000);
  if (/^(https?:\/\/|mailto:)/i.test(s)) return s;
  if (/^\/(?!\/)/.test(s) || /^#[\w-]*$/.test(s)) return s;
  return '';
}

function normalizeField(desc, v) {
  switch (desc.kind) {
    case 'check': return v === true;
    case 'link': return safeHref(v);
    case 'email': return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(str(v, 254)) ? str(v, 254) : '';
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(str(v, 10)) ? str(v, 10) : '';
    case 'select': return desc.options.some((o) => o[0] === v) ? v : desc.options[0][0];
    case 'code': return (typeof v === 'string' ? v : '').replace(/\r/g, '').replace(/\s+$/, '').slice(0, desc.max || 4000);
    case 'rich':
    case 'textarea': return (typeof v === 'string' ? v : '').replace(/\r/g, '').trim().slice(0, desc.max || 2000);
    case 'lines':
    case 'csv': return (Array.isArray(v) ? v : []).map((x) => str(x, desc.max || 200)).filter(Boolean).slice(0, MAX_ITEMS);
    case 'list': return (Array.isArray(v) ? v : []).slice(0, MAX_ITEMS).map((item) => normalizeObject(desc.fields, item));
    default: return str(v, desc.max || 200);
  }
}

function normalizeObject(fields, input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  fields.forEach((f) => { out[f.key] = normalizeField(f, src[f.key]); });
  return out;
}

export function slug(s) {
  return str(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'block';
}

export function normalizeBlock(input) {
  const type = input && BLOCK_TYPES[input.type] ? input.type : null;
  if (!type) return null;
  return {
    id: str(input.id, 60),
    type,
    ...normalizeObject(COMMON_FIELDS, input),
    ...normalizeObject(BLOCK_TYPES[type].fields, input),
  };
}

// Block ids are the #anchors in the nav: unique, URL-safe, and never clashing with page ids.
const RESERVED_IDS = new Set(['main', 'theme-toggle', 'clock', 'status-current']);
function uniqueIds(blocks) {
  const used = new Set(RESERVED_IDS);
  blocks.forEach((b) => {
    const base = slug(b.id || b.label || b.type);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    b.id = id;
  });
  return blocks;
}

export function normalizeSite(input) {
  const src = input && typeof input === 'object' ? input : {};
  const page = normalizeObject(PAGE_FIELDS, { ...DEFAULT_SITE.page, ...src.page });
  const blocks = Array.isArray(src.blocks) ? src.blocks : DEFAULT_SITE.blocks;
  return {
    mode: MODES.includes(src.mode) ? src.mode : DEFAULT_SITE.mode,
    page,
    blocks: uniqueIds(blocks.slice(0, MAX_BLOCKS).map(normalizeBlock).filter(Boolean)),
  };
}

export function newBlock(type) {
  const t = BLOCK_TYPES[type];
  return normalizeBlock({ type, ...JSON.parse(JSON.stringify(t.sample)) });
}

/* ---------- rendering ---------- */

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// External links and files open in a new tab; #anchors and mailto stay put.
function linkAttrs(href) {
  const a = `href="${esc(href)}"`;
  return /^(#|mailto:)/i.test(href) ? a : `${a} target="_blank" rel="noopener noreferrer"`;
}

// Minimal formatting: **bold**, [text](link), single newline = line break.
export function inline(s) {
  const re = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(s))) {
    out += esc(s.slice(last, m.index));
    if (m[3] != null) out += `<strong>${esc(m[3])}</strong>`;
    else {
      const href = safeHref(m[2]);
      out += href ? `<a ${linkAttrs(href)}>${esc(m[1])}</a>` : esc(m[0]);
    }
    last = re.lastIndex;
  }
  return (out + esc(s.slice(last))).replace(/\n/g, '<br>');
}

function rich(s, cls = 'rich') {
  const paras = String(s || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paras.length ? `<div class="${cls}">${paras.map((p) => `<p>${inline(p)}</p>`).join('')}</div>` : '';
}

function buttons(list) {
  const items = (list || []).filter((b) => b.label && b.href);
  if (!items.length) return '';
  return `<div class="buttons">${items.map((b) =>
    `<a class="btn${b.primary ? ' primary' : ''}" ${linkAttrs(b.href)}>${esc(b.label)}</a>`).join('')}</div>`;
}

const RENDER = {
  intro(b) {
    const h = b.heading ? `<h1 class="${b.banner ? 'sr-only' : 'intro-heading'}" id="${b.id}-h">${esc(b.heading)}</h1>` : '';
    const banner = b.banner ? `<pre class="banner" aria-hidden="true">${esc(b.banner)}</pre>` : '';
    return `${banner}${h}${rich(b.text, 'intro rich')}${buttons(b.buttons)}`;
  },

  list(b) {
    const rows = b.items.filter((i) => i.title || i.subtitle).map((i) =>
      `<li><div class="now-role">${esc(i.title)}</div>${i.subtitle ? `<div class="now-org">${esc(i.subtitle)}</div>` : ''}</li>`).join('');
    let progress = '';
    if (b.progressLabel && b.progressStart && b.progressEnd) {
      const y0 = b.progressStart.slice(0, 4);
      const y1 = b.progressEnd.slice(0, 4);
      progress = `<div class="progress" data-start="${b.progressStart}" data-end="${b.progressEnd}">
          <div class="progress-label"><span>${esc(b.progressLabel)}</span><span>${y0} → ${y1}</span></div>
          <div class="bar" role="progressbar" aria-label="${esc(b.progressLabel)}" aria-valuemin="0" aria-valuemax="100">
            <div class="bar-fill"></div>
            <div class="bar-text" aria-hidden="true"><span class="done">--%</span><span>${y1}</span></div>
          </div>
        </div>`;
    }
    return `${rows ? `<ul class="now-list">${rows}</ul>` : ''}${progress}`;
  },

  chips(b) {
    return `<div class="stack-grid">${b.groups.map((g) => `<div>
          ${g.heading ? `<h3 class="stack-head">${esc(g.heading)}</h3>` : ''}
          <ul class="chips">${g.items.map((t) => `<li class="chip">${esc(t)}</li>`).join('')}</ul>
        </div>`).join('')}</div>`;
  },

  cards(b, site) {
    const head = b.text || b.buttons.length ? `<div class="resume-head">${rich(b.text)}${buttons(b.buttons)}</div>` : '';
    const user = site.page.github;
    if (b.style === 'compact') {
      return `${head}<ul class="cards compact">${b.cards.map((c) => `<li class="card">
          <h3 class="card-title">${c.href ? `<a ${linkAttrs(c.href)}>${esc(c.title)}</a>` : `<span>${esc(c.title)}</span>`}</h3>
          ${c.kicker ? `<div class="card-kicker">${esc(c.kicker)}</div>` : ''}
          ${rich(c.text, 'card-desc rich')}
        </li>`).join('')}</ul>`;
    }
    return `${head}<div class="cards">${b.cards.map((c) => {
      const href = c.href || (c.repo && user ? `https://github.com/${encodeURIComponent(user)}/${encodeURIComponent(c.repo)}` : '');
      const title = href ? `<a ${linkAttrs(href)}>${esc(c.title || c.repo)}</a>` : `<span>${esc(c.title)}</span>`;
      const when = c.repo ? `<span class="when" data-slot="updated">${esc(c.when)}</span>` : (c.when ? `<span class="when">${esc(c.when)}</span>` : '');
      const top = c.kicker || when ? `<div class="card-top"><span class="card-kicker">${esc(c.kicker)}</span>${when}</div>` : '';
      const desc = c.repo
        ? `<p class="card-desc" data-slot="desc">${c.text ? inline(c.text) : ''}</p>`
        : rich(c.text, 'card-desc rich');
      const bullets = c.bullets.length ? `<ul>${c.bullets.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>` : '';
      const foot = c.repo || c.foot ? `<p class="card-foot"${c.repo ? ' data-slot="meta"' : ''}>${esc(c.foot)}</p>` : '';
      return `<article class="card"${c.repo ? ` data-repo="${esc(c.repo)}"` : ''}>
          <h3 class="card-title">${title}</h3>
          ${top}${desc}${bullets}${foot}
        </article>`;
    }).join('')}</div>`;
  },

  text(b) {
    return `${b.heading ? `<h3 class="text-heading">${esc(b.heading)}</h3>` : ''}${rich(b.text)}${buttons(b.buttons)}`;
  },

  image(b) {
    if (!b.src) return '<p class="muted">No image yet.</p>';
    const img = `<img src="${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy">`;
    return `<figure class="image-block">${b.href ? `<a ${linkAttrs(b.href)}>${img}</a>` : img}${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ''}</figure>`;
  },

  activity(b, site) {
    const user = b.user || site.page.github;
    if (!user) return '<p class="activity-summary">Set a GitHub username to show activity.</p>';
    return `<div class="calendar-scroll"><div class="calendar" data-calendar="${esc(user)}" aria-hidden="true"></div></div>
        <p class="activity-summary" aria-live="polite">Loading GitHub contributions…</p>`;
  },

  contact(b) {
    const year = String(new Date().getFullYear());
    return `${rich(b.text, 'contact-lead rich')}
        ${b.email ? `<a class="contact-mail" href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : ''}
        ${buttons(b.buttons)}
        ${b.fineprint ? `<p class="fineprint">${esc(b.fineprint.replace(/\{year\}/g, year))}</p>` : ''}`;
  },
};

function renderBlock(b, site) {
  // The intro is named by its h1; every other block by its label, drawn as an h2 on the border.
  const label = b.type === 'intro'
    ? `<span class="label" aria-hidden="true">${esc(b.label)}</span>`
    : `<h2 class="label" id="${b.id}-h">${esc(b.label)}</h2>`;
  const named = b.type === 'intro' ? b.heading : b.label;
  const aria = named ? ` aria-labelledby="${b.id}-h"` : '';
  return `
      <section class="panel w-${b.width} block-${b.type}" id="${b.id}" data-block="${b.id}"${aria}>
        ${b.label ? label : ''}
        ${RENDER[b.type](b, site)}
      </section>`;
}

const ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%231b1b1b'/%3E%3Ctext x='50' y='66' font-size='44' text-anchor='middle' font-family='monospace' fill='%2378c4d8'%3ESB%3C/text%3E%3C/svg%3E";

// Full homepage. `site` must already be normalized.
export function renderHome(site, { origin = 'https://sambawa.dev' } = {}) {
  const { page } = site;
  const blocks = site.blocks.filter((b) => !b.hidden);
  const nav = blocks.filter((b) => b.nav && b.label);
  const tabs = nav.length ? `<nav class="tabs" aria-label="Main">
        ${nav.map((b, i) => `<a href="#${b.id}"><span class="n" aria-hidden="true">${i + 1}:</span>${esc(b.label)}</a>`).join('\n        ')}
      </nav>` : '';
  const first = nav[0];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
  <meta name="color-scheme" content="dark light">
  <meta name="theme-color" content="#1b1b1b">
  <link rel="canonical" href="${esc(origin)}/">
  <meta property="og:title" content="${esc(page.title)}">
  <meta property="og:description" content="${esc(page.description)}">
  <meta property="og:url" content="${esc(origin)}/">
  <meta property="og:type" content="website">
  <script>
    // Apply a saved theme before first paint; with none saved, CSS follows the OS setting.
    (function () {
      var forced = new URLSearchParams(location.search).get('theme');
      var stored = null;
      try { stored = localStorage.getItem('theme'); } catch (e) {}
      var theme = forced || stored;
      if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    })();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/home.css">
  <link rel="icon" href="${ICON}">
</head>
<body data-github="${esc(page.github)}">

  <a class="skip" href="#main">Skip to content</a>

  <div class="page">

    <header class="topbar panel">
      <span class="label" aria-hidden="true">sambawa.dev</span>
      <a class="prompt" href="#${first ? first.id : 'main'}"><span class="dim">~/</span>${esc(page.prompt)}</a>
      ${tabs}
      <button class="theme-btn" id="theme-toggle" type="button" aria-label="Switch to light theme">◐ light</button>
    </header>

    <main class="grid" id="main">
${blocks.map((b) => renderBlock(b, site)).join('\n')}
    </main>

    <div class="statusbar panel" aria-hidden="true">
      <span class="session">${esc(page.prompt)}</span>
      <span class="current" id="status-current">${first ? `1:${esc(first.label)}` : ''}</span>
      <span class="right"><span class="dot"></span><span id="clock">--:--</span></span>
    </div>

  </div>

  <script src="/js/home.js" defer></script>
</body>
</html>`;
}
