// The cozy room: rain on the window, the lamp, morning/night light, and soft rain sound.

export function applyTheme(setting) {
  const h = new Date().getHours();
  const mode = setting === 'auto' ? (h >= 6 && h < 18 ? 'morning' : 'night') : setting;
  document.documentElement.dataset.mode = mode;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = { night: '#2a201c', morning: '#f4ebdd', rose: '#f8e6e6' }[mode] || '#2a201c';
  return mode;
}

// Raindrops sliding down the window glass.
export function startRain(canvas) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  let drops = [], w = 0, h = 0, raf;
  const dpr = Math.min(2, devicePixelRatio || 1);
  function size() {
    const r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(w * h / 2600);
    drops = Array.from({ length: n }, () => drop(true));
  }
  function drop(anywhere) {
    return {
      x: Math.random() * w, y: anywhere ? Math.random() * h : -10,
      r: 0.8 + Math.random() * 2.2, v: 0.15 + Math.random() * 0.9, l: 4 + Math.random() * 18,
      streak: Math.random() < 0.35,
    };
  }
  function frame() {
    ctx.clearRect(0, 0, w, h);
    const night = document.documentElement.dataset.mode === 'night';
    ctx.fillStyle = night ? 'rgba(200,220,255,0.35)' : 'rgba(255,255,255,0.55)';
    ctx.strokeStyle = night ? 'rgba(200,220,255,0.18)' : 'rgba(255,255,255,0.35)';
    for (const d of drops) {
      if (d.streak) {
        d.y += d.v * 3;
        ctx.lineWidth = d.r * 0.6;
        ctx.beginPath(); ctx.moveTo(d.x, d.y - d.l); ctx.lineTo(d.x, d.y); ctx.stroke();
      } else if (Math.random() < 0.02) d.y += d.v * 6;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
      if (d.y > h + 20) Object.assign(d, drop(false));
    }
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  size();
  new ResizeObserver(size).observe(canvas);
  frame();
  return () => cancelAnimationFrame(raf);
}

// A soft crackling fire, made in the browser (no audio file needed).
let audioCtx = null, fireNode = null;
function fireBuffer(ctx) {
  const sr = ctx.sampleRate, secs = 14, len = sr * secs;
  const buf = ctx.createBuffer(2, len, sr);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  // warm low rumble (brown noise) with a slow, breathing swell
  let b = 0, swell = 0.5, target = 0.5;
  for (let i = 0; i < len; i++) {
    if (i % (sr >> 2) === 0) target = 0.35 + Math.random() * 0.5;
    swell += (target - swell) * 0.00004;
    b = (b + (Math.random() * 2 - 1) * 0.02) * 0.995;
    const v = b * 1.6 * swell;
    L[i] = v; R[i] = v * 0.94;
  }
  // crackles: tiny bright snaps, often in little clusters, plus the odd bigger pop
  const snap = (t, amp, ms, bright) => {
    const n = Math.floor(sr * ms / 1000), start = Math.floor(t * sr), pan = Math.random();
    let prev = 0;
    for (let k = 0; k < n && start + k < len; k++) {
      const w = Math.random() * 2 - 1;
      const hp = bright ? w - prev : w * 0.6 + prev * 0.4; prev = w;
      const v = hp * amp * Math.exp(-k / (n * 0.22));
      L[start + k] += v * (1 - pan * 0.5); R[start + k] += v * (0.5 + pan * 0.5);
    }
  };
  let t = 0.1;
  while (t < secs - 0.2) {
    const cluster = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 5) : 1;
    for (let c = 0; c < cluster; c++) snap(t + c * (0.01 + Math.random() * 0.05), 0.08 + Math.random() * 0.25, 2 + Math.random() * 10, true);
    if (Math.random() < 0.07) snap(t + 0.02, 0.35 + Math.random() * 0.3, 18 + Math.random() * 25, false);
    t += 0.04 + Math.random() * Math.random() * 0.6;
  }
  // smooth the loop seam
  const fade = Math.floor(sr * 0.6);
  for (let k = 0; k < fade; k++) {
    const a = k / fade;
    L[k] = L[k] * a + L[len - fade + k] * (1 - a);
    R[k] = R[k] * a + R[len - fade + k] * (1 - a);
  }
  return { buf, loopEnd: secs - 0.6 };
}

export function fireSound(on) {
  if (!on) {
    if (fireNode) {
      const n = fireNode; fireNode = null;
      n.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4);
      setTimeout(() => n.src.stop(), 1500);
    }
    return;
  }
  if (fireNode) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume();
  const { buf, loopEnd } = fireBuffer(audioCtx);
  const src = audioCtx.createBufferSource();
  src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = loopEnd;
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
  const gain = audioCtx.createGain(); gain.gain.value = 0;
  src.connect(lp).connect(gain).connect(audioCtx.destination);
  src.start();
  gain.gain.setTargetAtTime(0.5, audioCtx.currentTime, 0.8);
  fireNode = { src, gain };
}
