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

  // which surahs have a bed
  const next = S.settings.nextNewPage;
  const beds = [], packets = [];
  for (const s of META.surahs) {
    const [id, , , , sp, ep] = s;
    let grow = 0, own = 0, seeds = 0;
    for (let p = sp; p <= ep; p++) {
      const pl = plants[p];
      if (pl?.stage === 'seed') seeds++;
      else if (pl) { grow++; if (primarySurah(p) === id) own++; }
    }
    // A page shared by two surahs only opens a bed for the surah it mostly belongs to.
    const nextHere = primarySurah(next) === id;
    if (own || nextHere) beds.push({ id, sp, ep, grow, n: ep - sp + 1 });
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
      <div id="beds" class="beds"></div>
      <h2>The grove <span class="ar">بستان الأجزاء</span></h2>
      <div class="card grove">${trees.length
        ? `<div class="trees">${trees.map(j => `<div class="tree-cell">${treeSvg(j)}<span>Juz ${j}</span></div>`).join('')}</div>`
        : `<div class="grove-empty"><div class="tree-ghost">${treeSvg(0)}</div><p>A tree grows here for every juz you finish. Al-Ma'idah fills most of juz 6 and 7, so your first one isn't far.</p></div>`}
      </div>
      ${packets.length ? `
      <h2>Seed packets <span class="ar">بذور نائمة</span></h2>
      <p class="hint">Surahs you memorized before. They're sleeping, not lost. Tap a packet to wake one page.</p>
      <div class="packets">${packets.map(k => `<button class="packet" data-s="${k.id}">${packetSvg(k.id)}<span class="pk-name">${surah(k.id).ar}</span><span class="pk-count">${k.seeds} seeds</span></button>`).join('')}</div>` : ''}
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
      const pl = plants[p];
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

  root.addEventListener('click', (e) => {
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
