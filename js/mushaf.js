// Renders one Madinah mushaf page (15 lines) with the QCF4 page fonts.
import { loadPage, loadFont, surah, juzOfPage, ar, pageRange } from './data.js';

export async function renderPage(el, p, { onVerse } = {}) {
  el.innerHTML = '';
  el.dataset.page = p;
  el.classList.add('mushaf-page', 'loading');
  const { from } = pageRange(p);
  const head = document.createElement('div');
  head.className = 'mp-head';
  head.innerHTML = `<span>${surah(from[0]).ar}</span><span>الجزء ${ar(juzOfPage(p))}</span>`;
  const body = document.createElement('div');
  body.className = 'mp-body';
  const foot = document.createElement('div');
  foot.className = 'mp-foot';
  foot.textContent = ar(p);
  el.append(head, body, foot);

  let data;
  try {
    data = await loadPage(p);
    const fonts = new Set(['QCF4_QBSML', data.font]);
    data.lines.forEach(l => l.words.forEach(w => w.font && fonts.add(w.font)));
    await Promise.all([...fonts].map(loadFont));
  } catch (e) {
    body.innerHTML = `<div class="mp-error">This page couldn't load. Check your connection, then tap to try again.</div>`;
    body.firstChild.onclick = () => renderPage(el, p, { onVerse });
    el.classList.remove('loading');
    return;
  }
  if (el.dataset.page != p) return;

  const frag = document.createDocumentFragment();
  for (const line of data.lines) {
    const row = document.createElement('div');
    row.className = 'ml';
    const t = line.words[0]?.type;
    if (t === 'surah_header') row.classList.add('ml-header');
    if (t === 'bismillah') row.classList.add('ml-bism');
    for (const w of line.words) {
      const span = document.createElement('span');
      span.className = 'w w-' + w.type;
      span.textContent = w.char;
      span.style.fontFamily = `'${w.font}'`;
      if (w.verse_key) span.dataset.v = w.verse_key;
      if (w.type === 'surah_header') {
        const s = surah(w.sura);
        span.title = s.ar;
        span.setAttribute('aria-label', 'سورة ' + s.ar);
      } else if (w.text) span.setAttribute('aria-label', w.text);
      row.appendChild(span);
    }
    frag.appendChild(row);
  }
  body.appendChild(frag);
  body.classList.toggle('mp-short', data.lines.length < 15);
  el.classList.remove('loading');
  if (onVerse) {
    body.onclick = (e) => {
      const s = e.target.closest('[data-v]');
      if (s) onVerse(s.dataset.v, s);
    };
  }
  fit(el);
  if (!el._ro) {
    el._ro = new ResizeObserver(() => fit(el));
    el._ro.observe(el);
  }
}

// Sizes the text so the longest line fills the page width, like a printed mushaf.
export function fit(el) {
  const body = el.querySelector('.mp-body');
  if (!body || !body.children.length) return;
  const W = body.clientWidth, H = body.clientHeight;
  if (!W || !H) return;
  const base = 40;
  body.style.fontSize = base + 'px';
  const rows = [...body.children];
  rows.forEach(r => r.classList.remove('justify'));
  let widest = 0;
  const widths = rows.map(r => {
    if (r.classList.contains('ml-header')) return 0;
    let w = 0; for (const c of r.children) w += c.getBoundingClientRect().width;
    widest = Math.max(widest, w);
    return w;
  });
  if (!widest) return;
  const byWidth = base * (W * 0.985) / widest;
  const byHeight = H / 15 / 1.55;
  const size = Math.min(byWidth, byHeight);
  body.style.fontSize = size.toFixed(2) + 'px';
  rows.forEach((r, i) => { if (widths[i] > widest * 0.86) r.classList.add('justify'); });
}

export function highlight(root, keys, cls) {
  root.querySelectorAll('.' + cls).forEach(n => n.classList.remove(cls));
  if (!keys) return;
  const set = new Set(Array.isArray(keys) ? keys : [keys]);
  root.querySelectorAll('[data-v]').forEach(n => { if (set.has(n.dataset.v)) n.classList.add(cls); });
}
