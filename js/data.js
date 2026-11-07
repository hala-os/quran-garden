// Quran data: mushaf pages (QCF4 Madinah 1441, Hafs), surah info, tafsir As-Sa'di.
// Fonts and page data load from the quran-qcf4 package on the jsDelivr CDN, so they
// are never re-hosted here. Tafsir comes from the open tafsir_api dataset.

export const QCF_CDNS = [
  'https://cdn.jsdelivr.net/npm/quran-qcf4@1.1.0',
  'https://cdn.jsdelivr.net/gh/MohamadHajjRabee/quran-qcf4@main',
];
const TAFSIR_CDNS = [
  'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/ar-tafseer-al-saddi',
  'https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/ar-tafseer-al-saddi',
];

export let META = null; // { surahs: [[id, ar, en, verses, startPage, endPage, bismillah]], pages: [[s,a,s,a]] }

export async function loadMeta() {
  if (META) return META;
  const r = await fetch('data/meta.json');
  META = await r.json();
  return META;
}

export const surah = (id) => {
  const s = META.surahs[id - 1];
  return { id: s[0], ar: s[1], en: s[2], verses: s[3], start: s[4], end: s[5], bismillah: !!s[6] };
};

export function juzOfPage(p) { return p < 22 ? 1 : Math.min(30, Math.floor((p - 2) / 20) + 1); }

export function pageRange(p) { const r = META.pages[p - 1]; return { from: [r[0], r[1]], to: [r[2], r[3]] }; }

// A short label for a page, e.g. "المائدة ١–٢"
export function pageLabel(p) {
  const { from, to } = pageRange(p);
  const s1 = surah(from[0]);
  if (from[0] === to[0]) return `${s1.ar} ${ar(from[1])}–${ar(to[1])}`;
  return `${s1.ar} ${ar(from[1])} – ${surah(to[0]).ar} ${ar(to[1])}`;
}
export function pageSurahNames(p) {
  const { from, to } = pageRange(p);
  const out = [];
  for (let s = from[0]; s <= to[0]; s++) out.push(surah(s).ar);
  return out.join(' · ');
}

export const ar = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

// ---- verse ordering ----
export function nextVerse([s, a]) {
  if (a < surah(s).verses) return [s, a + 1];
  if (s < 114) return [s + 1, 1];
  return null;
}
export function prevVerse([s, a]) {
  if (a > 1) return [s, a - 1];
  if (s > 1) return [s - 1, surah(s - 1).verses];
  return null;
}
export const vkey = ([s, a]) => `${s}:${a}`;
export const cmpVerse = (x, y) => x[0] - y[0] || x[1] - y[1];

// All verses touching pages p1..p2, optionally with one bridge ayah on each side.
export function versesForPages(p1, p2, bridge = true) {
  const a = pageRange(p1).from, b = pageRange(p2).to;
  let start = a, end = b;
  if (bridge) { start = prevVerse(a) || a; end = nextVerse(b) || b; }
  const out = [];
  for (let v = start; v && cmpVerse(v, end) <= 0; v = nextVerse(v)) out.push(v);
  return out;
}

// ---- pages + fonts ----
const pageCache = new Map();
export async function loadPage(p) {
  if (pageCache.has(p)) return pageCache.get(p);
  const pad = String(p).padStart(3, '0');
  const job = (async () => {
    let lastErr;
    for (const base of QCF_CDNS) {
      try {
        const r = await fetch(`${base}/pages/${pad}.json`);
        if (r.ok) return await r.json();
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('page not available');
  })();
  pageCache.set(p, job);
  job.catch(() => pageCache.delete(p));
  return job;
}

const fontJobs = new Map();
export function loadFont(name) {
  if (fontJobs.has(name)) return fontJobs.get(name);
  const file = name === 'QCF4_QBSML' ? `${name}.woff2` : `${name}_W.woff2`;
  const job = (async () => {
    for (const base of QCF_CDNS) {
      try {
        const ff = new FontFace(name, `url(${base}/fonts-woff2/${file})`, { display: 'block' });
        await ff.load();
        document.fonts.add(ff);
        return true;
      } catch (e) { /* try next */ }
    }
    return false;
  })();
  fontJobs.set(name, job);
  return job;
}

// ---- tafsir ----
const tafsirCache = new Map();
export async function tafsir(s, a) {
  const k = `${s}:${a}`;
  if (tafsirCache.has(k)) return tafsirCache.get(k);
  for (const base of TAFSIR_CDNS) {
    try {
      const r = await fetch(`${base}/${s}/${a}.json`);
      if (r.ok) { const t = (await r.json()).text || ''; tafsirCache.set(k, t); return t; }
    } catch (e) { /* next */ }
  }
  throw new Error('tafsir unavailable');
}
