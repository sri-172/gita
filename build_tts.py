#!/usr/bin/env python3
"""Generate HIGH-QUALITY offline Telugu TTS clips for all 701 verses.

Uses Piper's neural Telugu voice (te_IN-padmavathi-medium, CC BY 4.0) instead
of eSpeak NG's robotic formant voice. Output is Ogg/Opus, which is both smaller
and much clearer at a given bitrate than the old 8 kbps MP3 clips.

Build requirements (only needed to REGENERATE, not to use index.html):

    pip install piper-tts numpy
    # download the voice (61 MB) + its .json config into ~/piper-voices/
    https://huggingface.co/rhasspy/piper-voices/tree/main/te/te_IN/padmavathi/medium
    apt install ffmpeg
    python3 build_tts.py

Outputs (base64 data URIs, inlined by build.py):
    tts-audio.json    701 neural shloka clips   (data:audio/ogg;codecs=opus;base64,...)
    tts-meaning.json  701 neural meaning clips  (same)

The old eSpeak MP3 clips are kept in tts-fallback*.json and embedded too, so a
browser without Opus support can still play every shloka.
"""
import json, os, re, base64, subprocess, sys, tempfile, wave, shutil
import multiprocessing as mp
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'gita-data.json')
OUT = os.path.join(ROOT, 'tts-audio.json')
OUT_MEAN = os.path.join(ROOT, 'tts-meaning.json')
PROGRESS = os.path.join(ROOT, 'tts-progress.jsonl')
WORKERS = int(os.environ.get('GITA_TTS_WORKERS', '1'))

MODEL_CANDIDATES = [
    os.path.expanduser('~/piper-voices/te_IN-padmavathi-medium.onnx'),
    '/home/user/piper-voices/te_IN-padmavathi-medium.onnx',
]
MODEL = next((p for p in MODEL_CANDIDATES if os.path.exists(p)), None)

SR = 22050
LENGTH_SCALE = 0.95     # slightly brisker than default, still clear
BIT_SHLOKA = '20k'      # Opus CBR-ish target; ~20 kbps mono speech
BIT_MEANING = '16k'
TARGET_RMS = 0.10       # consistent loudness (~-20 dBFS), matches studio clips
PEAK_LIMIT = 0.95
MIME = 'data:audio/ogg;codecs=opus;base64,'

_VOICE = None
_CFG = None
_TMP = None


def clean(s):
    """Normalise the visible verse text into something a TTS can read well."""
    s = str(s or '')
    s = s.replace('|', ' ').replace('\n', ' ')
    s = re.sub(r'[\u0c66-\u0c6f]', '', s)          # Telugu digits (verse numbers)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def init_worker(tmpdir):
    global _VOICE, _CFG, _TMP
    # A single worker can use both cores; two workers exhaust this 2 GB box.
    os.environ['OMP_NUM_THREADS'] = '2' if WORKERS == 1 else '1'
    os.environ['OPENBLAS_NUM_THREADS'] = '1'
    from piper import PiperVoice
    from piper.config import SynthesisConfig
    _VOICE = PiperVoice.load(MODEL)
    _CFG = SynthesisConfig(length_scale=LENGTH_SCALE, noise_scale=0.5,
                           noise_w_scale=0.7, normalize_audio=True, volume=1.0)
    _TMP = tmpdir


def render(item):
    key, kind, text, bitrate = item
    if not text:
        return key, kind, None, 0
    chunks = list(_VOICE.synthesize(text, syn_config=_CFG))
    if not chunks:
        return key, kind, None, 0
    a = np.concatenate([c.audio_float_array for c in chunks]).astype(np.float32)

    # Trim leading/trailing silence but keep natural padding.
    nz = np.flatnonzero(np.abs(a) > 0.012)
    if nz.size:
        a = a[max(0, int(nz[0]) - int(SR * .07)): min(len(a), int(nz[-1]) + int(SR * .28))]

    # Loudness normalise so quiet verses don't sound "far away".
    peak = float(np.max(np.abs(a))) or 1.0
    rms = float(np.sqrt(np.mean(a * a))) or 1.0
    a = a * min(TARGET_RMS / rms, PEAK_LIMIT / peak)
    pcm = (np.clip(a, -1, 1) * 32767).astype('<i2')

    wav = os.path.join(_TMP, f'{key.replace(".", "_")}_{kind}.wav')
    ogg = os.path.join(_TMP, f'{key.replace(".", "_")}_{kind}.ogg')
    with wave.open(wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-v', 'error', '-i', wav,
                    '-c:a', 'libopus', '-b:a', bitrate, '-application', 'audio',
                    '-ac', '1', ogg, '-y'], check=True, capture_output=True)
    raw = open(ogg, 'rb').read()
    os.remove(wav); os.remove(ogg)
    return key, kind, MIME + base64.b64encode(raw).decode(), len(raw)


def meaning_of(v):
    arr = v[6] if isinstance(v[6], list) else [v[6]]
    return clean(next((x for x in arr if x and str(x).strip()), ''))


def main():
    if not MODEL:
        sys.exit('ERROR: Piper Telugu model not found. See docstring for download.')
    if not shutil.which('ffmpeg'):
        sys.exit('ERROR: ffmpeg not found (apt install ffmpeg).')
    verses = json.load(open(DATA, encoding='utf-8'))['verses']
    items = []
    for v in verses:
        key = f'{v[0]}.{v[1]}'
        items.append((key, 's', clean(v[2]), BIT_SHLOKA))
        items.append((key, 'm', meaning_of(v), BIT_MEANING))
    print(f'Generating {len(items)} neural Telugu clips with {MODEL}', flush=True)

    # Resume support: every finished clip is appended to a JSONL checkpoint.
    shloka, meaning = {}, {}
    if os.path.exists(PROGRESS):
        with open(PROGRESS, encoding='utf-8') as f:
            for line in f:
                try:
                    r = json.loads(line)
                    (shloka if r['kind'] == 's' else meaning)[r['key']] = r['uri']
                except Exception:
                    pass
        print(f'Resuming: {len(shloka)} shloka + {len(meaning)} meaning clips cached', flush=True)
    items = [it for it in items if it[1] == 's' and it[0] not in shloka
             or it[1] == 'm' and it[0] not in meaning]
    print(f'{len(items)} clips remaining, {WORKERS} worker(s)', flush=True)

    tmp = tempfile.mkdtemp(prefix='gita-neural-')
    done = 0
    try:
        with open(PROGRESS, 'a', encoding='utf-8') as ck, \
             mp.Pool(WORKERS, initializer=init_worker, initargs=(tmp,)) as pool:
            for key, kind, uri, size in pool.imap_unordered(render, items, chunksize=1):
                if uri:
                    (shloka if kind == 's' else meaning)[key] = uri
                    ck.write(json.dumps({'key': key, 'kind': kind, 'uri': uri},
                                        ensure_ascii=False, separators=(',', ':')) + '\n')
                    ck.flush()
                done += 1
                if done % 100 == 0:
                    print(f'  {done}/{len(items)}  cached {len(shloka)}+{len(meaning)}', flush=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    for path, d in ((OUT, shloka), (OUT_MEAN, meaning)):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, separators=(',', ':'))
        print(f'{os.path.basename(path)}: {len(d)} clips, {os.path.getsize(path)/1e6:.2f} MB', flush=True)
    os.remove(PROGRESS)
    print('DONE', flush=True)


if __name__ == '__main__':
    main()
