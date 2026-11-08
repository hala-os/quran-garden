// Searchable dropdowns: turns a <select data-search> into a button that opens a small panel
// with a search box. Search by number, Arabic name (with or without harakat or "ال") or English name.
const norm = (t) => String(t).toLowerCase()
  .replace(/[ً-ٰٟۖ-ۭـ]/g, '')   // harakat, tatweel
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/\bال/g, '').replace(/\b(al|an|ar|as|at|ash|ad|adh|az)[-\s]/g, '')
  .replace(/[^a-z0-9؀-ۿ]+/g, '').replace(/(.)\1/g, '$1').replace(/h$/, '');

export function enhanceSelects(root = document) {
  root.querySelectorAll('select[data-search]:not([data-enhanced])').forEach(enhance);
}

function enhance(sel) {
  sel.dataset.enhanced = '1';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'pick-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
  sel.hidden = true;
  sel.after(btn);
  const sync = () => { btn.innerHTML = `<span>${sel.selectedOptions[0]?.textContent || ''}</span><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>`; };
  sel._sync = sync; sync();
  sel.addEventListener('change', sync);
  btn.onclick = (e) => { e.stopPropagation(); open(sel, btn); };
}

let openPanel = null;
function close() { openPanel?.remove(); openPanel = null; document.removeEventListener('pointerdown', outside, true); }
function outside(e) { if (openPanel && !openPanel.contains(e.target)) close(); }

function open(sel, btn) {
  if (openPanel) { close(); return; }
  const panel = document.createElement('div');
  panel.className = 'pick-panel';
  panel.innerHTML = `<input type="search" placeholder="Search a surah…" aria-label="Search"><div class="pick-list" role="listbox"></div>`;
  const input = panel.querySelector('input'), list = panel.querySelector('.pick-list');
  const opts = [...sel.options].map(o => ({ o, key: norm(o.textContent) + ' ' + norm(o.textContent.replace(/^\d+\.\s*/, '')) }));
  let active = 0, shown = [];
  const draw = () => {
    const q = norm(input.value);
    const num = /^\d+$/.test(input.value.trim()) ? input.value.trim() : null;
    shown = opts.filter(({ o, key }) => !q || (num ? o.textContent.trim().startsWith(num + '.') || o.textContent.trim() === num : key.includes(q)));
    if (num) shown.sort((a, b) => (a.o.textContent.startsWith(num + '.') ? 0 : 1) - (b.o.textContent.startsWith(num + '.') ? 0 : 1));
    active = Math.max(0, shown.findIndex(x => x.o.selected && !q));
    list.innerHTML = shown.length ? '' : '<div class="pick-none">No surah found</div>';
    shown.forEach(({ o }, i) => {
      const d = document.createElement('div');
      d.className = 'pick-item' + (o.selected ? ' on' : '') + (i === active ? ' act' : '');
      d.setAttribute('role', 'option'); d.textContent = o.textContent;
      d.onclick = () => choose(o);
      list.append(d);
    });
    list.children[active]?.scrollIntoView?.({ block: 'nearest' });
  };
  const choose = (o) => { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); close(); btn.focus(); };
  input.oninput = draw;
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); active = Math.max(0, Math.min(shown.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      [...list.children].forEach((c, i) => c.classList.toggle('act', i === active)); list.children[active]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) choose(shown[active].o); }
    else if (e.key === 'Escape') { e.stopPropagation(); close(); btn.focus(); }
  };
  document.body.append(panel);
  const r = btn.getBoundingClientRect();
  const w = Math.min(340, innerWidth - 24);
  panel.style.width = w + 'px';
  panel.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + 'px';
  const below = innerHeight - r.bottom > 300 || r.top < 300;
  if (below) panel.style.top = (r.bottom + 6) + 'px'; else panel.style.bottom = (innerHeight - r.top + 6) + 'px';
  openPanel = panel;
  draw();
  setTimeout(() => input.focus(), 30);
  document.addEventListener('pointerdown', outside, true);
}
