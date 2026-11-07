// Saves per-ayah timings for the timed reciters into data/timings/<id>/NNN.json.
// Runs during publishing (GitHub Actions), so the site doesn't depend on the timing API at runtime.
import { mkdir, writeFile } from 'node:fs/promises';

const READS = { sufi: 258, talib: 137 };
const MISSING = { talib: [9, 14, 16, 17, 23, 24, 33] };
const pad = (n) => String(n).padStart(3, '0');

for (const [id, read] of Object.entries(READS)) {
  await mkdir(`data/timings/${id}`, { recursive: true });
  let ok = 0;
  for (let s = 1; s <= 114; s++) {
    if (MISSING[id]?.includes(s)) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(`https://www.mp3quran.net/api/v3/ayat_timing?surah=${s}&read=${read}`);
        if (!r.ok) throw new Error(r.status);
        const arr = await r.json();
        const slim = arr.map(t => ({ ayah: t.ayah, start_time: t.start_time, end_time: t.end_time }));
        await writeFile(`data/timings/${id}/${pad(s)}.json`, JSON.stringify(slim));
        ok++;
        break;
      } catch (e) {
        if (attempt === 2) console.warn(`timings ${id} ${s} failed: ${e.message}`);
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
      }
    }
  }
  console.log(`${id}: saved ${ok} surahs`);
}
