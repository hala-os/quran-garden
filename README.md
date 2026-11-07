# Bustan · بستان

A cozy, personal place to memorize and review the Quran: a rainy-night study nook with a Madinah mushaf, range looping, and a gentle planner that never lets review pile up.

**Live site:** https://hala-os.github.io/quran-garden/

## What's in step 1
- **Today:** one small list sized to your daily time: new pages, pages that are settling, and older pages picked by spaced repetition (rate each one Strong, Okay or Shaky). Missed days never turn into a backlog.
- **Mushaf:** the 604-page Madinah mushaf (Hafs) with two-page spreads on wide screens. Tap any ayah for Tafsir As-Sa'di, to play from it, or to loop it.
- **Range looping:** loop pages with one bridge ayah before and after, repeat each ayah and the whole range, change speed and reciter.
- **Settings:** daily time, new-page days, reciter, theme, rain sound, which pages are memorized or sleeping seeds, and backups.

## Sources
- Mushaf layout: the classic Madinah mushaf, line for line, from [mushaf-layout](https://github.com/zonetecde/mushaf-layout), rendered with the King Fahd Complex QPC V2 page fonts. Surah headers and basmala use the QCF4 ornament font from [quran-qcf4](https://github.com/MohamadHajjRabee/quran-qcf4). Fonts and layouts load from CDNs and are not re-hosted here.
- Tafsir As-Sa'di: [spa5k/tafsir_api](https://github.com/spa5k/tafsir_api)
- Recitations: Abdur-Rashid Sufi and Ahmed bin Taleb from [mp3quran.net](https://mp3quran.net) (with per-ayah timings), Abu Bakr Ash-Shatiri from [everyayah.com](https://everyayah.com)

## How it runs
Plain HTML, CSS and JavaScript with no build step, published by GitHub Pages. Progress is saved in your browser. The publish workflow also saves the recitation timings into `data/timings/`.

To run it locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
