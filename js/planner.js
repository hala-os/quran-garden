// The memorize + review planner.
// Builds a small "Today" list that fits the daily time, and never shows a backlog.
import { todayStr, addDays, daysBetween } from './store.js';

export const MIN_PAGES = 1;            // daily minimum: one page of review...
export const MIN_LISTEN_SEC = 10 * 60; // ...or ten minutes of listening
const NEW_PAGE_MIN = 8;                // rough minutes for one new page
const REVIEW_PAGE_MIN = 2.5;           // rough minutes to recite one review page
const RECENT_DAYS = 7;                 // a new page is "settling" for a week
const MAX_INTERVAL = 120;

function graduate(state, today) {
  for (const [p, info] of Object.entries(state.pages)) {
    if (info.status === 'learning' && daysBetween(info.learnedOn, today) >= RECENT_DAYS) {
      info.status = 'review';
      info.interval = 7;
      info.due = today;
    }
  }
}

function lastActiveBefore(state, today) {
  let best = null;
  for (const [d, v] of Object.entries(state.days)) {
    if (d >= today) continue;
    if (Object.keys(v.reviewed || {}).length || (v.listenedSec || 0) > 60 || (v.learned || []).length) {
      if (!best || d > best) best = d;
    }
  }
  return best;
}

function recentRatings(state, n = 15) {
  const out = [];
  const dates = Object.keys(state.days).sort().reverse();
  for (const d of dates) {
    for (const r of Object.values(state.days[d].reviewed || {})) { out.push(r); if (out.length >= n) return out; }
  }
  return out;
}

export function capacity(settings, withNew) {
  const reviewMin = Math.max(5, settings.minutes - (withNew ? NEW_PAGE_MIN * settings.newPerDay : 0));
  return Math.max(MIN_PAGES, Math.floor(reviewMin / REVIEW_PAGE_MIN));
}

export function buildPlan(state, today = todayStr(), now = new Date()) {
  graduate(state, today);
  const s = state.settings;
  const pages = state.pages;

  const recent = Object.entries(pages)
    .filter(([, i]) => i.status === 'learning' && i.learnedOn !== today)
    .map(([p]) => +p).sort((a, b) => a - b);

  const due = Object.entries(pages)
    .filter(([, i]) => i.status === 'review' && i.due && i.due <= today)
    .map(([p, i]) => {
      const late = daysBetween(i.due, today) + 1;
      const shaky = (i.ratings || []).slice(-1)[0] === 'shaky' ? 1 : 0;
      return { p: +p, score: late / Math.max(1, i.interval || 1) + shaky };
    })
    .sort((a, b) => b.score - a.score || a.p - b.p);

  // Should today include new pages?
  let reason = 'normal';
  const weekday = now.getDay();
  const last = lastActiveBefore(state, today);
  const ratings = recentRatings(state);
  const shakyShare = ratings.length >= 5 ? ratings.filter(r => r === 'shaky').length / ratings.length : 0;
  const capWithNew = capacity(s, true);

  const anyMemorized = Object.values(pages).some(i => i.status === 'review' || i.status === 'learning');
  if (!anyMemorized) reason = 'first';
  else if (!s.newDays.includes(weekday)) reason = 'review-day';
  else if (last && daysBetween(last, today) >= 3) reason = 'welcome-back';
  else if (shakyShare >= 0.4) reason = 'gentle';
  else if (due.length > capWithNew * 2) reason = 'gentle';

  let newPages = [];
  if (reason === 'normal' || reason === 'first') newPages = nextNewPages(state, s.newPerDay);
  if ((reason === 'normal' || reason === 'first') && newPages.length === 0) reason = 'complete';

  const cap = capacity(s, newPages.length > 0);
  const recentPick = recent.slice(-Math.min(recent.length, Math.max(1, Math.ceil(cap / 2))));
  const room = Math.max(0, cap - recentPick.length);
  const older = due.slice(0, room).map(d => d.p);

  return { date: today, newPages, recent: recentPick, older, reason, extra: [] };
}

export function nextNewPages(state, n) {
  const out = [];
  let p = state.settings.nextNewPage;
  while (out.length < n && p <= 604) {
    const st = state.pages[p]?.status;
    if (st !== 'review' && st !== 'learning') out.push(p);
    p++;
  }
  return out;
}

export function todayPlan(state, today = todayStr(), rebuild = false) {
  if (!state.plans[today] || rebuild) {
    const keep = state.plans[today];
    state.plans[today] = buildPlan(state, today);
    if (keep && rebuild) state.plans[today].extra = keep.extra || [];
    // keep the plan list from growing forever
    const dates = Object.keys(state.plans).sort();
    while (dates.length > 14) delete state.plans[dates.shift()];
  }
  return state.plans[today];
}

export function rate(state, page, rating, today = todayStr()) {
  const info = state.pages[page] || (state.pages[page] = { status: 'review', interval: 1 });
  info.ratings = [...(info.ratings || []), rating].slice(-8);
  info.last = today;
  if (info.status === 'review' || info.status === 'seed') {
    info.status = 'review';
    const iv = info.interval || 1;
    if (rating === 'strong') info.interval = Math.min(MAX_INTERVAL, Math.max(3, Math.round(iv * 2.5)));
    else if (rating === 'okay') info.interval = Math.min(MAX_INTERVAL, Math.max(2, Math.round(iv * 1.5)));
    else info.interval = 1;
    info.due = addDays(today, info.interval);
  }
  const d = dayOf(state, today);
  d.reviewed[page] = rating;
}

export function unrate(state, page, today = todayStr()) {
  const d = dayOf(state, today);
  delete d.reviewed[page];
}

export function markLearned(state, page, today = todayStr()) {
  state.pages[page] = { status: 'learning', learnedOn: today, last: today, ratings: [] };
  if (state.settings.nextNewPage <= page) state.settings.nextNewPage = page + 1;
  const d = dayOf(state, today);
  if (!d.learned.includes(page)) d.learned.push(page);
}

export function wakeSeed(state, page, today = todayStr()) {
  state.pages[page] = { status: 'review', interval: 1, due: today, ratings: [], wokeOn: today };
  const plan = todayPlan(state, today);
  if (!plan.extra.includes(page) && !plan.older.includes(page)) plan.extra.push(page);
}

// surahs = the surahs that appear on page p (from data.pageSurahs)
// onlySurah: mark just that surah. On a page it shares with other surahs, only its part counts,
// so its neighbours don't get marked by accident.
export function setStatus(state, from, to, status, today = todayStr(), onlySurah = null, surahsOn = null) {
  for (let p = from; p <= to; p++) {
    const on = surahsOn ? surahsOn(p) : [];
    const shared = onlySurah && on.length > 1;
    const cur = state.pages[p];
    const curGrowing = cur && (cur.status === 'review' || cur.status === 'learning');
    if (shared) {
      if (status === 'review') {
        if (curGrowing && !cur.only) continue; // the whole page is already memorized
        const only = [...new Set([...(curGrowing ? cur.only : []), onlySurah])].sort((a, b) => a - b);
        const info = curGrowing ? cur : { status: 'review', interval: 3, due: addDays(today, p % 3), ratings: [] };
        info.only = only.length >= on.length ? undefined : only;
        if (!info.only) delete info.only;
        state.pages[p] = info;
      } else if (curGrowing) {
        const keep = (cur.only || on).filter(x => x !== onlySurah);
        if (keep.length) cur.only = keep;
        else if (status === 'seed') state.pages[p] = { status: 'seed' };
        else delete state.pages[p];
      } else if (status === 'seed') state.pages[p] = { status: 'seed' };
      else if (cur?.status === 'seed' && status === 'none') delete state.pages[p];
      continue;
    }
    if (status === 'none') delete state.pages[p];
    else if (status === 'seed') state.pages[p] = { status: 'seed' };
    else if (status === 'review') state.pages[p] = { status: 'review', interval: 3, due: addDays(today, (p % 3)), ratings: [] };
  }
}

export function addListening(state, seconds, pages = [], today = todayStr()) {
  const d = dayOf(state, today);
  d.listenedSec = (d.listenedSec || 0) + seconds;
  for (const p of pages) {
    const info = state.pages[p];
    if (info) info.watered = today; // light rain for the garden
  }
}

export function dayOf(state, date) {
  if (!state.days[date]) state.days[date] = { reviewed: {}, listenedSec: 0, learned: [] };
  return state.days[date];
}

export function minimumMet(state, date = todayStr()) {
  const d = state.days[date];
  if (!d) return false;
  return Object.keys(d.reviewed).length >= MIN_PAGES || d.learned.length > 0 || d.listenedSec >= MIN_LISTEN_SEC;
}

export function wateredDays(state, today = todayStr(), span = 30) {
  let n = 0;
  for (let i = 0; i < span; i++) if (minimumMet(state, addDays(today, -i))) n++;
  return n;
}

export function counts(state) {
  const c = { seed: 0, learning: 0, review: 0 };
  for (const i of Object.values(state.pages)) c[i.status] = (c[i.status] || 0) + 1;
  return c;
}
