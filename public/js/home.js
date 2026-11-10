/* sambawa.dev homepage behaviour: theme toggle (+ hidden dashboard door), nav scroll spy, clock,
   progress bars, and live GitHub data for repo cards and activity calendars.
   Works on whatever blocks the worker rendered, so every part is optional. */

(function () {
  'use strict';

  var CONFIG = {
    user: document.body.dataset.github || '',
    repoCacheTtl: 30 * 60 * 1000,
    calendarCacheTtl: 60 * 60 * 1000
  };

  /* ---------- theme ---------- */

  var toggle = document.getElementById('theme-toggle');
  var prefersLight = window.matchMedia('(prefers-color-scheme: light)');
  function currentTheme() {
    return document.documentElement.dataset.theme || (prefersLight.matches ? 'light' : 'dark');
  }
  function applyToggleLabel() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    toggle.textContent = '◐ ' + next;
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }
  // Hidden door: 10 theme toggles within 5 s opens the uploads dashboard.
  var toggleClicks = [];
  toggle.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    applyToggleLabel();

    var now = Date.now();
    toggleClicks = toggleClicks.filter(function (t) { return now - t < 5000; });
    toggleClicks.push(now);
    if (toggleClicks.length >= 10) location.href = '/dashboard/';
  });
  prefersLight.addEventListener('change', applyToggleLabel);
  applyToggleLabel();

  /* ---------- tabs: scroll spy ---------- */

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs a'));
  var targets = tabs.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var statusCurrent = document.getElementById('status-current');

  function setCurrent(i) {
    tabs.forEach(function (a, j) {
      if (i === j) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    statusCurrent.textContent = tabs[i].textContent;
  }

  function spy() {
    var line = window.innerHeight * 0.35;
    var idx = 0;
    targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top <= line) idx = i; });
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) idx = targets.length - 1;
    setCurrent(idx);
  }
  if (tabs.length) {
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  /* ---------- clock + progress bars ---------- */

  var clock = document.getElementById('clock');
  function tick() {
    clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 15000);

  document.querySelectorAll('.progress[data-start]').forEach(function (p) {
    var start = new Date(p.dataset.start).getTime();
    var end = new Date(p.dataset.end).getTime();
    var pct = end > start ? Math.max(0, Math.min(100, Math.round((Date.now() - start) / (end - start) * 100))) : 0;
    p.querySelector('.bar-fill').style.width = pct + '%';
    p.querySelector('.done').textContent = pct + '%';
    var bar = p.querySelector('.bar');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.setAttribute('aria-valuetext', pct + '% of the way to ' + p.dataset.end.slice(0, 4));
  });

  /* ---------- cache helper ---------- */

  function cacheGet(key, ttl) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      return { data: entry.data, fresh: (Date.now() - entry.t) < ttl };
    } catch (e) { return null; }
  }
  function cacheSet(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), data: data })); } catch (e) {}
  }

  /* ---------- repos ---------- */

  function relTime(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    var steps = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']];
    for (var i = 0; i < steps.length; i++) {
      if (s >= steps[i][0]) return Math.floor(s / steps[i][0]) + steps[i][1] + ' ago';
    }
    return 'just now';
  }

  var repoCards = document.querySelectorAll('[data-repo]');

  function renderRepos(repos) {
    var byName = {};
    repos.forEach(function (r) { byName[r.name.toLowerCase()] = r; });
    repoCards.forEach(function (card) {
      var repo = byName[card.dataset.repo.toLowerCase()];
      if (!repo) return;
      if (repo.description) card.querySelector('[data-slot="desc"]').textContent = repo.description;
      var parts = [];
      if (repo.language) parts.push(repo.language);
      if (repo.stargazers_count > 0) parts.push(repo.stargazers_count + (repo.stargazers_count === 1 ? ' star' : ' stars'));
      if (repo.forks_count > 0) parts.push(repo.forks_count + (repo.forks_count === 1 ? ' fork' : ' forks'));
      card.querySelector('[data-slot="meta"]').textContent = parts.join(' · ');
      card.querySelector('[data-slot="updated"]').textContent = 'updated ' + relTime(repo.pushed_at);
    });
  }

  // One call for all of the user's repos, cached per user so a new card shows up without waiting.
  function loadRepos() {
    if (!repoCards.length || !CONFIG.user) return;
    var cacheKey = 'gh-repos-v4:' + CONFIG.user;
    var cached = cacheGet(cacheKey, CONFIG.repoCacheTtl);
    if (cached && cached.fresh) { renderRepos(cached.data); return; }
    fetch('https://api.github.com/users/' + encodeURIComponent(CONFIG.user) + '/repos?per_page=100')
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (all) {
        var slim = all.map(function (r) {
          return { name: r.name, description: r.description, language: r.language,
            stargazers_count: r.stargazers_count, forks_count: r.forks_count, pushed_at: r.pushed_at };
        });
        cacheSet(cacheKey, slim);
        renderRepos(slim);
      })
      .catch(function () { if (cached) renderRepos(cached.data); });
  }

  /* ---------- contribution calendars ---------- */

  function profileLink(user) {
    var a = document.createElement('a');
    a.href = 'https://github.com/' + encodeURIComponent(user);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = 'github.com/' + user;
    return a;
  }

  function setSummary(summary, text, user) {
    summary.textContent = text;
    summary.appendChild(profileLink(user));
  }

  function renderCalendar(calendar, summary, user, payload) {
    var days = payload.contributions;
    var frag = document.createDocumentFragment();
    var firstDow = new Date(days[0].date + 'T00:00:00').getDay();
    for (var p = 0; p < firstDow; p++) {
      var pad = document.createElement('i');
      pad.style.visibility = 'hidden';
      frag.appendChild(pad);
    }
    days.forEach(function (d) {
      var cell = document.createElement('i');
      if (d.level > 0) cell.dataset.l = String(d.level);
      cell.title = d.date + ' · ' + d.count + (d.count === 1 ? ' contribution' : ' contributions');
      frag.appendChild(cell);
    });
    calendar.textContent = '';
    calendar.appendChild(frag);
    var total = payload.total && payload.total.lastYear !== undefined
      ? payload.total.lastYear
      : days.reduce(function (sum, d) { return sum + d.count; }, 0);
    setSummary(summary, total + ' GitHub contributions in the last 12 months · ', user);
    var scroller = calendar.parentElement;
    scroller.scrollLeft = scroller.scrollWidth;
  }

  function loadCalendar(calendar) {
    var user = calendar.dataset.calendar;
    var summary = calendar.parentElement.nextElementSibling;
    var cacheKey = 'gh-cal-v4:' + user;
    var cached = cacheGet(cacheKey, CONFIG.calendarCacheTtl);
    if (cached && cached.fresh) { renderCalendar(calendar, summary, user, cached.data); return; }
    fetch('https://github-contributions-api.jogruber.de/v4/' + encodeURIComponent(user) + '?y=last')
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) {
        if (!data.contributions || !data.contributions.length) throw new Error('empty');
        cacheSet(cacheKey, data);
        renderCalendar(calendar, summary, user, data);
      })
      .catch(function () {
        if (cached) { renderCalendar(calendar, summary, user, cached.data); return; }
        calendar.parentElement.hidden = true;
        setSummary(summary, 'Couldn\'t load the contribution calendar. See ', user);
      });
  }

  loadRepos();
  document.querySelectorAll('[data-calendar]').forEach(loadCalendar);
})();
