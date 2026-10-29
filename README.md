# భగవద్గీత · Gītā (Telugu)

A complete, **offline-first interactive Telugu Bhagavad Gita website**.
One self-contained `index.html` contains the whole text, both fonts,
**1,410 Telugu audio clips** and all the code. No server, no CDN, no network
calls at runtime.

Open **`index.html`** in any modern browser — or use the live preview on port 8080.

---

## On GitHub

The repository is set up for **GitHub Pages**: `index.html` sits at the repo
root and `.nojekyll` stops Jekyll from rewriting it.

1. Push (from your machine): `./push-to-github.sh https://github.com/USER/REPO.git`
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save.**
3. The site appears at `https://USER.github.io/REPO/`.

`index.html` is ~55 MB, under GitHub's 100 MB per-file limit (GitHub will show
a >50 MB warning — that is expected). The whole repository is ~110 MB. See
[NOTICE.md](NOTICE.md) before making the repo public.

---

## The Telugu edition

- **Sanskrit (Devanagari) text has been replaced everywhere** by Telugu.
  The verse itself is the traditional Sanskrit shloka written in **Telugu lipi**
  (e.g. BG 2.47 → `కర్మణ్యేవాధికారస్తే మా ఫలేషు కదాచన …`).
  There is not a single Devanagari character left in the data bundle.
- A **Telugu translation** (తెలుగు అనువాదం) is now a first-class translation,
  shown by default. The header language button cycles
  `EN → తె → EN+` (English / Telugu / both).
- **Telugu commentary** (తెలుగు వ్యాఖ్య), Telugu chapter names, meanings,
  summaries, Telugu-script word meanings, Telugu speaker names and Telugu
  colophons replace the previous Hindi layer.
- **Every verse has clear, audible Telugu audio, entirely offline.** See below.

---

## Audio — a neural Telugu voice for every verse

There were two rounds of audio fixes:

1. **Silence.** The first build relied on the browser's `speechSynthesis` for
   693 of the 701 verses. Most devices have no installed Telugu voice, so those
   verses played nothing. That was fixed by embedding a clip for every verse.
2. **Bad quality.** Those first embedded clips used eSpeak NG's robotic formant
   voice and — because `-b:a 12k` is not a legal MPEG-2 Layer III bitrate at
   16 kHz — LAME silently clamped them to **8 kbps**, making them muffled and
   unclear. They have been replaced with a **neural Telugu voice**.

| Layer | Count | What it is |
|---|---|---|
| **Studio Telugu narration** | 8 | 32 kbps MP3 recitations (BG 1.1, 2.47, 4.7, 6.5, 9.22, 11.32, 12.12, 18.66), base64-embedded. |
| **Neural Telugu shloka** | 701 | One Ogg/Opus clip per verse, 20 kbps, from Piper `te_IN-padmavathi-medium` (VITS, trained on ai4bharat IndicVoices). |
| **Neural Telugu meaning** | 701 | One Ogg/Opus clip per verse for the అర్థం button, 16 kbps. |
| **MP3 compatibility fallback** | 701 | The older eSpeak shloka clips, used only if a browser cannot play Opus. |
| **Browser Telugu voice** | optional | `speechSynthesis` at `lang="te-IN"`, only if you explicitly choose Browser mode. |

All clips are `data:…;base64,…` URIs inside `index.html`. Playback goes through
a **visible native `<audio controls>` player** docked bottom-left (above the nav
on mobile), so there is always a real ▶ button, volume and seek — this works
inside restrictive `sandbox="allow-scripts"` iframes, from `file://`, and with
no OS language pack and no internet.

### What makes the new clips clearer

- **Neural instead of formant synthesis** — real human voice characteristics
  rather than eSpeak's buzzy robotic tone.
- **20 kbps Opus at 24 kHz instead of 8 kbps MP3 at 16 kHz** — measured
  99%-energy bandwidth rose from ~5.1 kHz to ~6.8 kHz, and >4 kHz detail from
  ~5% to ~8% of total energy.
- **Natural pace** — `length_scale 0.95` instead of eSpeak's 215 wpm rush;
  BG 1.1 now takes ~7.5 s rather than 5.2 s.
- **Loudness normalisation** — every clip is RMS-normalised to ≈0.10 with a
  0.95 peak ceiling and trimmed of leading/trailing silence, so no verse is
  quiet or clipped.

**Audio modes** (♪ accordion in the reader):

- **✦ Auto** *(default)* — studio clip where one exists, neural Telugu otherwise.
- **Neural Telugu** — always the embedded shloka clip, even for studio verses.
- **Browser Telugu voice** — the old `speechSynthesis` path, for devices that
  have a good installed `te-IN` voice.

The **Chant** button keeps reading verse after verse. Keyboard `L` = listen.

> Opus is supported by Chrome, Edge, Firefox and Safari 18.4+. On a browser
> that reports no Opus support (`canPlayType`), shloka playback automatically
> switches to the embedded MP3 fallback; the అర్థం button falls back to browser
> TTS. Runtime `canPlayType` detection means no silent verses.

---

## Contents

| | |
|---|---|
| **18 chapters** | Telugu name, meaning, English/Telugu summaries, essence, key verse |
| **701 verses** | Telugu-script shloka + IAST transliteration + Telugu speaker |
| **7 translations** | 6 English (Sivananda, Purohit Swami, Adidevananda, Gambirananda, Sankaranarayan, Prabhupada) + 1 Telugu (Wikisource) |
| **Word meanings** | 692 verses, Sanskrit headwords in Telugu script + English gloss |
| **3 commentaries** | Sivananda (EN), Prabhupada purport (EN), Telugu commentary (TE), plus Telugu context notes for 22 verses |
| **18 colophons** | "Thus ends chapter…" in Telugu script |
| **1,410 audio clips** | 701 shlokas + 701 meanings + 8 studio narrations |

Long commentaries are excerpted (≈1,400–1,900 characters) for speed; the full
sources are in `src-data.tar.gz` if you want to raise the limit in `build_data.py`.

> The traditional count is 700 verses; this recension numbers 701 (an extra
> verse in Chapter 1). All 701 are included.

---

## The experience

Living mandala hero, starfield, an 18-chapter wheel, a **701-star galaxy**
(one spiral arm per chapter, hover for a preview / click to open), verse of the
day, 20 famous verses, 12 auto-indexed themes (with Telugu names), a reading
journey with progress/streak, a 10-question quiz, bookmarks, light/dark mode,
focus mode, font-size controls, copy/share, keyboard shortcuts, and full
Telugu search (`Ctrl/⌘ K` or `/`; try `కర్మ`, `ధర్మం`, `భక్తి`, or `2.47`).

Keyboard: `←/→` verses · `B` bookmark · `L` listen (Telugu) · `F` focus ·
`R` random verse · `?` shortcuts · `Esc` close.

The ambient drone is instrumental and unchanged.

---

## Files

```
index.html            ← THE WEBSITE. Self-contained. Ship this one file.
preview.png           ← a screenshot of the home page (player visible)
README.md             ← this file
template.html         ← HTML shell + CSS design system + placeholder tokens
app.js                ← router, views, search, Telugu audio engine, canvas art
gita-data.json        ← distilled dataset (~4.3 MB)
audio-data.json       ← 8 base64 studio Telugu MP3 clips (~1.1 MB)
tts-audio.json.gz     ← 701 base64 neural shloka Opus clips (~16 MB gz)
tts-meaning.json.gz   ← 701 base64 neural meaning Opus clips (~16 MB gz)
tts-fallback.json.gz  ← 701 old eSpeak MP3 shloka clips (Opus-less browsers)
audio-before-after.ogg← 21 s BG 2.47: old eSpeak clip, pause, new neural clip
audio/*.mp3           ← the 8 source studio clips
audio-texts.json      ← the Telugu scripts used for the studio clips
build.py              ← inlines fonts + data + audio + TTS + app into index.html
build_data.py         ← turns src/*.json into gita-data.json
build_tts.py          ← regenerates both neural TTS maps (Piper + ffmpeg)
transliterate.py      ← Devanagari → Telugu script converter (metadata)
assets/
  fonts-embedded.css  ← base64 woff2: Cormorant Garamond, Manrope,
                        Noto Serif Telugu, Noto Serif Devanagari
src-data.tar.gz       ← source corpora (extract to `src/` before rebuilding)
qa/quality-report.py  ← objective before/after audio comparison + integrity check
```

The three large audio maps are stored gzipped to keep the workspace small;
`build.py` transparently reads either `name.json` or `name.json.gz`.

### Rebuild

```bash
python3 build.py        # regenerate index.html from the committed (gzipped) maps
```

Regenerating the underlying data or audio is optional:

```bash
tar xzf src-data.tar.gz                 # restores src/
python3 build_data.py                   # regenerate gita-data.json

# Neural TTS (only if you want to change voice / bitrate)
pip install piper-tts numpy
mkdir -p ~/piper-voices && cd ~/piper-voices
# download te_IN-padmavathi-medium.onnx + .onnx.json from
# https://huggingface.co/rhasspy/piper-voices/tree/main/te/te_IN/padmavathi/medium
apt install ffmpeg
python3 build_tts.py                    # ~25 min on 2 CPU cores; checkpoints
GITA_TTS_WORKERS=2 python3 build_tts.py   # only on machines with >4 GB RAM
# build_tts.py writes uncompressed .json files, which build.py prefers;
# gzip -9 them and delete the plain copies to keep the workspace small.
python3 build.py
python3 -m http.server 8080 --bind 0.0.0.0 --directory .   # optional preview
```

`build_tts.py` writes a `tts-progress.jsonl` checkpoint after every clip and
resumes from it if interrupted. The studio clips are already baked into
`audio-data.json`; you do not need the speech tool to rebuild.

---

## Verification

Tested in real Chromium (Playwright) with the browser's default autoplay
policy, as a normal page, inside a `sandbox="allow-scripts"` iframe, and from
`file://`:

- Shloka (with and without a studio clip), Telugu meaning, last verse, home
  daily card, Neural-only mode and the MP3-compat path all produce
  `paused:false`, advancing `currentTime`, `readyState:4`, `volume:1`,
  `muted:false`, `error:null`.
- Every one of the 1,402 neural clips decodes with ffmpeg; decoded signal
  RMS ≈ 0.10 and peak ≈ 0.67 — real speech, not silence.
- `speechSynthesis.getVoices().length === 0` in the test browser, so audio is
  proven to work **without** any system Telugu voice.
- All 11 routes render, chant mode advances, 0 console/page errors,
  0 external scripts/stylesheets/images.
- Objective before/after comparison: `python3 qa/quality-report.py` reports
  bitrate, bandwidth, >4 kHz energy, duration, RMS and peak for 40 random
  verses, and decodes all 1,402 neural clips. Measured: bitrate +133%,
  sample rate +50%, 99%-energy bandwidth +29%, >4 kHz detail +65%.

---

## Credits & licences

- **Scripture + English translations + English commentaries:**
  [vedicscriptures/bhagavad-gita](https://github.com/vedicscriptures/bhagavad-gita),
  **GPL-3.0** (`src/LICENSE-GPL-3.0.txt`). Because `index.html` embeds a derived
  selection, GPL-3.0 obligations apply if you redistribute the built file.
- **Telugu shlokas, Telugu translations, Telugu chapter metadata:**
  [te.wikisource.org — భగవద్గీత తెలుగు అనువాదము](https://te.wikisource.org/),
  **CC BY-SA 4.0**, obtained via
  [nvkudva/Bhagavad-Geeta](https://github.com/nvkudva/Bhagavad-Geeta)
  (`src/telugu/`). That upstream repo states "No licence file yet — all rights
  reserved" for its own code/compilation; the underlying Wikisource text is
  CC BY-SA 4.0. Attribution is shown in the site footer. **If you publish this
  commercially, review both upstream licence statements.**
- **Telugu commentary** is a machine translation (IndicTrans2, ai4bharat) of an
  English commentary, as recorded in `commentary_telugu_source`.
- **Fonts:** Cormorant Garamond, Manrope, Noto Serif Telugu, Noto Serif
  Devanagari (Google Fonts), **SIL Open Font License 1.1**, embedded as woff2.
- **Neural Telugu voice:** [Piper](https://github.com/OHF-Voice/piper1-gpl)
  `te_IN-padmavathi-medium` from
  [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices), trained
  on [ai4bharat/indicvoices_r](https://huggingface.co/datasets/ai4bharat/indicvoices_r),
  **CC BY 4.0**. Only the synthesised waveforms are shipped; no model or code
  is embedded in `index.html`.
- **Compatibility fallback voice:** [eSpeak NG](https://github.com/espeak-ng/espeak-ng)
  **GPL-3.0**, Telugu voice `te`.
- **Studio Telugu voice** was generated by Arena's speech tool from the Telugu
  scripts in `audio-texts.json`.

Made for stillness. ఓం
