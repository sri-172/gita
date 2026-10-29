#!/usr/bin/env python3
"""Assemble the single, self-contained index.html (no network needed at runtime)."""
import json, os, subprocess, tempfile, sys, gzip, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
NODE = shutil.which('node') or 'node'
def read(p):
    """Read a build input; large audio maps may be stored as .json.gz."""
    path = os.path.join(ROOT, p)
    if os.path.exists(path):
        return open(path, encoding='utf-8').read()
    gz = path + '.gz'
    if os.path.exists(gz):
        return gzip.open(gz, 'rt', encoding='utf-8').read()
    raise FileNotFoundError(p)

tpl = read('template.html')
fonts = read('assets/fonts-embedded.css')
data = read('gita-data.json')
app = read('app.js')
audio = read('audio-data.json')
tts = read('tts-audio.json')
ttsm = read('tts-meaning.json')
ttsfb = read('tts-fallback.json')

# Keep the JSON safe inside an inline <script> element.
data_js = (data.replace('</', '<\\/')
               .replace('\u2028', '\\u2028')
               .replace('\u2029', '\\u2029'))
app_js = app.replace('</script>', '<\\/script>')
audio_js = audio.replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
tts_js = tts.replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
ttsm_js = ttsm.replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
ttsfb_js = ttsfb.replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')

html = (tpl.replace('/*__FONTS__*/', fonts)
           .replace('/*__DATA__*/', data_js)
           .replace('/*__AUDIO__*/', audio_js)
           .replace('/*__TTS__*/', tts_js)
           .replace('/*__TTSM__*/', ttsm_js)
           .replace('/*__TTSFB__*/', ttsfb_js)
           .replace('/*__APP__*/', app_js))

out = os.path.join(ROOT, 'index.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)

# Syntax-check all inline scripts with Node.
with tempfile.TemporaryDirectory() as td:
    for name, src in [('data.js', 'window.GITA=' + data_js + ';'),
                      ('audio.js', 'window.GITA_AUDIO=' + audio_js + ';'),
                      ('tts.js', 'window.GITA_TTS=' + tts_js + ';'),
                      ('ttsm.js', 'window.GITA_TTSM=' + ttsm_js + ';'),
                      ('ttsfb.js', 'window.GITA_TTS_FB=' + ttsfb_js + ';'),
                      ('app.js', app_js)]:
        p = os.path.join(td, name)
        open(p, 'w', encoding='utf-8').write(src)
        r = subprocess.run([NODE, '--check', p], capture_output=True, text=True)
        print(name, 'syntax', 'OK' if r.returncode == 0 else 'FAIL')
        if r.returncode:
            print(r.stderr[:3000]); sys.exit(1)

print('index.html', os.path.getsize(out), 'bytes')
print('data', len(json.loads(data)['verses']), 'verses,', len(json.loads(data)['colophons']), 'colophons')
