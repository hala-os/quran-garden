// The cozy room: rain on the window, the lamp, morning/night light, and soft rain sound.

export function applyTheme(setting) {
  const h = new Date().getHours();
  const mode = setting === 'auto' ? (h >= 6 && h < 18 ? 'morning' : 'night') : setting;
  document.documentElement.dataset.mode = mode;
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = mode === 'night' ? '#1b2330' : '#efe4d0';
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

// Gentle rain sound, made in the browser (no audio file needed).
let audioCtx = null, rainNode = null;
export function rainSound(on) {
  if (!on) {
    if (rainNode) { rainNode.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.4); const n = rainNode; setTimeout(() => n.src.stop(), 1500); rainNode = null; }
    return;
  }
  if (rainNode) return;
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume();
  const len = audioCtx.sampleRate * 4;
  const buf = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { // pink-ish noise
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046; b1 = 0.963 * b1 + white * 0.2965; b2 = 0.57 * b2 + white * 1.0526;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.06;
    }
  }
  const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
  const hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
  const gain = audioCtx.createGain(); gain.gain.value = 0;
  src.connect(hp).connect(lp).connect(gain).connect(audioCtx.destination);
  src.start();
  gain.gain.setTargetAtTime(0.35, audioCtx.currentTime, 0.8);
  rainNode = { src, gain };
}
