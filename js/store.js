// Saves everything in this browser (localStorage). Sync comes in a later step.
const KEY = 'bustan.v1';

export function todayStr(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return todayStr(dt);
}
export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function defaultState() {
  const pages = {};
  // Al-Baqarah to An-Nisa (and Al-Fatiha) start as sleeping seeds.
  for (let p = 1; p <= 105; p++) pages[p] = { status: 'seed' };
  return {
    version: 1,
    createdOn: todayStr(),
    settings: {
      minutes: 20,              // daily time
      newDays: [1, 2, 3, 4, 5], // Mon..Fri get new pages (0 = Sunday); weekends are review days
      newPerDay: 1,
      nextNewPage: 106,         // Al-Ma'idah
      reciter: 'sufi',
      bridgeAyahs: true,        // one ayah before / after a range
      ayahRepeat: 1,
      rangeRepeat: 3,
      speed: 1,
      theme: 'auto',            // auto | night | morning
      fire: false,
      spread: 'auto',           // auto | single | double
    },
    pages,                      // page -> { status: seed|learning|review, learnedOn, interval, due, last, ratings:[] }
    days: {},                   // date -> { reviewed: {page: rating}, listenedSec, learned: [pages] }
    plans: {},                  // date -> frozen Today plan
    journal: {},                // date -> text (step 3)
    notes: {},                  // 's:a' -> { text, like: 's:a', on: date }  mutashabihat & reminders
    lastPage: 106,
  };
}

let state = null;
const listeners = new Set();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const def = defaultState();
      state = { ...def, ...s, settings: { ...def.settings, ...(s.settings || {}) } };
      return state;
    }
  } catch (e) { console.warn('Could not read saved data', e); }
  state = defaultState();
  save();
  return state;
}
export function get() { return state || load(); }
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Could not save', e); }
  listeners.forEach(fn => fn(state));
}
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function replaceAll(s) { state = s; save(); }
export function day(date = todayStr()) {
  const s = get();
  if (!s.days[date]) s.days[date] = { reviewed: {}, listenedSec: 0, learned: [] };
  return s.days[date];
}
