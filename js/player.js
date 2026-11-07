// Recitation player with range + ayah looping.
// Two kinds of sources:
//  - "timed": one recording per surah plus per-ayah timings (mp3quran.net)
//  - "ayah":  one file per ayah (everyayah.com)
import { surah } from './data.js';

const pad3 = (n) => String(n).padStart(3, '0');

export const RECITERS = {
  sufi: {
    name: 'عبد الرشيد صوفي', en: 'Abdur-Rashid Sufi', kind: 'timed', read: 258,
    audio: (s) => `https://cdn.mp3quran.net/audio/abdulrasheed-sufi/r3/${pad3(s)}.mp3`,
  },
  talib: {
    name: 'أحمد طالب بن حميد', en: 'Ahmed bin Taleb', kind: 'timed', read: 137,
    audio: (s) => `https://cdn.mp3quran.net/audio/ahmad-humaid/r1/${pad3(s)}.mp3`,
    missing: [9, 14, 16, 17, 23, 24, 33],
  },
  shatri: {
    name: 'أبو بكر الشاطري', en: 'Abu Bakr Ash-Shatiri', kind: 'ayah',
    audio: (s, a) => `https://everyayah.com/data/Abu_Bakr_Ash-Shaatree_128kbps/${pad3(s)}${pad3(a)}.mp3`,
  },
};

const timingCache = new Map();
async function timings(rec, id, s) {
  const k = `${id}:${s}`;
  if (timingCache.has(k)) return timingCache.get(k);
  const urls = [
    `data/timings/${id}/${pad3(s)}.json`, // saved copy, made when the site is published
    `https://www.mp3quran.net/api/v3/ayat_timing?surah=${s}&read=${rec.read}`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const arr = await r.json();
      const map = {};
      for (const t of arr) map[t.ayah] = [t.start_time / 1000, t.end_time / 1000];
      if (Object.keys(map).length) { timingCache.set(k, map); return map; }
    } catch (e) { /* try next */ }
  }
  throw new Error('timings unavailable');
}

export class Player {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = null;
    this.playing = false;
    this.session = null;
    this._raf = null;
    this._tickTimer = null;
    this.audio.addEventListener('ended', () => this._onEnded());
    this.audio.addEventListener('error', () => this._fail('audio'));
  }

  // opts: { verses, reciter, ayahRepeat, rangeRepeat (0 = forever), speed, onAyah, onEnd, onTick, onState, onError, startIndex }
  async play(opts) {
    this.stop(true);
    const rec = RECITERS[opts.reciter] || RECITERS.sufi;
    let reciterId = opts.reciter in RECITERS ? opts.reciter : 'sufi';
    if (rec.missing && opts.verses.some(v => rec.missing.includes(v[0]))) {
      opts.onError?.(`${rec.en} has no recording of this surah, so Ash-Shatiri is reciting instead.`);
      reciterId = 'shatri';
    }
    this.session = {
      ...opts, reciterId, rec: RECITERS[reciterId], i: opts.startIndex || 0, rep: 0, round: 0,
      ayahRepeat: Math.max(1, opts.ayahRepeat || 1), rangeRepeat: opts.rangeRepeat ?? 1,
      token: Math.random(),
    };
    this.audio.playbackRate = opts.speed || 1;
    this.playing = true;
    this._startTicks();
    this._emitState();
    this._mediaSession();
    await this._go();
  }

  async _go(seamless = false) {
    const ss = this.session; if (!ss) return;
    const token = ss.token;
    const v = ss.verses[ss.i];
    ss.onAyah?.(v, ss.i);
    try {
      if (ss.rec.kind === 'ayah') {
        delete this.audio.dataset.src;
        this.audio.src = ss.rec.audio(v[0], v[1]);
        this.audio.playbackRate = ss.speed || 1;
        await this.audio.play();
      } else {
        const map = await timings(ss.rec, ss.reciterId, v[0]);
        if (token !== ss.token || this.session !== ss) return;
        let [start, end] = map[v[1]] || [0, 0];
        // At the start of a surah, include the basmala that opens the recording.
        if (v[1] === 1) start = 0;
        ss.end = end;
        const src = ss.rec.audio(v[0]);
        if (this.audio.dataset.src !== src) {
          this.audio.src = src;
          this.audio.dataset.src = src;
        }
        if (this.audio.readyState < 1) {
          await new Promise((res, rej) => {
            const ok = () => { cleanup(); res(); };
            const bad = () => { cleanup(); rej(new Error('audio')); };
            const cleanup = () => { this.audio.removeEventListener('loadedmetadata', ok); this.audio.removeEventListener('error', bad); };
            this.audio.addEventListener('loadedmetadata', ok);
            this.audio.addEventListener('error', bad);
          });
          if (token !== ss.token || this.session !== ss) return;
        }
        if (!seamless || Math.abs(this.audio.currentTime - start) > 0.6) this.audio.currentTime = start;
        this.audio.playbackRate = ss.speed || 1;
        if (this.audio.paused && this.playing) await this.audio.play();
        this._watch();
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      if (e?.name === 'NotAllowedError') { this.playing = false; this._emitState(); return; }
      if (ss.reciterId !== 'shatri') {
        ss.onError?.(`Couldn't load ${ss.rec.en} right now, so Ash-Shatiri is reciting instead.`);
        ss.reciterId = 'shatri'; ss.rec = RECITERS.shatri;
        return this._go();
      }
      this._fail('load');
    }
  }

  _watch() {
    cancelAnimationFrame(this._raf);
    const loop = () => {
      const ss = this.session;
      if (!ss || ss.rec.kind !== 'timed') return;
      if (this.playing && !this.audio.paused && ss.end && this.audio.currentTime >= ss.end - 0.08) {
        this._advance();
        return;
      }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  _onEnded() {
    const ss = this.session; if (!ss) return;
    this._advance();
  }

  _advance() {
    const ss = this.session; if (!ss) return;
    ss.rep++;
    if (ss.rep < ss.ayahRepeat) return this._go();
    ss.rep = 0;
    const prev = ss.verses[ss.i];
    ss.i++;
    if (ss.i >= ss.verses.length) {
      ss.round++;
      if (ss.rangeRepeat === 0 || ss.round < ss.rangeRepeat) { ss.i = 0; return this._go(); }
      const done = ss.onEnd;
      this.stop();
      done?.();
      return;
    }
    const next = ss.verses[ss.i];
    const seamless = ss.ayahRepeat === 1 && next[0] === prev[0] && next[1] === prev[1] + 1;
    this._go(seamless);
  }

  pause() {
    if (!this.session) return;
    this.playing = false; this.audio.pause(); this._emitState();
  }
  async resume() {
    if (!this.session) return;
    this.playing = true; this._emitState();
    try { await this.audio.play(); this._watch(); } catch (e) { this.playing = false; this._emitState(); }
  }
  toggle() { this.playing ? this.pause() : this.resume(); }
  skip(d) {
    const ss = this.session; if (!ss) return;
    ss.i = Math.max(0, Math.min(ss.verses.length - 1, ss.i + d)); ss.rep = 0; this._go();
  }
  setSpeed(x) { if (this.session) this.session.speed = x; this.audio.playbackRate = x; }

  stop(silent = false) {
    cancelAnimationFrame(this._raf);
    clearInterval(this._tickTimer);
    this.audio.pause();
    const had = !!this.session;
    this.session = null;
    this.playing = false;
    if (had && !silent) this._emitState();
    this._stateCb?.(false, null);
  }

  onState(cb) { this._stateCb = cb; }
  _emitState() {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = this.session ? (this.playing ? 'playing' : 'paused') : 'none';
    this._stateCb?.(this.playing, this.session); this.session?.onState?.(this.playing);
  }
  _fail(what) {
    const ss = this.session;
    if (!ss) return;
    if (what === 'audio' && ss.rec.kind === 'timed' && ss.reciterId !== 'shatri') {
      ss.onError?.(`Couldn't load ${ss.rec.en} right now, so Ash-Shatiri is reciting instead.`);
      ss.reciterId = 'shatri'; ss.rec = RECITERS.shatri; delete this.audio.dataset.src;
      return this._go();
    }
    ss.onError?.('The recitation could not load. Check your internet connection and try again.');
    this.stop();
  }
  _startTicks() {
    clearInterval(this._tickTimer);
    this._tickTimer = setInterval(() => {
      if (this.playing && !this.audio.paused) this.session?.onTick?.(1);
    }, 1000);
  }
  _mediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ss = this.session;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Bustan · ' + surah(ss.verses[0][0]).ar, artist: ss.rec.name, album: 'Bustan',
      });
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.skip(1));
      navigator.mediaSession.setActionHandler('previoustrack', () => this.skip(-1));
    } catch (e) { /* not supported */ }
  }
}
