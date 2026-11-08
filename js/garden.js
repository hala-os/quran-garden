// The memorization garden: one plant per memorized page, a bed per surah.
// Plants grow with each page's strength, droop a little when they're thirsty, and never die.
import { todayStr, daysBetween } from './store.js';
import { META, surah, pageLabel, juzOfPage, ar } from './data.js';

const PETALS = ['#f3a6b5', '#f7c59f', '#c9b3e6', '#f4dc7e', '#f9d4dc', '#f19c8c', '#b9d4ee', '#e9b8d8'];
const STAGES = {
  seed: { name: 'Sleeping seed', ar: 'بذرة نائمة' },
  sprout: { name: 'Just planted', ar: 'غرسة' },
  young: { name: 'Growing', ar: 'تنمو' },
  bud: { name: 'Budding', ar: 'برعم' },
  bloom: { name: 'Blooming', ar: 'زهرة' },
  full: { name: 'In full bloom', ar: 'تزهر' },
};
const ORDER = ['sprout', 'young', 'bud', 'bloom', 'full'];

export const growing = (i) => i && (i.status === 'learning' || i.status === 'review');

// How grown and how thirsty a page's plant is today.
export function plantOf(info, today = todayStr()) {
  if (!info) return null;
  if (info.status === 'seed') return { stage: 'seed', thirst: 0 };
  if (!growing(info)) return null;
  let stage, thirst = 0;
  if (info.status === 'learning') {
    stage = daysBetween(info.learnedOn || today, today) < 2 ? 'sprout' : 'young';
    if (info.last && daysBetween(info.last, today) > 3) thirst = Math.min(.6, (daysBetween(info.last, today) - 3) / 6);
  } else {
    const iv = info.interval || 1;
    let k = iv < 5 ? 1 : iv < 14 ? 2 : iv < 45 ? 3 : 4;
    if ((info.ratings || []).slice(-1)[0] === 'shaky') k = Math.max(1, k - 1);
    stage = ORDER[k];
    if (info.due && info.due < today) thirst = Math.min(1, daysBetween(info.due, today) / (iv * .6 + 4));
  }
  const fresh = info.last === today;
  if (fresh || info.watered === today) thirst = 0;
  return { stage, thirst, fresh, rained: info.watered === today };
}

// A little hand-drawn plant as SVG. Base of the stem sits at (20, 56).
export function plantSvg(stage, thirst = 0, hue = 0, seedNo = 0) {
  const petal = PETALS[hue % PETALS.length];
  const bend = (thirst * 26).toFixed(1);
  const sway = `style="--d:${(seedNo % 7) * -.45}s"`;
  if (stage === 'seed') {
    return `<svg class="plant-svg" viewBox="0 0 40 60" aria-hidden="true">
      <ellipse cx="20" cy="56" rx="11" ry="3.2" class="p-soil"/>
      <ellipse cx="20" cy="51.5" rx="3.2" ry="4.4" transform="rotate(-25 20 51.5)" class="p-seed"/>
      <path d="M19 48.5 q1.5 1.6 1 3.4" class="p-seed-line"/></svg>`;
  }
  const H = { sprout: 13, young: 24, bud: 31, bloom: 36, full: 38 }[stage];
  const top = 56 - H;
  const leaf = (y, side, s = 1) => {
    const x = 20 + side * 1;
    const d = side < 0
      ? `M${x} ${y} q${-7 * s} ${-1 * s} ${-9 * s} ${-6 * s} q${6 * s} ${-1 * s} ${9 * s} ${6 * s}z`
      : `M${x} ${y} q${7 * s} ${-1 * s} ${9 * s} ${-6 * s} q${-6 * s} ${-1 * s} ${-9 * s} ${6 * s}z`;
    return `<path d="${d}" class="p-leaf"/>`;
  };
  let parts = `<path d="M20 56 Q${20 + (stage === 'sprout' ? 0 : 2)} ${56 - H / 2} 20 ${top}" class="p-stem"/>`;
  if (stage === 'sprout') {
    parts += `<path d="M20 ${top + 1} q-7 -1 -8 -6 q6 0 8 6z" class="p-leaf"/><path d="M20 ${top + 1} q7 -1 8 -6 q-6 0 -8 6z" class="p-leaf"/>`;
  } else {
    parts += leaf(50, -1, .9) + leaf(44, 1, 1);
    if (stage !== 'young') parts += leaf(38, -1, .85);
    if (stage === 'young') parts += `<path d="M20 ${top + 1} q-5 -1 -6 -5 q4 0 6 5z" class="p-leaf"/><path d="M20 ${top + 1} q5 -1 6 -5 q-4 0 -6 5z" class="p-leaf"/>`;
  }
  if (stage === 'bud') {
    parts += `<path d="M20 ${top + 1} q-4 -4 0 -9 q4 5 0 9z" fill="${petal}" class="p-bud"/><path d="M20 ${top + 1} q-3 -1 -4 -4 M20 ${top + 1} q3 -1 4 -4" class="p-sepal"/>`;
  }
  const flower = (cx, cy, r) => {
    let f = '';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      f += `<circle cx="${(cx + Math.cos(a) * r).toFixed(2)}" cy="${(cy + Math.sin(a) * r).toFixed(2)}" r="${(r * .92).toFixed(2)}" fill="${petal}"/>`;
    }
    return `<g class="p-flower">${f}<circle cx="${cx}" cy="${cy}" r="${(r * .72).toFixed(2)}" class="p-heart"/></g>`;
  };
  if (stage === 'bloom') parts += flower(20, top - 2, 3.6);
  if (stage === 'full') {
    parts += `<path d="M20 40 q6 -3 8 -10" class="p-stem"/>` + flower(28.5, 28.5, 2.6) + flower(20, top - 3, 4.1);
  }
  return `<svg class="plant-svg" viewBox="0 0 40 60" aria-hidden="true">
    <ellipse cx="20" cy="56" rx="11" ry="3.2" class="p-soil"/>
    <g class="p-sway" ${sway}><g transform="rotate(${-bend} 20 56)">${parts}</g></g></svg>`;
}

function lanternSvg() {
  return `<svg class="lantern" viewBox="0 0 24 34" aria-hidden="true">
    <path d="M12 1v4" class="ln-wire"/><path d="M8 5h8l-1 3H9z" class="ln-cap"/>
    <path d="M7.5 8h9q2 9 0 18h-9q-2-9 0-18z" class="ln-body"/>
    <ellipse cx="12" cy="17" rx="3.2" ry="5.5" class="ln-glow"/>
    <path d="M8 26h8l-1 3H9z" class="ln-cap"/></svg>`;
}

function treeSvg(n) {
  return `<svg class="tree" viewBox="0 0 60 70" aria-hidden="true">
    <ellipse cx="30" cy="66" rx="20" ry="3.5" class="p-soil"/>
    <path d="M28 66 q1 -14 -1 -24 h6 q-2 10 -1 24z" class="tr-trunk"/>
    <circle cx="30" cy="28" r="17" class="tr-crown"/><circle cx="17" cy="36" r="10" class="tr-crown"/><circle cx="43" cy="36" r="10" class="tr-crown"/>
    <circle cx="22" cy="24" r="2.2" class="tr-fruit"/><circle cx="37" cy="21" r="2.2" class="tr-fruit"/><circle cx="40" cy="38" r="2.2" class="tr-fruit"/><circle cx="20" cy="39" r="2.2" class="tr-fruit"/>
    <text x="30" y="33" class="tr-num">${ar(n)}</text></svg>`;
}

function packetSvg(hue) {
  const c = PETALS[hue % PETALS.length];
  return `<svg class="packet-svg" viewBox="0 0 44 56" aria-hidden="true">
    <path d="M4 6h36v46H4z" class="pk-paper"/><path d="M4 6l4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3 4 -3 4 3" class="pk-zig"/>
    <rect x="9" y="12" width="26" height="24" rx="3" class="pk-window"/>
    <path d="M22 34 v-10" class="p-stem"/><path d="M22 30 q-5 0 -6 -4 q4 0 6 4z M22 28 q5 0 6 -4 q-4 0 -6 4z" class="p-leaf"/>
    ${[0, 1, 2, 3, 4].map(i => { const a = i / 5 * Math.PI * 2 - Math.PI / 2; return `<circle cx="${(22 + Math.cos(a) * 3.3).toFixed(1)}" cy="${(20 + Math.sin(a) * 3.3).toFixed(1)}" r="3" fill="${c}"/>`; }).join('')}
    <circle cx="22" cy="20" r="2.2" class="p-heart"/>
    <path d="M10 42h24M10 46h16" class="pk-lines"/></svg>`;
}

// ---------- the Garden view ----------
export function viewGarden(v, ctx) {
  const { S, h, openSheet, closeSheet, toast, openMushafLoop, openWakeSheet, store, planner } = ctx;
  const today = todayStr();
  const pages = S.pages;
  const plants = {};
  for (let p = 1; p <= 604; p++) plants[p] = plantOf(pages[p], today);
  // a page memorized for only some of its surahs grows only in those surahs' beds
  const plantIn = (p, sid) => { const pl = plants[p]; return pl && pl.stage !== 'seed' && pages[p].only && !pages[p].only.includes(sid) ? null : pl; };

  // which surahs have a bed
  const next = S.settings.nextNewPage;
  const beds = [], packets = [];
  for (const s of META.surahs) {
    const [id, , , , sp, ep] = s;
    let grow = 0, own = 0, seeds = 0;
    for (let p = sp; p <= ep; p++) {
      const pl = plantIn(p, id);
      if (pl?.stage === 'seed') seeds++;
      else if (pl) { grow++; if (primarySurah(p) === id || pages[p].only) own++; }
    }
    // A page shared by two surahs only opens a bed for the surah it mostly belongs to.
    const nextHere = primarySurah(next) === id;
    // (short surahs that share one page with others still get a bed once their whole page is memorized)
    if (own || nextHere || grow === ep - sp + 1) beds.push({ id, sp, ep, grow, n: ep - sp + 1 });
    else if (seeds) packets.push({ id, seeds });
  }

  let bloom = 0, grow = 0, thirsty = 0, fresh = 0;
  for (let p = 1; p <= 604; p++) {
    const pl = plants[p]; if (!pl || pl.stage === 'seed') continue;
    if (pl.stage === 'bloom' || pl.stage === 'full') bloom++; else grow++;
    if (pl.thirst > .15) thirsty++;
    if (pl.fresh || pl.rained) fresh++;
  }
  // juz trees
  const juzPages = {};
  for (let p = 1; p <= 604; p++) (juzPages[juzOfPage(p)] ||= []).push(p);
  const trees = Object.entries(juzPages).filter(([, ps]) => ps.every(p => growing(pages[p]))).map(([j]) => +j);

  const lead = !bloom && !grow
    ? 'Your garden is waiting for its first plant. Memorize a page on Today and it appears here.'
    : thirsty
      ? `${thirsty === 1 ? 'One plant is' : `${thirsty} plants are`} a little thirsty. A review or a listen perks ${thirsty === 1 ? 'it' : 'them'} right up.`
      : fresh ? 'Everything you watered today is standing tall. ما شاء الله' : 'Everything is green and happy.';

  v.innerHTML = '';
  const root = h(`
    <section class="today garden">
      <div class="hello">
        <p class="date">بستاني</p>
        <h1>Your garden</h1>
        <p class="lead">${lead}</p>
      </div>
      <div class="g-stats">
        <span class="g-stat"><b>${bloom}</b> blooming</span>
        <span class="g-stat"><b>${grow}</b> growing</span>
        ${thirsty ? `<span class="g-stat thirsty"><b>${thirsty}</b> thirsty</span>` : ''}
        <span class="g-stat"><b>${Object.values(plants).filter(p => p?.stage === 'seed').length}</b> seeds</span>
      </div>
      <div class="scene-wrap" id="gscene"></div>
      <details class="card listview">
        <summary>See your beds as a list</summary>
        <div id="beds" class="beds"></div>
      </details>
      <details class="card how">
        <summary>How the garden grows</summary>
        <div class="how-grid">
          ${['sprout', 'young', 'bud', 'bloom', 'full'].map((st, i) => `<div>${plantSvg(st, 0, 0, i)}<span>${STAGES[st].name}</span></div>`).join('')}
        </div>
        <p>A new page starts as a little sprout. Each time you review it and it feels strong, it waits longer before its next visit and grows a stage. A shaky review keeps it smaller for a while, which is completely fine.</p>
        <p>When a page is past its visit day it droops a bit, but it never dies. One review or one listen and it stands back up. Finish a surah and a lantern lights up over its bed. Finish a juz and a tree grows in the grove.</p>
      </details>
    </section>`);
  v.append(root);

  const bedsEl = root.querySelector('#beds');
  for (const b of beds) {
    const done = b.grow === b.n;
    const bed = h(`
      <div class="card bed ${done ? 'done' : ''} ${b.n <= 3 ? 'mini' : ''}">
        <div class="bed-head">
          <div><div class="bed-name">${surah(b.id).ar}</div><div class="bed-sub">${surah(b.id).en}</div><div class="bed-sub">${done ? (b.n === 1 ? 'Memorized' : `All ${b.n} pages`) : `${b.grow} of ${b.n} pages`}</div></div>
          ${done ? lanternSvg() : `<div class="bed-bar"><i style="width:${(b.grow / b.n * 100).toFixed(1)}%"></i></div>`}
        </div>
        <div class="plot"></div>
      </div>`);
    const plot = bed.querySelector('.plot');
    for (let p = b.sp; p <= b.ep; p++) {
      const pl = plantIn(p, b.id);
      const cls = !pl ? 'empty' : pl.stage === 'seed' ? 'seed' : `${pl.stage}${pl.thirst > .15 ? ' thirsty' : ''}${pl.fresh ? ' fresh' : ''}${pl.rained ? ' rained' : ''}`;
      const label = !pl ? `Page ${p}, not planted yet${p === next ? ', next to plant' : ''}` : `Page ${p}, ${STAGES[pl.stage].name.toLowerCase()}${pl.thirst > .15 ? ', thirsty' : ''}`;
      const cell = h(`<button class="plant ${cls} ${p === next && !pl ? 'next' : ''}" data-p="${p}" aria-label="${label}">
        ${pl ? plantSvg(pl.stage, pl.thirst, b.id, p) : `<svg class="plant-svg" viewBox="0 0 40 60" aria-hidden="true"><ellipse cx="20" cy="56" rx="11" ry="3.2" class="p-soil empty-soil"/>${p === next ? '<path d="M20 52 v-5 M17.5 49.5 h5" class="p-next"/>' : ''}</svg>`}
        ${pl?.rained ? '<i class="drops"><b></b><b></b><b></b></i>' : ''}
        ${pl?.fresh ? '<i class="spark">✦</i>' : ''}
        <span class="p-num">${ar(p)}</span></button>`);
      plot.append(cell);
    }
    bedsEl.append(bed);
  }
  if (!beds.length) bedsEl.append(h(`<div class="card soft-card"><p>No beds yet. Your first page will make one.</p></div>`));

  // the illustrated garden, redrawn when the screen width changes a lot
  const wrap = root.querySelector('#gscene');
  const night = /night/.test(document.documentElement.dataset.mode || '');
  let drawnW = 0;
  const draw = () => {
    const cw = wrap.clientWidth; if (!cw || Math.abs(cw - drawnW) < 40) return;
    drawnW = cw;
    wrap.innerHTML = gardenScene({ beds, plants, plantIn, next, trees, packets, width: cw < 600 ? cw * 1.12 : cw, night });
  };
  draw();
  const ro = new ResizeObserver(() => { if (!wrap.isConnected) return ro.disconnect(); draw(); });
  ro.observe(wrap);
  wrap.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-p],[data-s]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });

  root.addEventListener('click', (e) => {
    const sp = e.target.closest('.sc-packet');
    if (sp) { openWakeSheet(+sp.dataset.s); return; }
    const pk = e.target.closest('.packet');
    if (pk) { openWakeSheet(+pk.dataset.s); return; }
    const c = e.target.closest('.plant');
    if (c) plantSheet(+c.dataset.p);
  });

  function plantSheet(p) {
    const info = pages[p], pl = plants[p];
    let status;
    if (!pl) status = p === next ? 'This is the next page to plant. Open it and loop it until it settles.' : 'Not planted yet.';
    else if (pl.stage === 'seed') status = 'A sleeping seed from before. Waking it adds it to your review from today.';
    else if (info.status === 'learning') status = `Planted ${info.learnedOn === today ? 'today' : `${daysBetween(info.learnedOn, today)} days ago`}. It gets a little visit every day this week.`;
    else if (pl.thirst > .15) status = `A little thirsty. It was due ${daysBetween(info.due, today)} days ago. Recite it or listen to it and it perks up.`;
    else if (info.due) { const dd = daysBetween(today, info.due); status = dd <= 0 ? 'Due for a visit today.' : `Next visit in ${dd} day${dd === 1 ? '' : 's'}.`; }
    const last = (info?.ratings || []).slice(-1)[0];
    const body = h(`<div class="plant-sheet">
      <div class="ps-top">${pl ? plantSvg(pl.stage, pl.thirst, pageSurah(p), p) : ''}
        <div><h3>${pageLabel(p)}</h3><p class="soft">Page ${p} · Juz ${juzOfPage(p)}${pl ? ` · ${STAGES[pl.stage].name}` : ''}${last ? ` · last felt ${last}` : ''}</p></div></div>
      <p>${status}</p>
      <div class="row-btns">
        ${pl?.stage === 'seed' ? '<button class="btn" data-a="wake">Wake this seed</button>' : '<button class="btn" data-a="loop">Open &amp; loop</button>'}
        <button class="btn ghost" data-a="open">Open page</button>
      </div></div>`);
    if (pl?.stage !== 'seed' && ctx.pageMarkEl) body.insertBefore(ctx.pageMarkEl(p, () => { closeSheet(); viewGarden(v, ctx); }), body.querySelector('.row-btns'));
    body.querySelector('[data-a=loop]')?.addEventListener('click', () => { closeSheet(); openMushafLoop(p, p); });
    body.querySelector('[data-a=open]').onclick = () => { closeSheet(); openMushafLoop(p, p, false); };
    body.querySelector('[data-a=wake]')?.addEventListener('click', () => {
      planner.wakeSeed(S, p); store.save(); closeSheet(); toast('Good morning, little seed 🌱'); viewGarden(v, ctx);
    });
    openSheet(body);
  }
}

function pageSurah(p) { return primarySurah(p); }

// The surah a page mostly belongs to: the last surah that starts on it, else the one it opens in.
function primarySurah(p) {
  if (!p || p > 604) return 0;
  let best = 0;
  for (const s of META.surahs) if (s[4] === p) best = s[0];
  return best || META.pages[p - 1][0];
}

// How many little flowers bloom in the window, from 0 to 3.
export function windowLevel(S) {
  let n = 0;
  for (const i of Object.values(S.pages)) if (growing(i)) n++;
  return n === 0 ? 0 : n < 5 ? 1 : n < 20 ? 2 : 3;
}

// ---------- the illustrated garden ----------
// Draws the whole garden as one storybook scene: sky, a fence and hills with a tree for each finished
// juz, rows of raised beds (one per surah) with stepping stones between them, and a potting table
// where the sleeping seed packets wait.
const nest = (svg, x, y, w, hgt) => svg.replace(/^<svg class="[^"]*"/, `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${hgt}"`);

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function gardenScene({ beds, plants, plantIn, next, trees, packets, width, night }) {
  const W = Math.max(380, Math.round(width));
  const PW = 40, PH = 62;                    // one plant cell
  const PAD = 22, BED_IN = 16, SIGN_H = 34;  // spacing
  const SKY = 150, FENCE_Y = SKY + 34;
  const rand = rng(7);

  // lay out beds in rows, left to right, wrapping like words on a page
  const maxCols = Math.max(3, Math.floor((W - PAD * 2 - BED_IN * 2) / PW));
  const placed = [];
  let x = PAD, y = FENCE_Y + 54, rowH = 0;
  const rowYs = [];
  for (const b of beds) {
    const cols = b.n <= 3 ? b.n : Math.min(maxCols, Math.ceil(b.n / Math.ceil(b.n / 11)));
    const rows = Math.ceil(b.n / cols);
    const bw = Math.max(cols * PW + BED_IN * 2, 120), bh = rows * PH + BED_IN + 8;
    if (x + bw > W - PAD && x > PAD) { rowYs.push(y + rowH); x = PAD; y += rowH + 46; rowH = 0; }
    placed.push({ ...b, x, y: y + SIGN_H, bw, bh, cols });
    x += bw + 26; rowH = Math.max(rowH, bh + SIGN_H);
  }
  let bottom = y + rowH + 30;
  const tableY = bottom + 10;
  const H = tableY + (packets.length ? 150 : 90);

  let s = `<svg class="garden-scene" viewBox="0 0 ${W} ${H}" role="group" aria-label="Your garden">
  <defs>
    <linearGradient id="gsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="gs-sky1"/><stop offset="1" class="gs-sky2"/></linearGradient>
    <linearGradient id="ggrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="gs-grass1"/><stop offset="1" class="gs-grass2"/></linearGradient>
    <radialGradient id="glamp"><stop offset="0" stop-color="#ffd98f" stop-opacity=".75"/><stop offset="1" stop-color="#ffd98f" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${SKY + 60}" fill="url(#gsky)"/>`;

  // sky: sun and clouds by day, moon and stars by night
  if (night) {
    for (let i = 0; i < 28; i++) s += `<circle cx="${(rand() * W).toFixed(0)}" cy="${(rand() * (SKY - 20)).toFixed(0)}" r="${(rand() * 1.4 + .6).toFixed(1)}" class="gs-star" style="animation-delay:${(rand() * 4).toFixed(1)}s"/>`;
    s += `<circle cx="${W - 70}" cy="52" r="24" class="gs-moon"/><circle cx="${W - 60}" cy="46" r="21" class="gs-moon-cut"/>`;
  } else {
    s += `<circle cx="${W - 74}" cy="56" r="26" class="gs-sun"/><circle cx="${W - 74}" cy="56" r="40" class="gs-sun-halo"/>`;
    for (const [cx, cy, sc, d] of [[W * .18, 48, 1, 0], [W * .55, 34, .8, -14], [W * .82, 92, .6, -26]]) {
      s += `<g class="gs-cloud" style="animation-delay:${d}s"><g transform="translate(${cx.toFixed(0)} ${cy}) scale(${sc})"><ellipse cx="0" cy="0" rx="34" ry="14"/><circle cx="-14" cy="-8" r="13"/><circle cx="8" cy="-12" r="16"/><circle cx="24" cy="-3" r="11"/></g></g>`;
    }
  }
  // hills and grass
  s += `<path d="M0 ${SKY - 6} Q${W * .2} ${SKY - 46} ${W * .42} ${SKY - 12} T${W * .8} ${SKY - 20} T${W} ${SKY - 8} V${SKY + 60} H0Z" class="gs-hill2"/>
  <path d="M0 ${SKY + 10} Q${W * .3} ${SKY - 26} ${W * .6} ${SKY + 4} T${W} ${SKY - 2} V${SKY + 60} H0Z" class="gs-hill1"/>
  <rect y="${SKY + 20}" width="${W}" height="${H - SKY - 20}" fill="url(#ggrass)"/>`;

  // a tree on the hill for every finished juz, or a little sapling waiting
  if (trees.length) {
    const n = trees.length, step = Math.min(64, (W - 60) / n);
    trees.forEach((j, i) => { s += `<g class="sc-tree"><title>Juz ${j}</title>${nest(treeSvg(j), 30 + i * step, SKY - 46, 52, 61)}</g>`; });
  } else {
    s += `<g class="sc-sapling" opacity=".75"><path d="M${PAD + 30} ${SKY + 22} v-18" class="p-stem"/><path d="M${PAD + 30} ${SKY + 10} q-8 -2 -9 -9 q7 1 9 9z M${PAD + 30} ${SKY + 6} q8 -2 9 -9 q-7 1 -9 9z" class="p-leaf"/>
      <rect x="${PAD + 42}" y="${SKY - 2}" width="118" height="22" rx="4" class="gs-sign"/><text x="${PAD + 101}" y="${SKY + 13}" class="gs-sign-t">a tree for each juz</text></g>`;
  }
  // fence
  s += `<g class="gs-fence"><rect x="0" y="${FENCE_Y - 10}" width="${W}" height="5" rx="2"/><rect x="0" y="${FENCE_Y + 6}" width="${W}" height="5" rx="2"/>`;
  for (let fx = 10; fx < W; fx += 34) s += `<path d="M${fx} ${FENCE_Y + 24} v-38 l6 -7 l6 7 v38z"/>`;
  s += `</g>`;
  // little grass tufts and flowers scattered on the lawn
  for (let i = 0; i < Math.round(W * H / 9000); i++) {
    const gx = rand() * W, gy = FENCE_Y + 30 + rand() * (H - FENCE_Y - 40);
    if (placed.some(b => gx > b.x - 8 && gx < b.x + b.bw + 8 && gy > b.y - SIGN_H - 6 && gy < b.y + b.bh + 6)) continue;
    s += rand() < .7
      ? `<path d="M${gx.toFixed(0)} ${gy.toFixed(0)} l-3 -7 M${gx.toFixed(0)} ${gy.toFixed(0)} l0 -9 M${gx.toFixed(0)} ${gy.toFixed(0)} l3 -7" class="gs-tuft"/>`
      : `<circle cx="${gx.toFixed(0)}" cy="${gy.toFixed(0)}" r="2.6" class="gs-daisy"/>`;
  }
  // stepping-stone paths between rows of beds
  for (const ry of rowYs) {
    const py = ry + 22;
    for (let px = PAD + 6; px < W - PAD; px += 30 + rand() * 10) s += `<ellipse cx="${px.toFixed(0)}" cy="${(py + Math.sin(px / 60) * 4).toFixed(0)}" rx="${(10 + rand() * 4).toFixed(1)}" ry="5.5" class="gs-stone"/>`;
  }

  // the beds
  for (const b of placed) {
    const done = b.grow === b.n;
    const name = surah(b.id).ar;
    const signW = Math.min(b.bw - (done ? 40 : 10), Math.max(64, name.length * 13 + 26));
    s += `<g class="sc-bed${done ? ' done' : ''}">`;
    // sign
    s += `<path d="M${b.x + 18} ${b.y} v-12" class="gs-post"/><rect x="${b.x + 6}" y="${b.y - SIGN_H + 2}" width="${signW}" height="24" rx="5" class="gs-sign"/>
      <text x="${b.x + 6 + signW / 2}" y="${b.y - SIGN_H + 19}" class="gs-sign-ar">${name}</text>`;
    // lantern for a finished surah
    if (done) {
      const lx = b.x + b.bw - 16;
      s += `<circle cx="${lx}" cy="${b.y - 14}" r="28" fill="url(#glamp)" class="gs-glow"/><path d="M${lx} ${b.y + 4} v-34 h-8" class="gs-post"/>${nest(lanternSvg(), lx - 18, b.y - 34, 18, 26)}`;
    }
    // raised wooden bed with soil
    s += `<rect x="${b.x}" y="${b.y}" width="${b.bw}" height="${b.bh}" rx="12" class="gs-wood"/>
      <rect x="${b.x + 6}" y="${b.y + 6}" width="${b.bw - 12}" height="${b.bh - 12}" rx="8" class="gs-soil"/>`;
    for (let i = 0; i < b.bw * b.bh / 900; i++) s += `<circle cx="${(b.x + 12 + rand() * (b.bw - 24)).toFixed(0)}" cy="${(b.y + 12 + rand() * (b.bh - 24)).toFixed(0)}" r="1.4" class="gs-crumb"/>`;
    // plants, right to left like the mushaf
    for (let k = 0; k < b.n; k++) {
      const p = b.sp + k, pl = plantIn(p, b.id);
      const col = k % b.cols, row = Math.floor(k / b.cols);
      const px = b.x + b.bw - BED_IN - (col + 1) * PW, py = b.y + 4 + row * PH;
      const cls = !pl ? 'empty' : pl.stage === 'seed' ? 'seed' : `${pl.stage}${pl.thirst > .15 ? ' thirsty' : ''}${pl.fresh ? ' fresh' : ''}`;
      const label = !pl ? `Page ${p}, not planted yet` : `Page ${p}, ${STAGES[pl.stage].name.toLowerCase()}${pl.thirst > .15 ? ', thirsty' : ''}`;
      const art = pl ? plantSvg(pl.stage, pl.thirst, b.id, p)
        : `<svg class="x" viewBox="0 0 40 60"><ellipse cx="20" cy="54" rx="9" ry="3" class="gs-mound"/>${p === next ? '<path d="M20 52 v-16" class="gs-post"/><path d="M20 36 l11 4 l-11 4z" class="gs-flag"/>' : ''}</svg>`;
      s += `<g class="plant sc-plant ${cls}${p === next && !pl ? ' next' : ''}" data-p="${p}" tabindex="0" role="button" aria-label="${label}">
        <rect x="${px}" y="${py}" width="${PW}" height="${PH}" class="hit"/>${nest(art, px, py, PW, PH - 2)}
        ${pl?.fresh ? `<text x="${px + 32}" y="${py + 12}" class="gs-spark">✦</text>` : ''}
        ${pl?.rained ? `<g class="gs-rain">${[8, 20, 30].map((dx, i) => `<line x1="${px + dx}" y1="${py}" x2="${px + dx - 1}" y2="${py + 6}" style="animation-delay:${i * .8}s"/>`).join('')}</g>` : ''}</g>`;
    }
    s += `</g>`;
  }
  if (!placed.length) s += `<text x="${W / 2}" y="${FENCE_Y + 90}" class="gs-empty">Your first page will dig the first bed.</text>`;

  // potting table with the sleeping seed packets, a watering can and a little pond
  const ty = tableY;
  if (packets.length) {
    const tw = Math.min(W - PAD * 2 - 100, packets.length * 64 + 40);
    s += `<rect x="${PAD}" y="${ty + 70}" width="${tw}" height="12" rx="4" class="gs-wood"/><path d="M${PAD + 12} ${ty + 82} v40 M${PAD + tw - 12} ${ty + 82} v40" class="gs-leg"/>
      <text x="${PAD + 4}" y="${ty + 2}" class="gs-label">sleeping seeds · tap a packet</text>`;
    packets.forEach((k, i) => {
      s += `<g class="sc-packet" data-s="${k.id}" tabindex="0" role="button" aria-label="Wake a page of ${surah(k.id).en}"><g transform="rotate(${(i % 2 ? 4 : -4)} ${PAD + 40 + i * 64} ${ty + 40})">${nest(packetSvg(k.id), PAD + 18 + i * 64, ty + 12, 44, 56)}</g>
        <text x="${PAD + 40 + i * 64}" y="${ty + 102}" class="gs-pk">${surah(k.id).ar}</text></g>`;
    });
  }
  const cx = W - PAD - 70, cy = ty + (packets.length ? 96 : 40);
  s += `<ellipse cx="${cx}" cy="${cy}" rx="62" ry="22" class="gs-pond"/><ellipse cx="${cx - 18}" cy="${cy - 4}" rx="11" ry="5" class="gs-lily"/><circle cx="${cx + 20}" cy="${cy + 3}" r="3.5" class="gs-lilyf"/>
    <path d="M${cx - 30} ${cy + 8} q24 -6 48 0" class="gs-ripple"/>`;
  // fireflies at night, butterflies by day
  for (let i = 0; i < 6; i++) {
    const bx = (rand() * (W - 60) + 30).toFixed(0), by = (FENCE_Y + 40 + rand() * (H - FENCE_Y - 80)).toFixed(0), d = (rand() * -8).toFixed(1);
    s += night
      ? `<circle cx="${bx}" cy="${by}" r="2.6" class="gs-firefly" style="animation-delay:${d}s"/>`
      : `<g class="gs-fly" style="animation-delay:${d}s"><g transform="translate(${bx} ${by})"><ellipse cx="-4" cy="0" rx="4.5" ry="3.4" class="gs-wing" style="fill:${PETALS[i % PETALS.length]}"/><ellipse cx="4" cy="0" rx="4.5" ry="3.4" class="gs-wing" style="fill:${PETALS[i % PETALS.length]}"/><path d="M0 -3 v6" class="gs-body"/></g></g>`;
  }
  return s + `</svg>`;
}
