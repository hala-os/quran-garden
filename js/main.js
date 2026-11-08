import * as store from './store.js';
import { todayStr } from './store.js';
import * as planner from './planner.js';
import {
  loadMeta, META, surah, pageLabel, pageSurahNames, pageSurahs, ar, versesForPages, vkey, pageRange, cmpVerse, tafsir, juzOfPage, loadPage,
} from './data.js';
import { renderPage, highlight, fit } from './mushaf.js';
import { Player, RECITERS } from './player.js';
import { applyTheme, themeOf, startRain, fireSound } from './scene.js';
import { viewGarden, windowLevel } from './garden.js';
import { popOut, closePopout, refreshPopout, canPopOut } from './popout.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const player = new Player();
let S; // app state
let mushafPage = 106;

// ---------- boot ----------
(async function boot() {
  await loadMeta();
  S = store.load();
  mushafPage = S.lastPage || 106;
  Object.assign(S.settings, themeOf(S.settings));
  applyTheme(S.settings);
  setInterval(() => applyTheme(S.settings), 5 * 60 * 1000);
  startRain($('#rain'));
  const art = $('.scene-art'), sceneEl = $('#scene');
  const fitScene = () => {
    art.setAttribute('preserveAspectRatio', sceneEl.clientWidth / sceneEl.clientHeight > 3.4 ? 'xMidYMax meet' : 'xMidYMax slice');
    // rain only falls on the window glass
    const g = $('.frame').getBoundingClientRect(), sc = sceneEl.getBoundingClientRect(), c = $('#rain');
    Object.assign(c.style, { left: (g.left - sc.left) + 'px', top: (g.top - sc.top) + 'px', width: g.width + 'px', height: g.height + 'px' });
  };
  new ResizeObserver(fitScene).observe(sceneEl); fitScene();
  window.addEventListener('hashchange', route);
  const sb = $('#soundBtn');
  const syncSound = () => sb.setAttribute('aria-pressed', S.settings.fire ? 'true' : 'false');
  syncSound();
  sb.addEventListener('click', () => { S.settings.fire = !S.settings.fire; fireSound(S.settings.fire); store.save(); syncSound(); if (currentView === 'settings') viewSettings(); });
  setupPlayerBar();
  route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
    // when a new version takes over, reload once so you see it straight away
    let reloaded = false; const hadOld = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadOld && !reloaded) { reloaded = true; location.reload(); } });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && currentView === 'today') route(); });
})();

let currentView = null;
function route() {
  const [, view = 'today', arg] = location.hash.split('/');
  currentView = view;
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === view));
  document.body.dataset.view = view;
  closeSheet();
  if (view === 'mushaf') { if (arg) mushafPage = clampPage(+arg); viewMushaf(); }
  else if (view === 'settings') viewSettings();
  else if (view === 'garden') showGarden();
  else viewToday();
  growWindow();
  $('#view').focus({ preventScroll: true });
}
const clampPage = (p) => Math.max(1, Math.min(604, p || 1));

// ---------- quick marking: memorized / reviewed, right from a page ----------
function openMarkSheet(ps) {
  const body = h(`<div><h3>${ps.length > 1 ? 'These pages' : 'This page'}</h3><div class="mark-list"></div></div>`);
  const list = body.querySelector('.mark-list');
  const redraw = () => { list.innerHTML = ''; ps.forEach(p => list.append(pageMarkEl(p, redraw))); };
  redraw();
  openSheet(body);
}

// The little "how is this page doing" panel: mark it memorized, or say how a review felt.
function pageMarkEl(p, refresh) {
  const info = S.pages[p];
  const on = pageSurahs(p);
  const growingPage = info && (info.status === 'review' || info.status === 'learning');
  const covered = growingPage ? (info.only || on) : [];
  const today = todayStr();
  const rated = planner.dayOf(S, today).reviewed[p];
  const el = h(`<div class="mark-page">
    <div class="mp-row"><div class="pc-num">${ar(p)}</div><div><div class="pc-title">${pageLabel(p)}</div>
      <div class="pc-sub">Page ${p} · ${!info ? 'not memorized yet' : info.status === 'seed' ? 'sleeping seed' : info.status === 'learning' ? 'settling in this week' : 'in review'}${info?.only ? ` · only ${info.only.map(x => surah(x).ar).join('، ')}` : ''}</div></div></div>
    <div class="mp-acts"></div></div>`);
  const acts = el.querySelector('.mp-acts');
  const done = (msg) => { planner.todayPlan(S, today, true); store.save(); toast(msg); growWindow(); refresh?.(); };
  if (growingPage) {
    acts.append(h(`<p class="hint">Reviewed it today? How did it feel?</p>`));
    const r = h(`<div class="rate">${['strong', 'okay', 'shaky'].map(x => `<button class="chip ${rated === x ? 'on' : ''}" data-r="${x}">${{ strong: 'Strong', okay: 'Okay', shaky: 'Shaky' }[x]}</button>`).join('')}</div>`);
    r.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      if (rated === b.dataset.r) planner.unrate(S, p); else planner.rate(S, p, b.dataset.r);
      done(rated === b.dataset.r ? 'Review undone' : 'Watered 💧');
    });
    acts.append(r);
  }
  const missing = on.filter(x => !covered.includes(x));
  if (missing.length) {
    if (on.length === 1) {
      const b = h(`<button class="btn">I've memorized this page</button>`);
      b.onclick = () => { planner.markLearned(S, p); done('A new seed is planted 🌱'); };
      acts.append(b);
    } else {
      acts.append(h(`<p class="hint">${growingPage ? 'Also memorized:' : 'Which part have you memorized?'}</p>`));
      const row = h(`<div class="rate"></div>`);
      missing.forEach(x => {
        const b = h(`<button class="chip">${surah(x).ar}</button>`);
        b.onclick = () => {
          planner.setStatus(S, p, p, 'review', today, x, pageSurahs);
          if (!growingPage) { // a fresh page settles in for a week, like any new page
            Object.assign(S.pages[p], { status: 'learning', learnedOn: today, last: today });
            const d = planner.dayOf(S, today); if (!d.learned.includes(p)) d.learned.push(p);
          }
          done('A new seed is planted 🌱');
        };
        row.append(b);
      });
      if (!growingPage) {
        const all = h(`<button class="chip">The whole page</button>`);
        all.onclick = () => { planner.markLearned(S, p); done('A new seed is planted 🌱'); };
        row.append(all);
      }
      acts.append(row);
    }
  }
  return el;
}

// ---------- Garden ----------
function showGarden() {
  viewGarden($('#view'), { S, h, openSheet, closeSheet, toast, openMushafLoop, openWakeSheet, store, planner, pageMarkEl });
}
// the little flowers in the window grow with the garden
function growWindow() { $('#scene').dataset.g = windowLevel(S); }

// ---------- Today ----------
const REASONS = {
  first: "Let's begin with Al-Ma'idah. One page today, gently. Loop it, recite it, and tap memorized when it feels settled.",
  normal: 'One new page and a little review. Small and steady.',
  'review-day': 'A review day. No new pages today, just watering your garden.',
  'welcome-back': 'Welcome back. Today is a gentle review only, so you can find your rhythm again.',
  gentle: 'Your recent pages would love some extra care, so today is review only.',
  complete: 'You have no new pages left on your list. ما شاء الله',
};

function greeting() {
  const hr = new Date().getHours();
  if (hr < 5) return 'A quiet night';
  if (hr < 12) return 'صباح الخير';
  if (hr < 18) return 'Good afternoon';
  return 'مساء الخير';
}

function viewToday() {
  growWindow();
  const today = todayStr();
  const plan = planner.todayPlan(S, today);
  store.save();
  const d = planner.dayOf(S, today);
  const met = planner.minimumMet(S, today);
  const watered = planner.wateredDays(S, today);
  const review = [...plan.recent, ...plan.older, ...plan.extra];
  const allRated = review.length > 0 && review.every(p => d.reviewed[p]);
  const newDone = plan.newPages.every(p => d.learned.includes(p));
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const v = $('#view');
  v.innerHTML = '';
  v.append(h(`
    <section class="today">
      <div class="hello">
        <p class="date">${dateStr}</p>
        <h1>${greeting()}</h1>
        <p class="lead">${REASONS[plan.reason] || REASONS.normal}</p>
        ${plan.reason === 'gentle' && !plan.newPages.length ? `<button class="link" id="addNew">Add a new page anyway</button>` : ''}
      </div>

      <div class="card water ${met ? 'met' : ''}">
        <div class="can">${canSvg(met)}</div>
        <div>
          <strong>${met ? 'Your garden is watered today' : "Today's minimum"}</strong>
          <p>${met ? 'Anything more is a gift. Rest whenever you like.' : 'Just 1 page of review, or 10 minutes of listening.'}</p>
          <p class="soft">Watered ${watered} of the last 30 days · listened ${Math.round((d.listenedSec || 0) / 60)} min today</p>
        </div>
      </div>

      ${plan.newPages.length ? `
      <h2>New <span class="ar">حفظ جديد</span></h2>
      <div class="list" id="newList"></div>` : ''}

      ${plan.recent.length ? `
      <h2>Settling <span class="ar">مراجعة قريبة</span></h2>
      <p class="hint">Pages from this week. Recite each one, then tap how it felt.</p>
      <div class="list" id="recentList"></div>` : ''}

      ${plan.older.length + plan.extra.length ? `
      <h2>Revisit <span class="ar">مراجعة</span></h2>
      <div class="list" id="olderList"></div>` : ''}

      ${!review.length && !plan.newPages.length ? `<div class="card soft-card"><p>Nothing is scheduled today. You could wake a sleeping seed, or just read.</p></div>` : ''}

      ${allRated && newDone ? `<div class="card done"><strong>All done for today.</strong><p>بارك الله فيك. Rest well.</p></div>` : ''}

      <div class="row-btns">
        ${review.length ? `<button class="btn ghost" id="listenAll">${playIcon()} Listen to today's review</button>` : ''}
        <button class="btn ghost" id="wake">${seedIcon()} Wake a sleeping seed</button>
      </div>
      <p class="soft center">${countsLine()}</p>
    </section>`));

  const newList = $('#newList');
  plan.newPages.forEach(p => newList.append(newCard(p, d.learned.includes(p))));
  const rl = $('#recentList'); plan.recent.forEach(p => rl.append(reviewCard(p, d.reviewed[p])));
  const ol = $('#olderList'); [...plan.older, ...plan.extra].forEach(p => ol.append(reviewCard(p, d.reviewed[p])));

  $('#addNew')?.addEventListener('click', () => {
    plan.newPages = planner.nextNewPages(S, S.settings.newPerDay);
    if (plan.newPages.length) plan.reason = 'normal';
    store.save(); viewToday();
  });
  $('#listenAll')?.addEventListener('click', () => listenToPages(review));
  $('#wake').addEventListener('click', openWakeSheet);
}

function countsLine() {
  const c = planner.counts(S);
  return `${c.review + c.learning} pages growing · ${c.seed} sleeping seeds`;
}

function newCard(p, done) {
  const el = h(`
    <div class="pcard ${done ? 'is-done' : ''}">
      <div class="pc-main">
        <div class="pc-num">${ar(p)}</div>
        <div><div class="pc-title">${pageLabel(p)}</div><div class="pc-sub">Page ${p} · Juz ${juzOfPage(p)}</div></div>
      </div>
      <div class="pc-actions">
        <button class="btn" data-a="loop">${loopIcon()} Open &amp; loop</button>
        <button class="btn ${done ? 'ok' : 'ghost'}" data-a="learned">${done ? '✓ Memorized' : "I've memorized it"}</button>
      </div>
    </div>`);
  el.querySelector('[data-a=loop]').onclick = () => openMushafLoop(p, p);
  el.querySelector('[data-a=learned]').onclick = () => {
    if (done) return;
    planner.markLearned(S, p); store.save(); toast('A new seed is planted 🌱'); viewToday();
  };
  return el;
}

function reviewCard(p, rating) {
  const el = h(`
    <div class="pcard ${rating ? 'is-done' : ''}">
      <div class="pc-main">
        <div class="pc-num">${ar(p)}</div>
        <div><div class="pc-title">${S.pages[p]?.only ? S.pages[p].only.map(x => surah(x).ar).join('، ') : pageLabel(p)}</div><div class="pc-sub">Page ${p}${S.pages[p]?.only ? ' · only this surah' : ''}</div></div>
        <button class="icon-btn" data-a="open" aria-label="Open page ${p}">${bookIcon()}</button>
      </div>
      <div class="rate" role="group" aria-label="How did it feel?">
        ${['strong', 'okay', 'shaky'].map(r => `<button class="chip ${rating === r ? 'on' : ''}" data-r="${r}">${{ strong: 'Strong', okay: 'Okay', shaky: 'Shaky' }[r]}</button>`).join('')}
      </div>
    </div>`);
  el.querySelector('[data-a=open]').onclick = () => openMushafLoop(p, p, false);
  el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
    if (rating === b.dataset.r) planner.unrate(S, p); else planner.rate(S, p, b.dataset.r);
    store.save(); viewToday();
  });
  return el;
}

function openWakeSheet(only) {
  const seeds = Object.entries(S.pages).filter(([, i]) => i.status === 'seed').map(([p]) => +p)
    .filter(p => typeof only !== 'number' || pageRange(p).from[0] === only).sort((a, b) => a - b);
  if (!seeds.length) { toast('No sleeping seeds right now.'); return; }
  // group by surah of first verse
  const groups = new Map();
  for (const p of seeds) {
    const s = pageRange(p).from[0];
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(p);
  }
  const body = h(`<div><h3>Wake a sleeping seed</h3>
    <p class="hint">Pick one page. It joins your review from today. Listening to it a few times first helps it come back.</p>
    <div class="seed-groups"></div></div>`);
  const wrap = body.querySelector('.seed-groups');
  for (const [s, ps] of groups) {
    const g = h(`<details ${groups.size === 1 ? 'open' : ''}><summary>${surah(s).ar} <span class="soft">· ${ps.length} pages</span></summary><div class="seed-pages"></div></details>`);
    ps.forEach(p => {
      const b = h(`<button class="chip">${p}</button>`);
      b.title = pageLabel(p);
      b.onclick = () => { planner.wakeSeed(S, p); store.save(); closeSheet(); toast('Good morning, little seed 🌱'); route(); };
      g.querySelector('.seed-pages').append(b);
    });
    wrap.append(g);
  }
  openSheet(body);
}

function listenToPages(pages) {
  if (!pages.length) return;
  const sorted = [...pages].sort((a, b) => a - b);
  let verses = [];
  for (const p of sorted) {
    const only = S.pages[p]?.only;
    for (const v of versesForPages(p, p, false)) if (only && !only.includes(v[0])) continue; else if (!verses.length || cmpVerse(verses[verses.length - 1], v) < 0) verses.push(v);
  }
  playVerses(verses, { rangeRepeat: 1, ayahRepeat: 1, pages: sorted, follow: false, label: "Today's review" });
}

// ---------- Mushaf ----------
let loopSel = { from: null, to: null };
let selectedVerse = null;

function isDouble() {
  const sp = S.settings.spread;
  if (sp === 'single') return false;
  if (sp === 'double') return true;
  return innerWidth >= 900 && innerWidth > innerHeight * 1.05;
}

function spreadPages(p) {
  if (!isDouble()) return [p];
  const right = p % 2 === 1 ? p : p - 1; // odd pages sit on the right
  return [right, Math.min(604, right + 1)].filter(x => x >= 1);
}

function viewMushaf() {
  const v = $('#view');
  v.innerHTML = '';
  const surahOpts = META.surahs.map(s => `<option value="${s[4]}">${s[0]}. ${s[1]} · ${s[2]}</option>`).join('');
  v.append(h(`
    <section class="mushaf-view">
      <div class="mv-bar">
        <select id="surahSel" aria-label="Go to surah">${surahOpts}</select>
        <label class="pg"><span>Page</span><input id="pgInput" type="number" min="1" max="604" inputmode="numeric"></label>
        <button class="btn ghost" id="markBtn">${seedIcon()} Mark</button>
        <button class="btn" id="loopBtn">${loopIcon()} Loop</button>
      </div>
      <div class="book-wrap">
        <button class="turn left" id="turnNext" aria-label="Next page">‹</button>
        <div class="book" id="book"></div>
        <button class="turn right" id="turnPrev" aria-label="Previous page">›</button>
      </div>
      <p class="soft center">Tap an ayah for its meaning, or to play and loop from it.</p>
    </section>`));
  $('#surahSel').onchange = (e) => goPage(+e.target.value);
  $('#pgInput').onchange = (e) => goPage(clampPage(+e.target.value));
  $('#loopBtn').onclick = () => openLoopSheet();
  $('#markBtn').onclick = () => openMarkSheet(spreadPages(mushafPage));
  $('#turnNext').onclick = () => turn(1);
  $('#turnPrev').onclick = () => turn(-1);
  // swipe: in an Arabic mushaf the next page is on the left, so swipe right to go forward
  const book = $('#book');
  let sx = null, sy = null;
  book.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  book.addEventListener('touchend', e => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) turn(dx > 0 ? 1 : -1);
    sx = null;
  });
  drawSpread();
}

window.addEventListener('keydown', (e) => {
  if (currentView !== 'mushaf' || e.target.closest('input,select,textarea') || !$('#sheet').hidden) return;
  if (e.key === 'ArrowLeft') turn(1);
  if (e.key === 'ArrowRight') turn(-1);
  if (e.key === ' ' && player.session) { e.preventDefault(); player.toggle(); }
});
let lastDouble = null;
window.addEventListener('resize', () => { if (currentView === 'mushaf' && isDouble() !== lastDouble) drawSpread(); });

function turn(d) {
  const step = isDouble() ? 2 : 1;
  goPage(clampPage(spreadPages(mushafPage)[0] + d * step));
}

function goPage(p) {
  if (spreadPages(p).join() === spreadPages(mushafPage).join() && $('#book')?.children.length) { mushafPage = p; return; }
  mushafPage = p;
  S.lastPage = p; store.save();
  if (location.hash !== `#/mushaf/${p}`) history.replaceState(null, '', `#/mushaf/${p}`);
  drawSpread();
}

async function drawSpread() {
  const book = $('#book'); if (!book) return;
  lastDouble = isDouble();
  const ps = spreadPages(mushafPage);
  book.classList.toggle('double', ps.length > 1);
  book.innerHTML = '';
  $('#pgInput').value = mushafPage;
  const s = pageRange(ps[0]).from[0];
  const sel = $('#surahSel');
  sel.value = String(surah(s).start);
  if (sel.value !== String(surah(s).start)) sel.selectedIndex = s - 1;
  const els = ps.map(p => { const el = document.createElement('article'); book.appendChild(el); return [p, el]; });
  // Right page first in reading order (RTL): CSS uses row-reverse for the spread.
  await Promise.all(els.map(([p, el]) => renderPage(el, p, { onVerse: (k) => openAyahSheet(k) })));
  refreshHighlights();
  // warm the cache for the next pages
  [ps[ps.length - 1] + 1, ps[ps.length - 1] + 2].filter(x => x <= 604).forEach(x => loadPage(x).catch(() => {}));
}

function refreshHighlights() {
  const book = $('#book'); if (!book) return;
  const ss = player.session;
  highlight(book, ss ? ss.verses.map(vkey) : null, 'in-range');
  highlight(book, ss ? vkey(ss.verses[ss.i]) : null, 'now');
  highlight(book, selectedVerse, 'sel');
}

function pageOfVerse(v) {
  let lo = 0, hi = 603;
  while (lo < hi) { // first page whose last verse >= v
    const mid = (lo + hi) >> 1;
    const r = META.pages[mid];
    if (cmpVerse([r[2], r[3]], v) < 0) lo = mid + 1; else hi = mid;
  }
  return lo + 1;
}

function openMushafLoop(p1, p2, autoplay = true) {
  location.hash = `#/mushaf/${p1}`;
  if (autoplay) {
    setTimeout(() => startLoop(p1, p2), 50);
  }
}

function startLoop(p1, p2, overrides = {}) {
  const st = S.settings;
  const verses = versesForPages(Math.min(p1, p2), Math.max(p1, p2), overrides.bridge ?? st.bridgeAyahs);
  const pages = []; for (let p = Math.min(p1, p2); p <= Math.max(p1, p2); p++) pages.push(p);
  playVerses(verses, { pages, label: p1 === p2 ? `Page ${p1}` : `Pages ${p1}–${p2}`, ...overrides });
}

function playVerses(verses, o = {}) {
  const st = S.settings;
  let listened = 0;
  const flush = () => { if (listened) { planner.addListening(S, listened, o.pages || []); listened = 0; store.save(); } };
  player.play({
    verses,
    reciter: o.reciter || st.reciter,
    ayahRepeat: o.ayahRepeat ?? st.ayahRepeat,
    rangeRepeat: o.rangeRepeat ?? st.rangeRepeat,
    speed: st.speed,
    onAyah: (v) => {
      updateBar(v, o.label);
      if (currentView === 'mushaf' && o.follow !== false) {
        const p = pageOfVerse(v);
        if (!spreadPages(mushafPage).includes(p)) goPage(p);
      }
      refreshHighlights();
    },
    onTick: (sec) => { listened += sec; if (listened >= 15) flush(); },
    onEnd: () => { flush(); toast('Loop finished. ما شاء الله'); refreshHighlights(); if (currentView === 'today') viewToday(); },
    onError: (msg) => toast(msg, 5000),
    onState: (playing) => { if (!playing) flush(); },
  });
}

// ---------- player bar ----------
function setupPlayerBar() {
  const bar = $('#playerbar');
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'toggle') player.toggle();
    if (a === 'next') player.skip(1);
    if (a === 'prev') player.skip(-1);
    if (a === 'stop') player.stop();
    if (a === 'pop') openPopout();
  });
  if (!canPopOut()) $('[data-act=pop]').hidden = true;
  player.onState((playing, ss) => {
    bar.hidden = !ss;
    document.body.classList.toggle('has-player', !!ss);
    $('#pbToggle').innerHTML = playing ? '<svg viewBox="0 0 24 24"><rect x="7" y="6" width="3.5" height="12" rx="1"/><rect x="13.5" y="6" width="3.5" height="12" rx="1"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>';
    if (!ss) { refreshHighlights(); closePopout(); }
    else refreshPopout($('#pbTitle').textContent, $('#pbSub').textContent, playing);
  });
}
function updateBar(v, label) {
  const ss = player.session; if (!ss) return;
  $('#pbTitle').textContent = `${surah(v[0]).ar}، الآية ${ar(v[1])}`;
  const rep = ss.ayahRepeat > 1 ? ` · ayah ×${ss.ayahRepeat}` : '';
  const round = ss.rangeRepeat === 0 ? ` · round ${ss.round + 1}` : ss.rangeRepeat > 1 ? ` · round ${ss.round + 1} of ${ss.rangeRepeat}` : '';
  $('#pbSub').textContent = `${label || ''}${round}${rep} · ${ss.rec.en}`;
  refreshPopout($('#pbTitle').textContent, $('#pbSub').textContent, player.playing);
  // the phone's notification and lock screen show the ayah too
  try { if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({ title: $('#pbTitle').textContent, artist: ss.rec.name, album: 'Bustan', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] }); } catch (e) { /* fine */ }
}
async function openPopout() {
  try {
    await popOut({ toggle: () => player.toggle(), next: () => player.skip(1), prev: () => player.skip(-1), stop: () => player.stop() });
    refreshPopout($('#pbTitle').textContent, $('#pbSub').textContent, player.playing);
  } catch (e) {
    toast("This browser can't float the player. The pause and skip buttons are in your notifications and lock screen instead.", 5000);
  }
}

// ---------- sheets ----------
function openSheet(content) {
  const sh = $('#sheet');
  sh.innerHTML = '<div class="grab"></div>';
  const close = h('<button class="icon-btn close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>');
  close.onclick = closeSheet;
  sh.append(close, content);
  sh.hidden = false; $('#backdrop').hidden = false;
  requestAnimationFrame(() => sh.classList.add('open'));
}
function closeSheet() {
  const sh = $('#sheet'); if (sh.hidden) return;
  sh.classList.remove('open'); sh.hidden = true; $('#backdrop').hidden = true;
  if (selectedVerse) { selectedVerse = null; refreshHighlights(); }
}
$('#backdrop').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

function openAyahSheet(key) {
  const [s, a] = key.split(':').map(Number);
  selectedVerse = key; refreshHighlights();
  const p = pageOfVerse([s, a]);
  const body = h(`<div>
    <h3><span class="ar-title">${surah(s).ar}، الآية ${ar(a)}</span> <span class="soft small">· page ${p}</span></h3>
    <div class="grid-btns">
      <button class="btn" data-a="play">${playIcon()} Play from here</button>
      <button class="btn ghost" data-a="ayah">${loopIcon()} Loop this ayah</button>
      <button class="btn ghost" data-a="from">Start a loop here</button>
      <button class="btn ghost" data-a="to">End the loop here</button>
    </div>
    <div class="tafsir"><div class="t-head">تفسير السعدي</div><div class="t-body" dir="rtl">…</div></div>
  </div>`);
  body.querySelector('[data-a=play]').onclick = () => {
    closeSheet();
    const verses = []; let v = [s, a];
    for (let i = 0; v && i < 400; i++) { verses.push(v); v = nextV(v); }
    playVerses(verses, { rangeRepeat: 1, ayahRepeat: 1, label: 'Reading' });
  };
  body.querySelector('[data-a=ayah]').onclick = () => { closeSheet(); playVerses([[s, a]], { rangeRepeat: 0, ayahRepeat: 1, label: 'One ayah' }); };
  body.querySelector('[data-a=from]').onclick = () => { loopSel.from = [s, a]; closeSheet(); openLoopSheet(); };
  body.querySelector('[data-a=to]').onclick = () => { loopSel.to = [s, a]; closeSheet(); openLoopSheet(); };
  openSheet(body);
  const tb = body.querySelector('.t-body');
  loadTafsir(s, a, tb);
}
function nextV([s, a]) { return a < surah(s).verses ? [s, a + 1] : s < 114 ? [s + 1, 1] : null; }

async function loadTafsir(s, a, el) {
  try {
    let t = await tafsir(s, a), back = a;
    // As-Sa'di sometimes explains a few ayahs together, under the first of them.
    while (!t.trim() && back > 1 && a - back < 12) { back--; t = await tafsir(s, back); }
    el.innerHTML = '';
    if (back !== a) el.append(h(`<p class="soft">Explained together with ayah ${ar(back)}:</p>`));
    t.split(/\n+/).filter(Boolean).forEach(par => { const pEl = document.createElement('p'); pEl.textContent = par; el.append(pEl); });
  } catch (e) {
    el.innerHTML = '<p class="soft">The tafsir could not load. Check your connection and try again.</p>';
  }
}

function openLoopSheet() {
  const st = S.settings;
  const ps = spreadPages(mushafPage);
  const custom = loopSel.from || loopSel.to;
  const reciterOpts = Object.entries(RECITERS).map(([id, r]) => `<option value="${id}" ${id === st.reciter ? 'selected' : ''}>${r.en} · ${r.name}</option>`).join('');
  const sel = (name, vals, cur, fmt = x => x) => `<select name="${name}">${vals.map(x => `<option value="${x}" ${x == cur ? 'selected' : ''}>${fmt(x)}</option>`).join('')}</select>`;
  const body = h(`<form class="loop-form" onsubmit="return false">
    <h3>Loop a range</h3>
    ${custom ? `<p class="hint">From <b>${loopSel.from ? `${surah(loopSel.from[0]).ar} ${ar(loopSel.from[1])}` : '…'}</b> to <b>${loopSel.to ? `${surah(loopSel.to[0]).ar} ${ar(loopSel.to[1])}` : '…'}</b>. <button type="button" class="link" data-a="clear">Use pages instead</button></p>` : `
    <div class="two">
      <label>From page <input name="from" type="number" min="1" max="604" value="${ps[0]}"></label>
      <label>To page <input name="to" type="number" min="1" max="604" value="${ps[ps.length - 1]}"></label>
    </div>
    <label class="check"><input type="checkbox" name="bridge" ${st.bridgeAyahs ? 'checked' : ''}> Add one ayah before and one after, to keep pages connected</label>`}
    <div class="two">
      <label>Repeat each ayah ${sel('ayahRepeat', [1, 2, 3, 5, 7, 10], st.ayahRepeat, x => x + '×')}</label>
      <label>Repeat the range ${sel('rangeRepeat', [1, 2, 3, 5, 10, 0], st.rangeRepeat, x => x == 0 ? 'Forever' : x + '×')}</label>
    </div>
    <div class="two">
      <label>Reciter <select name="reciter">${reciterOpts}</select></label>
      <label>Speed ${sel('speed', [0.75, 0.9, 1, 1.15, 1.25], st.speed, x => x + '×')}</label>
    </div>
    <button class="btn wide" data-a="go" type="button">${playIcon()} Start the loop</button>
  </form>`);
  body.querySelector('[data-a=clear]')?.addEventListener('click', () => { loopSel = { from: null, to: null }; closeSheet(); openLoopSheet(); });
  body.querySelector('[data-a=go]').onclick = () => {
    const f = new FormData(body);
    st.ayahRepeat = +f.get('ayahRepeat'); st.rangeRepeat = +f.get('rangeRepeat');
    st.reciter = f.get('reciter'); st.speed = +f.get('speed');
    if (!custom) st.bridgeAyahs = !!f.get('bridge');
    store.save();
    closeSheet();
    if (custom) {
      let a = loopSel.from || loopSel.to, b = loopSel.to || loopSel.from;
      if (cmpVerse(a, b) > 0) [a, b] = [b, a];
      const verses = []; for (let v = a; v && cmpVerse(v, b) <= 0; v = nextV(v)) verses.push(v);
      loopSel = { from: null, to: null };
      playVerses(verses, { label: 'Your range', pages: [...new Set(verses.map(pageOfVerse))] });
    } else {
      const from = clampPage(+f.get('from')), to = clampPage(+f.get('to'));
      startLoop(from, to);
    }
  };
  openSheet(body);
}

// ---------- Settings ----------
const DAYS = [['Sat', 6], ['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5]];

function viewSettings() {
  const st = S.settings;
  const v = $('#view');
  v.innerHTML = '';
  const radio = (name, vals, cur, fmt) => `<div class="seg">${vals.map(x => `<label><input type="radio" name="${name}" value="${x}" ${x == cur ? 'checked' : ''}><span>${fmt ? fmt(x) : x}</span></label>`).join('')}</div>`;
  const surahOpts = META.surahs.map(s => `<option value="${s[0]}">${s[0]}. ${s[1]} · ${s[2]}</option>`).join('');
  v.append(h(`<section class="settings">
    <h1>Settings</h1>
    <div class="card">
      <h3>Daily time</h3>
      ${radio('minutes', [15, 20, 30], st.minutes, x => x + ' min')}
      <h3>New pages</h3>
      ${radio('newPerDay', [1, 2], st.newPerDay, x => x + (x == 1 ? ' page' : ' pages') + ' a day')}
      <p class="hint">Days for new pages. The other days are review only.</p>
      <div class="seg days">${DAYS.map(([n, i]) => `<label><input type="checkbox" name="day" value="${i}" ${st.newDays.includes(i) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
      <label class="line">Next new page <input type="number" name="nextNewPage" min="1" max="604" value="${st.nextNewPage}"> <span class="soft" id="nextLbl">${pageLabel(st.nextNewPage)}</span></label>
    </div>

    <div class="card">
      <h3>Recitation</h3>
      <label class="line">Reciter <select name="reciter">${Object.entries(RECITERS).map(([id, r]) => `<option value="${id}" ${id === st.reciter ? 'selected' : ''}>${r.en} · ${r.name}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" name="bridgeAyahs" ${st.bridgeAyahs ? 'checked' : ''}> Loops start one ayah before and end one ayah after the pages</label>
    </div>

    <div class="card">
      <h3>Look &amp; feel</h3>
      <p class="hint">Colors</p>
      ${radio('palette', ['cozy', 'pink'], st.palette, x => ({ cozy: 'Cocoa & linen', pink: 'Pink' }[x]))}
      <p class="hint">Day or night. Following the time switches at 6 am and 6 pm.</p>
      ${radio('light', ['auto', 'day', 'night'], st.light, x => ({ auto: 'Follow the time', day: 'Always day', night: 'Always night' }[x]))}
      <p class="hint">Pages</p>
      ${radio('spread', ['auto', 'single', 'double'], st.spread, x => ({ auto: 'Auto pages', single: 'One page', double: 'Two pages' }[x]))}
      <label class="check"><input type="checkbox" name="fire" ${st.fire ? 'checked' : ''}> Crackling fire sound</label>
    </div>

    <div class="card">
      <h3>My pages</h3>
      <p class="hint">${countsLine()}. Mark pages as memorized (they join review), sleeping seeds, or not memorized.</p>
      <label class="line">Surah <select id="msSurah"><option value="">Choose a surah…</option>${META.surahs.map(x => `<option value="${x[0]}">${x[0]}. ${x[1]} · ${x[2]}</option>`).join('')}</select></label>
      <div class="two">
        <label>From page <input id="msFrom" type="number" min="1" max="604" value="1"></label>
        <label>To page <input id="msTo" type="number" min="1" max="604" value="1"></label>
      </div>
      <div class="two">
        <label>Mark as <select id="msStatus"><option value="review">Memorized</option><option value="seed">Sleeping seed</option><option value="none">Not memorized</option></select></label>
        <button class="btn" id="msApply" type="button">Apply</button>
      </div>
    </div>

    <div class="card">
      <h3>Backup</h3>
      <p class="hint">Your progress is saved in this browser. Syncing between your phone and laptop comes in a later step. Until then you can save a backup file.</p>
      <div class="row-btns">
        <button class="btn ghost" id="exp" type="button">Save a backup</button>
        <label class="btn ghost file">Restore a backup<input type="file" id="imp" accept="application/json" hidden></label>
      </div>
    </div>
    <p class="soft center small">Bustan · Madinah mushaf, QPC fonts (King Fahd Complex) · Tafsir As-Sa'di · Recitations from mp3quran.net and everyayah.com</p>
  </section>`));

  v.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => {
    st[r.name] = isNaN(+r.value) ? r.value : +r.value;
    afterSettings(r.name);
  });
  v.querySelectorAll('input[name=day]').forEach(c => c.onchange = () => {
    st.newDays = [...v.querySelectorAll('input[name=day]:checked')].map(x => +x.value);
    afterSettings('newDays');
  });
  v.querySelector('[name=nextNewPage]').onchange = (e) => {
    st.nextNewPage = clampPage(+e.target.value); $('#nextLbl').textContent = pageLabel(st.nextNewPage); afterSettings('nextNewPage');
  };
  v.querySelector('[name=reciter]').onchange = (e) => { st.reciter = e.target.value; afterSettings('reciter'); };
  v.querySelector('[name=bridgeAyahs]').onchange = (e) => { st.bridgeAyahs = e.target.checked; afterSettings(); };
  v.querySelector('[name=fire]').onchange = (e) => { st.fire = e.target.checked; fireSound(st.fire); afterSettings(); };
  $('#msSurah').onchange = (e) => { if (!e.target.value) return; const s = surah(+e.target.value); $('#msFrom').value = s.start; $('#msTo').value = s.end; };
  $('#msApply').onclick = () => {
    const a = clampPage(+$('#msFrom').value), b = clampPage(+$('#msTo').value);
    const status = $('#msStatus').value;
    // a whole surah picked: only that surah counts on pages it shares with its neighbours
    const sid = +$('#msSurah').value || null;
    const only = sid && surah(sid).start === Math.min(a, b) && surah(sid).end === Math.max(a, b) ? sid : null;
    planner.setStatus(S, Math.min(a, b), Math.max(a, b), status, todayStr(), only, pageSurahs);
    planner.todayPlan(S, todayStr(), true);
    store.save();
    toast(only ? `${surah(only).en} updated` : `Pages ${Math.min(a, b)}–${Math.max(a, b)} updated`);
    viewSettings();
  };
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bustan-backup-${todayStr()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#imp').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.pages || !data.settings) throw new Error();
      store.replaceAll(data); S = store.get(); toast('Backup restored'); viewSettings();
    } catch (err) { toast("That file doesn't look like a Bustan backup."); }
  };
}

function afterSettings(name) {
  if (name === 'palette' || name === 'light') applyTheme(S.settings);
  if (['minutes', 'newPerDay', 'newDays', 'nextNewPage'].includes(name)) planner.todayPlan(S, todayStr(), true);
  store.save();
  if (name) toast('Saved', 1200);
}

// first tap anywhere resumes the fire sound if it's on (browsers need a tap before sound)
document.addEventListener('pointerdown', () => { if (S?.settings.fire) fireSound(true); }, { once: true });

// ---------- bits ----------
let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function playIcon() { return '<svg class="i" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>'; }
function loopIcon() { return '<svg class="i" viewBox="0 0 24 24"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>'; }
function bookIcon() { return '<svg viewBox="0 0 24 24"><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1Z"/><path d="M12 6v14"/></svg>'; }
function seedIcon() { return '<svg class="i" viewBox="0 0 24 24"><path d="M12 20v-7M12 13c0-4 3-6 7-6 0 4-3 6-7 6ZM12 15c0-3-2-5-6-5 0 3 2 5 6 5Z"/></svg>'; }
function canSvg(full) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 26h30v22a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6Z" class="can-body"/>
  <path d="M14 ${full ? 30 : 44}h30v4a6 6 0 0 1 0 0v10a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6Z" class="can-water"/>
  <path d="M44 32l12-10M44 40l14-12" class="can-spout"/><path d="M20 26c0-8 18-8 18 0" class="can-handle"/>
  ${full ? '<circle cx="58" cy="30" r="1.6" class="drop"/><circle cx="60" cy="36" r="1.3" class="drop"/>' : ''}</svg>`;
}
