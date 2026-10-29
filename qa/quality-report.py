#!/usr/bin/env python3
"""Objective before/after quality report for the Telugu TTS clips."""
import json, base64, os, subprocess, tempfile, random, sys, gzip
import numpy as np, soundfile as sf

ROOT = '/home/user/gita'


def load(name):
    p = os.path.join(ROOT, name)
    if not os.path.exists(p):
        return json.load(gzip.open(p + '.gz', 'rt', encoding='utf-8'))
    return json.load(open(p, encoding='utf-8'))


neu = load('tts-audio.json')
neum = load('tts-meaning.json')
old = load('tts-fallback.json')


def analyse(uri, tmp, label):
    raw = base64.b64decode(uri.split(',')[1])
    ext = '.ogg' if uri.startswith('data:audio/ogg') else '.mp3'
    p = os.path.join(tmp, label + ext)
    open(p, 'wb').write(raw)
    a, sr = sf.read(p)
    if a.ndim > 1:
        a = a[:, 0]
    win = a * np.hanning(len(a))
    S = np.abs(np.fft.rfft(win))
    f = np.fft.rfftfreq(len(a), 1 / sr)
    hi = S[f > 4000].sum() / S.sum()
    p99 = f[np.searchsorted(np.cumsum(S), .99 * S.sum())]
    bps = len(raw) * 8 / (len(a) / sr)
    return dict(sr=sr, dur=len(a) / sr, rms=float(np.sqrt(np.mean(a * a))),
                peak=float(np.max(np.abs(a))), hi=hi, p99=p99, kbps=bps / 1000,
                size=len(raw))


tmp = tempfile.mkdtemp()
rng = random.Random(19)
keys = rng.sample(list(neu), 40)


def avg(rows, k):
    return sum(r[k] for r in rows) / len(rows)


newrows = [analyse(neu[k], tmp, 'n%d' % i) for i, k in enumerate(keys)]
oldrows = [analyse(old[k], tmp, 'o%d' % i) for i, k in enumerate(keys)]
meanrows = [analyse(neum[k], tmp, 'm%d' % i) for i, k in enumerate(keys)]

print('=== 40 random verses: BEFORE (eSpeak MP3) vs AFTER (Piper neural Opus) ===')
for k, unit in [('kbps', 'kbps'), ('sr', 'Hz'), ('dur', 's'), ('rms', ''),
                ('peak', ''), ('hi', '% >4kHz'), ('p99', 'Hz')]:
    o, n = avg(oldrows, k), avg(newrows, k)
    mult = 100 if k == 'hi' else 1
    print(f'  {k:6s}  before {o*mult:9.3f}   after {n*mult:9.3f}   '
          f'{"+" if n >= o else ""}{(n-o)/o*100:6.1f}%')

print('\n=== maps ===')
for name, fn, d in [('tts-audio.json (neural shloka)', 'tts-audio.json', neu),
                    ('tts-meaning.json (neural meaning)', 'tts-meaning.json', neum),
                    ('tts-fallback.json (old MP3)', 'tts-fallback.json', old)]:
    sizes = [len(v) for v in d.values()]
    fp = os.path.join(ROOT, fn)
    if not os.path.exists(fp): fp += '.gz'
    print(f'  {name:42s} {len(d):4d} clips  file {os.path.getsize(fp)/1e6:.2f} MB  '
          f'min {min(sizes)} max {max(sizes)} chars')

print('\n=== integrity: decode every clip (ffmpeg) ===')
bad = []
for name, d in [('shloka', neu), ('meaning', neum)]:
    for i, (k, v) in enumerate(d.items()):
        p = os.path.join(tmp, 'chk.' + ('ogg' if v.startswith('data:audio/ogg') else 'mp3'))
        open(p, 'wb').write(base64.b64decode(v.split(',')[1]))
        r = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'null', '-'],
                           capture_output=True, text=True)
        if r.returncode != 0 or r.stderr.strip():
            bad.append((name, k, r.stderr.strip()[:80]))
    print(f'  {name}: {len(d)} decoded, {len([b for b in bad if b[0]==name])} failures')
print('  TOTAL FAILURES:', len(bad))
for b in bad[:10]:
    print('   ', b)
sys.exit(1 if bad else 0)
