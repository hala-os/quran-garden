// Renders one page of the classic Madinah mushaf: 15 lines, same words on every line as print.
import { loadPage, loadPageFont, loadOrnamentFont, surah, juzOfPage, ar, pageRange } from './data.js';

const BASMALA = ''; // basmala glyph in QCF4_Hafs_01

export async function renderPage(el, p, { onVerse } = {}) {
  el.innerHTML = '';
  el.dataset.page = p;
  el.classList.add('mushaf-page', 'loading');
  el.classList.toggle('opening', p <= 2);
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

  let data, font;
  try {
    data = await loadPage(p);
    const needs = data.lines.map(l => l.type);
    const [f] = await Promise.all([
      loadPageFont(p),
      needs.includes('surah-header') ? loadOrnamentFont('QCF4_QBSML') : null,
      needs.includes('basmala') ? loadOrnamentFont('QCF4_Hafs_01') : null,
    ]);
    font = f;
    if (!font) throw new Error('font');
  } catch (e) {
    body.innerHTML = `<div class="mp-error">This page couldn't load. Check your connection, then tap here to try again.</div>`;
    body.firstChild.onclick = () => renderPage(el, p, { onVerse });
    el.classList.remove('loading');
    return;
  }
  if (el.dataset.page != p) return;

  const frag = document.createDocumentFragment();
  for (const line of data.lines) {
    const row = document.createElement('div');
    row.className = 'ml';
    if (line.type === 'surah-header') {
      const s = +line.surah;
      row.classList.add('ml-header');
      row.innerHTML = `<span class="sh-frame"><span class="sh-name" style="font-family:'QCF4_QBSML'" aria-label="سورة ${surah(s).ar}">${String.fromCharCode(0xF100 + s - 1)}</span></span>`;
    } else if (line.type === 'basmala') {
      row.classList.add('ml-bism');
      row.innerHTML = `<span style="font-family:'QCF4_Hafs_01'" aria-label="بسم الله الرحمن الرحيم">${BASMALA}</span>`;
    } else {
      for (const w of line.words) {
        const span = document.createElement('span');
        const [s, a] = w.location.split(':');
        span.className = 'w';
        span.dataset.v = `${s}:${a}`;
        span.textContent = w.qpcV2.replace(/\s+/g, '');
        span.setAttribute('aria-label', w.word);
        frag.appendChild(span);
        row.appendChild(span);
      }
      row.style.fontFamily = `'${font}'`;
    }
    frag.appendChild(row);
  }
  body.appendChild(frag);
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

// Size the text so full lines span the page edge to edge, like print, without stretching.
export function fit(el) {
  const body = el.querySelector('.mp-body');
  if (!body || !body.children.length) return;
  const W = body.clientWidth, H = body.clientHeight;
  if (!W || !H) return;
  const base = 40;
  body.style.fontSize = base + 'px';
  body.style.paddingInline = '0px';
  const rows = [...body.children];
  rows.forEach(r => r.classList.remove('justify'));
  const widths = rows.map(r => {
    if (!r.querySelector('.w')) return 0;
    let w = 0; for (const c of r.children) w += c.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(r).columnGap) || 0;
    return w + gap * (r.children.length - 1);
  });
  // The widest line just fits; the others are spread to the same edges, like print.
  const sorted = widths.filter(Boolean).sort((a, b) => b - a);
  if (!sorted.length) return;
  const opening = el.classList.contains('opening');
  const byWidth = base * (W * (opening ? 0.72 : 0.985)) / sorted[0];
  const byHeight = H / 15 / 1.22;
  const size = Math.min(byWidth, byHeight);
  body.style.fontSize = size.toFixed(2) + 'px';
  if (!opening) {
    // Every text line runs edge to edge, like print. When the page is short and the text
    // can't fill the width, narrow the text block instead of stretching the gaps.
    const block = sorted[0] * size / base;
    if (block < W * 0.97) body.style.paddingInline = ((W - block) / 2).toFixed(1) + 'px';
    rows.forEach((r, i) => { if (widths[i]) r.classList.add('justify'); });
  }
}

export function highlight(root, keys, cls) {
  root.querySelectorAll('.' + cls).forEach(n => n.classList.remove(cls));
  if (!keys) return;
  const set = new Set(Array.isArray(keys) ? keys : [keys]);
  root.querySelectorAll('[data-v]').forEach(n => { if (set.has(n.dataset.v)) n.classList.add(cls); });
}
