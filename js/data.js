// Quran data: the classic Madinah mushaf layout (King Fahd Complex, QPC V2 page fonts, Hafs),
// surah info, and tafsir As-Sa'di. Page layouts and fonts load from public CDNs and are not
// re-hosted here.

// Line-by-line page layouts (same words on every line as the printed Madinah mushaf)
const LAYOUT_CDNS = [
  'https://cdn.jsdelivr.net/gh/zonetecde/mushaf-layout@main/mushaf',
  'https://raw.githubusercontent.com/zonetecde/mushaf-layout/main/mushaf',
];
// QPC V2 per-page fonts
const PAGE_FONT_CDNS = [
  (p) => `https://cdn.jsdelivr.net/gh/imajidikaji-source/quran-fonts@main/fonts/p${p}.woff2`,
  (p) => `https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${p}.woff2`,
];
// Surah header + basmala ornaments (QCF4 font set)
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

// surah ids that appear on page p
export function pageSurahs(p) { const r = META.pages[p - 1]; const out = []; for (let s = r[0]; s <= r[2]; s++) out.push(s); return out; }

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
  let a = pageRange(p1).from, b = pageRange(p2).to;
  // Start and end on the surah itself: if a surah begins on the first page, start there
  // (dropping the end of the previous surah), and if a surah ends on the last page, stop there.
  const firstEnd = pageRange(p1).to, lastStart = pageRange(p2).from;
  for (let v = nextVerse(a); v && cmpVerse(v, firstEnd) <= 0; v = nextVerse(v)) {
    if (v[1] === 1) { a = v; break; }
  }
  let cut = null;
  for (let v = cmpVerse(lastStart, a) > 0 ? lastStart : a; v && cmpVerse(v, b) <= 0; v = nextVerse(v)) {
    if (v[1] === surah(v[0]).verses) cut = v;
  }
  if (cut) b = cut;
  let start = a, end = b;
  if (bridge) {
    // One ayah before and after keeps pages connected, but never across a surah boundary.
    if (a[1] !== 1) start = prevVerse(a) || a;
    if (b[1] !== surah(b[0]).verses) end = nextVerse(b) || b;
  }
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
    for (const base of LAYOUT_CDNS) {
      try {
        const r = await fetch(`${base}/page-${pad}.json`);
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
async function tryFonts(name, urls) {
  for (const url of urls) {
    try {
      const ff = new FontFace(name, `url(${url})`, { display: 'block' });
      await ff.load();
      document.fonts.add(ff);
      return true;
    } catch (e) { /* try next */ }
  }
  return false;
}
export function loadPageFont(p) {
  const name = `qpc-p${p}`;
  if (!fontJobs.has(name)) fontJobs.set(name, tryFonts(name, PAGE_FONT_CDNS.map(f => f(p))));
  return fontJobs.get(name).then(ok => ok ? name : null);
}
// 'QCF4_QBSML' (surah headers) and 'QCF4_Hafs_01' (basmala)
export function loadOrnamentFont(name) {
  if (!fontJobs.has(name)) {
    const file = name === 'QCF4_QBSML' ? `${name}.woff2` : `${name}_W.woff2`;
    fontJobs.set(name, tryFonts(name, QCF_CDNS.map(b => `${b}/fonts-woff2/${file}`)));
  }
  return fontJobs.get(name);
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
