// A little floating listening window that stays on top of other apps.
// Chrome on a computer gets a real mini window with buttons (Document Picture-in-Picture).
// Android gets a floating video window drawn from a canvas; its buttons use the Media Session.
let pip = null;   // { kind: 'doc' | 'video', win?, video?, canvas?, ctx? }
let last = { title: '', sub: '', playing: false };
let actions = {};

export const canPopOut = () => 'documentPictureInPicture' in window || !!document.pictureInPictureEnabled;

export async function popOut(act) {
  actions = act;
  if (pip) { closePopout(); return; }
  // The video window has no address bar and scales cleanly to any size, so it's used everywhere.
  if (document.pictureInPictureEnabled) return openVideo();
  if ('documentPictureInPicture' in window) return openDoc();
  throw new Error('unsupported');
}

export function closePopout() {
  if (!pip) return;
  if (pip.kind === 'doc') pip.win.close();
  else if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
  cleanup();
}

function cleanup() {
  if (pip?.video) { pip.video.srcObject?.getTracks().forEach(t => t.stop()); pip.video.remove(); }
  pip = null;
}

export function refreshPopout(title, sub, playing) {
  last = { title, sub, playing };
  if (!pip) return;
  if (pip.kind === 'doc') paintDoc(); else paintCanvas();
}

// ---------- computer: a real mini window ----------
function vars() {
  const cs = getComputedStyle(document.documentElement);
  return ['--bg', '--card', '--card2', '--line', '--ink', '--ink2', '--soft', '--accent', '--on-accent', '--paper', '--paper-ink']
    .map(v => `${v}:${cs.getPropertyValue(v)}`).join(';');
}

async function openDoc() {
  const win = await window.documentPictureInPicture.requestWindow({ width: 340, height: 190 });
  pip = { kind: 'doc', win };
  const d = win.document;
  d.head.innerHTML = `<meta charset="utf-8"><title>Bustan</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800&family=Noto+Naskh+Arabic:wght@600&display=swap" rel="stylesheet">
  <style>
    :root { ${vars()} }
    html, body { margin: 0; height: 100%; }
    body { background: var(--card); color: var(--ink); font-family: Nunito, system-ui, sans-serif; display: flex; flex-direction: column; justify-content: center; gap: 12px; padding: 14px 16px; box-sizing: border-box; }
    .t { font-family: 'Noto Naskh Arabic', serif; font-size: 1.35rem; direction: rtl; text-align: center; line-height: 1.4; }
    .s { color: var(--soft); font-size: .82rem; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .c { display: flex; justify-content: center; gap: 10px; }
    button { width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--line); background: var(--card2); color: var(--ink); cursor: pointer; display: grid; place-items: center; padding: 0; }
    button.big { width: 52px; height: 52px; background: var(--accent); color: var(--on-accent); border: 0; }
    svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .fill { fill: currentColor; stroke: none; }
  </style>`;
  d.body.innerHTML = `<div class="t" id="t"></div><div class="s" id="s"></div>
    <div class="c">
      <button data-a="next" aria-label="Next ayah"><svg viewBox="0 0 24 24"><path d="M15 6 9 12l6 6"/></svg></button>
      <button data-a="toggle" class="big" aria-label="Play or pause" id="pp"></button>
      <button data-a="prev" aria-label="Previous ayah"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button>
      <button data-a="stop" aria-label="Stop"><svg viewBox="0 0 24 24"><rect class="fill" x="7" y="7" width="10" height="10" rx="2"/></svg></button>
    </div>`;
  d.body.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) actions[b.dataset.a]?.(); });
  win.addEventListener('pagehide', cleanup);
  paintDoc();
}

function paintDoc() {
  const d = pip.win.document;
  d.getElementById('t').textContent = last.title || 'Bustan';
  d.getElementById('s').textContent = last.sub || '';
  d.getElementById('pp').innerHTML = last.playing
    ? '<svg viewBox="0 0 24 24"><rect class="fill" x="7" y="6" width="3.5" height="12" rx="1"/><rect class="fill" x="13.5" y="6" width="3.5" height="12" rx="1"/></svg>'
    : '<svg viewBox="0 0 24 24"><path class="fill" d="M8 5.5v13l11-6.5z"/></svg>';
}

// ---------- phone: a floating video window ----------
async function openVideo() {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 300;
  const ctx = canvas.getContext('2d');
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true;
  Object.assign(video.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', bottom: '0', left: '0' });
  document.body.append(video);
  pip = { kind: 'video', canvas, ctx, video };
  try { await document.fonts.load("600 64px 'Noto Naskh Arabic'"); } catch (e) { /* fine */ }
  paintCanvas();
  video.srcObject = canvas.captureStream(4);
  // keep frames flowing so the window never looks frozen
  pip.timer = setInterval(() => pip && paintCanvas(), 1000);
  await video.play();
  video.addEventListener('leavepictureinpicture', () => { clearInterval(pip?.timer); cleanup(); }, { once: true });
  await video.requestPictureInPicture();
}

function paintCanvas() {
  const { ctx, canvas } = pip; const W = canvas.width, H = canvas.height;
  const cs = getComputedStyle(document.documentElement);
  const c = (v, f) => (cs.getPropertyValue(v) || f).trim();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, c('--card', '#3a2d26')); g.addColorStop(1, c('--bg', '#2a201c'));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // little fairy lights along the top
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 70, y = 22 + Math.sin(i * 1.3) * 8;
    ctx.fillStyle = i % 2 ? '#ffd98f' : '#f3a6b5';
    ctx.globalAlpha = .55 + .45 * Math.abs(Math.sin(Date.now() / 900 + i));
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.direction = 'rtl';
  ctx.fillStyle = c('--ink', '#f4e6d4');
  // big and simple, so it still reads when the window is shrunk small
  ctx.font = "600 76px 'Noto Naskh Arabic', serif";
  ctx.fillText(last.title || 'Bustan', W / 2, H / 2 + 22, W - 50);
  ctx.direction = 'ltr';
  ctx.fillStyle = last.playing ? c('--soft', '#a99380') : c('--accent', '#eba96a');
  ctx.font = "700 30px Nunito, system-ui, sans-serif";
  const sub = (last.sub || '').split(' · ').slice(0, 2).join(' · ');
  ctx.fillText(last.playing ? sub : 'Paused', W / 2, H / 2 + 92, W - 50);
}
