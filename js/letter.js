// A little weekly letter from the garden, waiting on Fridays. Warm, short, and never a scolding.
import { todayStr, addDays } from './store.js';
import { pageLabel, ar } from './data.js';
import { minimumMet } from './planner.js';

// The week a date belongs to, named by its Friday (letters arrive on Friday and stay for the week).
export function letterWeek(today = todayStr()) {
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0 Sun .. 5 Fri
  return addDays(today, -((dow - 5 + 7) % 7));
}

export function weekSummary(S, friday) {
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(friday, -i));
  let watered = 0, sec = 0, reviewed = 0, learned = 0, strong = 0;
  const strongBy = {};
  for (const d of days) {
    const x = S.days[d]; if (!x) continue;
    if (minimumMet(S, d)) watered++;
    sec += (x.listenedSec || 0) + (x.focusSec || 0);
    learned += (x.learned || []).length;
    for (const [p, r] of Object.entries(x.reviewed || {})) { reviewed++; if (r === 'strong') { strong++; strongBy[p] = (strongBy[p] || 0) + 1; } }
  }
  let star = null;
  for (const [p, n] of Object.entries(strongBy)) {
    const iv = S.pages[p]?.interval || 0;
    if (!star || n > star.n || (n === star.n && iv > star.iv)) star = { p: +p, n, iv };
  }
  return { days, watered, min: Math.round(sec / 60), reviewed, learned, strong, star };
}

export function letterHtml(S, friday) {
  const w = weekSummary(S, friday);
  const dots = w.days.map(d => `<span class="lt-dot ${minimumMet(S, d) ? 'on' : ''}" title="${d}"></span>`).join('');
  let body;
  if (!w.watered && !w.min) {
    body = `<p>The garden rested this week, and that's alright. Seeds are patient, and roots keep holding on underground.</p>
      <p>Whenever you're ready, even one page or ten minutes of listening is enough to wake everything up again.</p>`;
  } else {
    const bits = [];
    if (w.learned) bits.push(`planted <b>${w.learned}</b> new page${w.learned > 1 ? 's' : ''}`);
    if (w.reviewed) bits.push(`watered <b>${w.reviewed}</b> page${w.reviewed > 1 ? 's' : ''} with review`);
    if (w.min) bits.push(`spent <b>${w.min} minutes</b> with the Quran`);
    body = `<p>This week you ${bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits.slice(-1) : bits[0]}. The garden felt every drop.</p>`;
    if (w.star) body += `<p>The plant that grew the most was <b>page ${w.star.p}</b> (${pageLabel(w.star.p)}), strong ${w.star.n > 1 ? `${w.star.n} times` : 'when you reviewed it'}. It's standing tall now 🌸</p>`;
    body += w.watered >= 5 ? `<p>${w.watered} watered days out of 7. ما شاء الله, that's a lovely rhythm.</p>`
      : `<p>${w.watered} watered day${w.watered === 1 ? '' : 's'} this week. Every one of them counts, and next week is a fresh bed of soil.</p>`;
  }
  return `<div class="letter">
    <div class="lt-stamp">🌷</div>
    <p class="lt-date">Friday ${ar(+friday.slice(8))}/${ar(+friday.slice(5, 7))}</p>
    <p class="lt-hi">Dear gardener,</p>
    ${body}
    <div class="lt-week">${dots}</div>
    <p class="lt-sign">With love,<br>your garden · بستانك</p>
  </div>`;
}
