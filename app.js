/* =========================================================================
   భగవద్గీత — an offline, interactive Telugu Bhagavad Gita
   Data: 701 Telugu-script verses + 18 colophons, 7 translations, Telugu audio.
   ========================================================================= */
(() => {
'use strict';
const G = window.GITA;
const AUDIO = window.GITA_AUDIO || {};
const TTS = window.GITA_TTS || {};        // offline Telugu TTS clip for every verse
const TTSM = window.GITA_TTSM || {};     // offline neural Telugu clip of the prose meaning
const TTSFB = window.GITA_TTS_FB || {};    // MP3 fallback for browsers without Opus
const CAN_OPUS = (() => { try { return !!document.createElement('audio')
  .canPlayType('audio/ogg; codecs="opus"'); } catch (e) { return false; } })();
const hasTTS = (c, v) => !!TTS[audioKey(c, v)];
const AUDIO_LANG = G.audioLang || 'te-IN';
const V = G.verses, C = G.chapters, TOTAL = V.length;
const audioKey = (c, v) => c + '.' + v;
const hasStudio = (c, v) => !!AUDIO[audioKey(c, v)];
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Fold only Latin/IAST diacritics — NFD would corrupt Telugu vowel signs.
const LATIN_FOLD = {'ā':'a','ī':'i','ū':'u','ṛ':'r','ṝ':'r','ḷ':'l','ḹ':'l','ṅ':'n','ñ':'n',
                    'ṭ':'t','ḍ':'d','ṇ':'n','ś':'s','ṣ':'s','ḥ':'h','ṃ':'m','ṁ':'m','ō':'o','ē':'e'};
const fold = s => String(s || '').toLowerCase().replace(/[^\x00-\x7f]/g, c => LATIN_FOLD[c] || c);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* ---------- indexes ---------- */
const firstIdx = {}, chapCount = {};
V.forEach((x, i) => { if (!(x[0] in firstIdx)) firstIdx[x[0]] = i; chapCount[x[0]] = (chapCount[x[0]] || 0) + 1; });
const verseAt = (c, v) => V[firstIdx[c] + v - 1] || null;
const idxOf = (c, v) => (verseAt(c, v) ? firstIdx[c] + v - 1 : -1);
const keyOf = i => V[i][0] + '.' + V[i][1];
const firstLine = s => String(s || '').split('\n')[0];

const SPEAKER = {
  'శ్రీ భగవానుడు': ['Krishna', 'శ్రీ భగవానుడు'],
  'అర్జునుడు': ['Arjuna', 'అర్జునుడు'],
  'సంజయుడు': ['Sanjaya', 'సంజయుడు'],
  'ధృతరాష్ట్రుడు': ['Dhritarashtra', 'ధృతరాష్ట్రుడు'],
};
const EN_SHORT = ['Sivananda', 'Purohit Swami', 'Adidevananda', 'Gambirananda', 'Sankaranarayan', 'Prabhupada'];
const TE_SHORT = G.teShort || ['వికీసోర్స్'];

/* ---------- persistence ---------- */
const LS = (k, d) => { try { const x = localStorage.getItem('gita.' + k); return x === null ? d : JSON.parse(x); } catch (e) { return d; } };
const SAVE = (k, v) => { try { localStorage.setItem('gita.' + k, JSON.stringify(v)); } catch (e) {} };
const S = {
  lang: LS('lang', 'te'), light: LS('light', false), enIdx: LS('enIdx', 0), teIdx: LS('teIdx', 0),
  audioMode: LS('audioMode', 'auto'), rate: LS('rate', .85), voiceURI: LS('voiceURI', ''), studioPlaying: false,
  scale: LS('scale', 1), bookmarks: new Set(LS('bm', [])), read: new Set(LS('read', [])), days: new Set(LS('days', [])),
  last: LS('last', [1, 1]), selectedTheme: LS('theme', 'karma'),
  view: 'home', c: 1, v: 1, q: '', themeLimit: 42,
  showTranslit: true, focus: false, ambient: false, chant: false, speaking: false,
  quiz: { i: 0, score: 0, answered: null, done: false },
  paletteOpen: false, paletteSel: 0, paletteHits: [], pageHits: [], wheelC: 1, menuOpen: false,
};
if (!['en', 'te', 'both'].includes(S.lang)) S.lang = 'te';
if (!['auto', 'tts', 'browser'].includes(S.audioMode)) S.audioMode = 'auto';
function persist() {
  SAVE('lang', S.lang); SAVE('light', S.light); SAVE('enIdx', S.enIdx); SAVE('teIdx', S.teIdx);
  SAVE('audioMode', S.audioMode); SAVE('rate', S.rate); SAVE('voiceURI', S.voiceURI);
  SAVE('scale', S.scale); SAVE('bm', [...S.bookmarks]); SAVE('read', [...S.read]);
  SAVE('days', [...S.days]); SAVE('last', S.last); SAVE('theme', S.selectedTheme);
}
const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
S.days.add(todayKey());
function streak() {
  let n = 0; const d = new Date();
  for (;;) {
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    if (!S.days.has(k)) break;
    n++; d.setDate(d.getDate() - 1);
    if (n > 400) break;
  }
  return n;
}
const dailyVerse = (() => {
  const d = new Date(), seed = d.getFullYear() * 1000 + (d.getMonth() + 1) * 40 + d.getDate();
  return V[((seed * 2654435761) >>> 0) % TOTAL];
})();

/* ---------- icons ---------- */
const ICON = {
  arrowL: '<path d="M15 18l-6-6 6-6"/>', arrowR: '<path d="M9 18l6-6-6-6"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4V3z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  focus: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  om: '<circle cx="12" cy="12" r="9"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7M12 17h.01"/>',
  sparkle: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/>',
};
const svg = (name, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ''}</svg>`;

/* ---------- theme + search index (lazy) ---------- */
let themeIndex = null, verseThemeMap = null, searchDocs = null;
function buildThemeIndex() {
  if (themeIndex) return;
  themeIndex = {}; verseThemeMap = {};
  G.themes.forEach(t => {
    const arr = [];
    const words = t.words.map(fold);
    V.forEach((v, i) => {
      const text = fold(v[5].join(' ') + ' ' + v[3] + ' ' + C[v[0] - 1].meaningEn);
      let sc = 0;
      words.forEach(w => { let p = 0; while ((p = text.indexOf(w, p)) !== -1) { sc++; p += w.length; } });
      if (sc > 0) { arr.push([i, sc]); (verseThemeMap[i] = verseThemeMap[i] || []).push([t.id, sc]); }
    });
    arr.sort((a, b) => b[1] - a[1]);
    themeIndex[t.id] = arr;
  });
  Object.keys(verseThemeMap).forEach(k => verseThemeMap[k].sort((a, b) => b[1] - a[1]));
}
function buildSearch() {
  if (searchDocs) return;
  searchDocs = V.map(v => fold([v[2], v[3], v[4], v[5].join(' '), v[6].join(' '),
    C[v[0] - 1].sk, C[v[0] - 1].en, C[v[0] - 1].meaningEn, 'bg ' + v[0] + '.' + v[1]].join(' ')));
}
function search(q, limit = 60) {
  const raw = fold(String(q || '').trim());
  if (!raw) return [];
  buildSearch();
  const terms = raw.split(/\s+/).filter(Boolean);
  const ref = raw.match(/(?:bg\s*)?(\d{1,2})\s*[.\s:]\s*(\d{1,3})/);
  const out = [];
  for (let i = 0; i < TOTAL; i++) {
    const v = V[i], doc = searchDocs[i];
    let sc = 0, ok = true;
    for (const t of terms) {
      const p = doc.indexOf(t);
      if (p === -1) { ok = false; break; }
      sc += 10 + Math.max(0, 6 - Math.floor(p / 220));
      let n = 0, pos = 0; while ((pos = doc.indexOf(t, pos)) !== -1 && n < 6) { sc += 1; pos += t.length; n++; }
    }
    if (ref) {
      const c = +ref[1], vv = +ref[2];
      if (c === v[0] && vv === v[1]) sc += 500;
      if (c === v[0]) sc += 2;
    }
    if (!ref && !ok) {
      if (fold(C[v[0] - 1].en).includes(raw) || fold(C[v[0] - 1].meaningEn).includes(raw)) sc = 3;
      else continue;
    }
    if (sc > 0) out.push([i, sc]);
  }
  out.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  return out.slice(0, limit).map(x => x[0]);
}
function hl(text, q) {
  const terms = fold(q || '').split(/\s+/).filter(x => x.length > 1).slice(0, 4).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  let out = esc(text || '');
  if (!terms.length) return out;
  try { out = out.replace(new RegExp('(' + terms.join('|') + ')', 'gi'), '<mark>$1</mark>'); } catch (e) {}
  return out;
}
function enText(v) { return v[5][S.enIdx] || v[5].find(Boolean) || v[5][5] || ''; }
function teText(v) { return v[6][S.teIdx] || v[6].find(Boolean) || ''; }
function cleanForSpeech(s) {
  return String(s || '')
    .replace(/\|\|[^|]*\|\|/g, '.').replace(/\|\|/g, ',').replace(/\|/g, ',')
    .replace(/[\u0c66-\u0c6f]/g, '')
    .replace(/\n/g, ', ').replace(/\s+/g, ' ').trim();
}
function teluguVoices() {
  try { return (window.speechSynthesis ? window.speechSynthesis.getVoices() : [])
    .filter(v => /^te/i.test(v.lang || '')); } catch (e) { return []; }
}
function voiceOptionsHTML() {
  const vs = teluguVoices();
  if (!vs.length) return '<option value="">No system Telugu voice — offline Telugu TTS is used by default</option>';
  return vs.map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === S.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');
}
function updateVoiceNote() {
  const el = $('#voiceNote'); if (!el) return;
  const vs = teluguVoices();
  el.innerHTML = `✓ <b>${Object.keys(TTS).length} shloka + ${Object.keys(TTSM).length} meaning clips</b> from a neural Telugu voice (Piper / Opus) are embedded — every verse has clear offline audio with no system voice and no internet. `
    + (vs.length ? `${vs.length} system Telugu voice(s) also available for the optional Browser mode.`
                 : 'This device has no system Telugu voice; Browser mode will use another voice.');
  const st = $('#voiceStatus'); if (st) st.textContent = (CAN_OPUS ? 'Opus · ' : 'MP3 compat · ') + Object.keys(TTS).length + ' clips';
}

/* ---------- small helpers ---------- */
function chapterRead(c) {
  let n = 0; for (let j = 0; j < chapCount[c]; j++) if (S.read.has(firstIdx[c] + j)) n++;
  return n;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function gemFor(c, v) { return G.gems.find(g => g[0][0] === c && g[0][1] === v); }
function chapterWord(c) { return ['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen'][c - 1] || c; }

/* ---------- SVG art ---------- */
function mandalaSVG() {
  let petals = '', petals2 = '', dots = '', spokes = '';
  for (let i = 0; i < 24; i++) petals += `<ellipse cx="500" cy="360" rx="22" ry="105" transform="rotate(${i * 15} 500 500)" fill="none" stroke="rgba(231,189,117,.24)" stroke-width="1"/>`;
  for (let i = 0; i < 16; i++) petals2 += `<ellipse cx="500" cy="410" rx="12" ry="62" transform="rotate(${i * 22.5 + 11} 500 500)" fill="none" stroke="rgba(240,163,94,.2)" stroke-width="1"/>`;
  for (let i = 0; i < 108; i++) { const a = i * Math.PI * 2 / 108; dots += `<circle cx="${(500 + 432 * Math.cos(a)).toFixed(1)}" cy="${(500 + 432 * Math.sin(a)).toFixed(1)}" r="${i % 9 === 0 ? 3 : 1.5}" fill="rgba(231,189,117,${i % 9 === 0 ? .55 : .3})"/>`; }
  for (let i = 0; i < 18; i++) { const a = i * Math.PI * 2 / 18; spokes += `<line x1="${(500 + 150 * Math.cos(a)).toFixed(1)}" y1="${(500 + 150 * Math.sin(a)).toFixed(1)}" x2="${(500 + 420 * Math.cos(a)).toFixed(1)}" y2="${(500 + 420 * Math.sin(a)).toFixed(1)}" stroke="rgba(231,189,117,.08)" stroke-width="1"/>`; }
  return `<svg viewBox="0 0 1000 1000" aria-hidden="true">
    <g class="spin-slow">${dots}<circle cx="500" cy="500" r="448" fill="none" stroke="rgba(231,189,117,.14)"/><circle cx="500" cy="500" r="416" fill="none" stroke="rgba(231,189,117,.1)"/></g>
    <g class="spin-rev">${petals}<circle cx="500" cy="500" r="278" fill="none" stroke="rgba(231,189,117,.2)"/><circle cx="500" cy="500" r="252" fill="none" stroke="rgba(231,189,117,.1)"/></g>
    <g class="spin-mid">${spokes}${petals2}<circle cx="500" cy="500" r="150" fill="none" stroke="rgba(231,189,117,.28)"/><circle cx="500" cy="500" r="128" fill="none" stroke="rgba(231,189,117,.15)"/></g>
    <circle cx="500" cy="500" r="72" fill="none" stroke="rgba(231,189,117,.22)"/>
    <circle cx="500" cy="500" r="470" fill="none" stroke="rgba(231,189,117,.06)"/>
  </svg>`;
}
function wheelSVG() {
  const R = 158, CIRC = 2 * Math.PI * R, gap = 2.4;
  let segs = '', ticks = '';
  let off = 0;
  C.forEach(ch => {
    const len = (ch.count / TOTAL) * CIRC;
    segs += `<circle class="wheel-seg ${ch.n === S.wheelC ? 'active' : ''}" data-go="c:${ch.n}" data-c="${ch.n}" cx="200" cy="200" r="${R}" stroke="hsl(${ch.hue} 68% 62%)" stroke-width="24" opacity=".78" stroke-dasharray="${Math.max(1, len - gap).toFixed(2)} ${(CIRC - Math.max(1, len - gap)).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>Chapter ${ch.n} — ${esc(ch.sk)} (${ch.count} verses)</title></circle>`;
    off += len;
  });
  for (let i = 0; i < 108; i++) { const a = i * Math.PI * 2 / 108 - Math.PI / 2; ticks += `<circle cx="${(200 + 190 * Math.cos(a)).toFixed(1)}" cy="${(200 + 190 * Math.sin(a)).toFixed(1)}" r="${i % 9 === 0 ? 2 : .9}" fill="rgba(231,189,117,${i % 9 === 0 ? .6 : .28})"/>`; }
  return `<svg viewBox="0 0 400 400" aria-label="Wheel of the 18 chapters, sized by verse count">
    <circle cx="200" cy="200" r="196" fill="none" stroke="rgba(231,189,117,.12)"/>
    <circle cx="200" cy="200" r="140" fill="none" stroke="rgba(231,189,117,.14)" stroke-dasharray="2 6"/>
    <circle cx="200" cy="200" r="128" fill="none" stroke="rgba(231,189,117,.09)"/>
    <g transform="rotate(-90 200 200)">${segs}</g>${ticks}</svg>`;
}
function updateWheel(n) {
  S.wheelC = clamp(n, 1, 18);
  const ch = C[S.wheelC - 1], el = $('#wheelCenter');
  if (el) el.innerHTML = `<div class="num">${String(ch.n).padStart(2, '0')}</div><div class="lbl">Chapter ${ch.n} · ${ch.count} verses</div><div class="sk">${esc(ch.sk)}</div>`;
  document.querySelectorAll('.wheel-seg').forEach(s => s.classList.toggle('active', +s.dataset.c === S.wheelC));
}

/* ---------- the 701-verse galaxy ---------- */
function initGalaxy() {
  const cv = $('#galaxy'); if (!cv) return;
  const wrap = $('#galaxyWrap'), tip = $('#galaxyTip');
  const W = 1200, H = 675, CX = W / 2, CY = H / 2, R = 288;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  // Eighteen spiral arms — one per chapter. Verse 1 of each chapter sits near
  // the centre; its final verse sits at the rim.
  const pts = new Array(TOTAL);
  const SECTOR = Math.PI * 2 / 18;
  const chapterAngles = C.map((ch, ci) => {
    const start = -Math.PI / 2 + ci * SECTOR, span = SECTOR * .88;
    for (let j = 0; j < ch.count; j++) {
      const t = (j + .5) / ch.count, a = start + t * span, r = 44 + t * (R - 44);
      const i = firstIdx[ch.n] + j;
      pts[i] = { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), i };
    }
    return { ch, a: start + span / 2 };
  });
  const gems = new Set(G.gems.map(g => idxOf(g[0][0], g[0][1])));
  function draw(hover) {
    ctx.clearRect(0, 0, W, H);
    // three soft act-glows
    G.acts.forEach((_, k) => {
      const ang = (-Math.PI / 2) + k * (Math.PI * 2 / 3);
      const gx = CX + Math.cos(ang) * 150, gy = CY + Math.sin(ang) * 130;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, 230);
      gr.addColorStop(0, `hsla(${C[k * 6].hue} 60% 55% / .075)`); gr.addColorStop(1, 'transparent');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    });
    // concentric guide rings + 18 radial ticks
    ctx.save(); ctx.setLineDash([2, 9]); ctx.strokeStyle = 'rgba(231,189,117,.12)'; ctx.lineWidth = 1;
    [96, 192, 288].forEach(r => { ctx.beginPath(); ctx.arc(CX, CY, r, 0, 6.283); ctx.stroke(); });
    ctx.restore();
    chapterAngles.forEach(({ ch, a }, k) => {
      const x1 = CX + Math.cos(a) * 300, y1 = CY + Math.sin(a) * 300;
      const x2 = CX + Math.cos(a) * 312, y2 = CY + Math.sin(a) * 312;
      ctx.strokeStyle = `hsla(${ch.hue} 65% 65% / .35)`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const lx = CX + Math.cos(a) * 328, ly = CY + Math.sin(a) * 328;
      ctx.fillStyle = `hsla(${ch.hue} 65% 72% / .62)`;
      ctx.font = '600 11px Manrope, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(ch.n).padStart(2, '0'), lx, ly);
    });
    // the verses
    pts.forEach(p => {
      const v = V[p.i], read = S.read.has(p.i), famous = gems.has(p.i);
      const hue = C[v[0] - 1].hue;
      ctx.beginPath(); ctx.arc(p.x, p.y, famous ? 3.5 : read ? 2.7 : 2, 0, 6.283);
      if (famous || read) { ctx.shadowBlur = 14; ctx.shadowColor = read ? 'rgba(248,221,167,.9)' : `hsla(${hue} 80% 70% / .9)`; }
      ctx.fillStyle = read ? 'rgba(248,221,167,.96)' : `hsla(${hue} 70% 70% / ${famous ? .95 : .62})`;
      ctx.fill(); ctx.shadowBlur = 0;
      if (famous) {
        ctx.strokeStyle = 'rgba(255,240,210,.55)'; ctx.lineWidth = .8;
        ctx.beginPath(); ctx.moveTo(p.x - 6, p.y); ctx.lineTo(p.x + 6, p.y);
        ctx.moveTo(p.x, p.y - 6); ctx.lineTo(p.x, p.y + 6); ctx.stroke();
      }
    });
    if (hover >= 0 && pts[hover]) {
      const p = pts[hover];
      ctx.strokeStyle = 'rgba(255,238,200,.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,238,200,.25)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 6.283); ctx.stroke();
    }
    // centre ring — the Om itself is a DOM element above the canvas
    ctx.strokeStyle = 'rgba(231,189,117,.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(CX, CY, 30, 0, 6.283); ctx.stroke();
  }
  let hovered = -1;
  function locate(e) {
    const rect = cv.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * W, y = (e.clientY - rect.top) / rect.height * H;
    let best = -1, bd = 12 * 12;
    for (let k = 0; k < pts.length; k++) {
      const dx = pts[k].x - x, dy = pts[k].y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function showTip(i, e) {
    const v = V[i], wr = wrap.getBoundingClientRect();
    tip.innerHTML = `<div class="gref">BG ${v[0]}.${v[1]} · ${esc(C[v[0] - 1].en)}</div><div class="gsk">${esc(firstLine(v[2]))}</div><div class="gen">${esc(enText(v).slice(0, 150))}</div>`;
    tip.classList.add('show');
    const x = clamp(e.clientX - wr.left + 16, 8, wr.width - tip.offsetWidth - 8);
    const y = clamp(e.clientY - wr.top - tip.offsetHeight / 2, 8, wr.height - tip.offsetHeight - 8);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  cv.addEventListener('pointermove', e => {
    const h = locate(e);
    if (h !== hovered) { hovered = h; draw(h); }
    if (h >= 0) { cv.style.cursor = 'pointer'; showTip(h, e); }
    else { cv.style.cursor = 'crosshair'; tip.classList.remove('show'); }
  });
  cv.addEventListener('pointerleave', () => { hovered = -1; draw(-1); tip.classList.remove('show'); });
  cv.addEventListener('click', e => { const h = locate(e); if (h >= 0) go(`v:${V[h][0]}:${V[h][1]}`); });
  draw(-1);
}

/* ---------- shared fragments ---------- */
function chapterCard(ch) {
  const pct = Math.round(chapterRead(ch.n) / ch.count * 100);
  return `<a class="chapter-card" style="--h:${ch.hue}" data-go="c:${ch.n}" href="#/c/${ch.n}">
    <div class="cc-top"><span class="cc-num">${String(ch.n).padStart(2, '0')}</span><span class="cc-count">${ch.count} verses</span></div>
    <div class="cc-sk">${esc(ch.sk)}</div><div class="cc-en">${esc(ch.en)}</div>
    <div class="cc-meaning">${esc(ch.meaningTe || ch.meaningEn)}</div>
    <div class="cc-bar"><i style="width:${pct}%"></i></div></a>`;
}
function resultCard(i, q) {
  const v = V[i];
  return `<div class="result-card" data-go="v:${v[0]}:${v[1]}" role="link" tabindex="0">
    <div class="rc-head"><span>BG ${v[0]}.${v[1]}</span><span>${esc(C[v[0] - 1].en)}</span></div>
    <div class="rc-sk">${hl(firstLine(v[2]), q)}</div>
    <div class="rc-en">${hl(enText(v).slice(0, 190), q)}</div></div>`;
}
function footerHTML() {
  return `<footer><div class="wrap"><div class="footer-grid">
    <div><h4>భగవద్గీత</h4><p>A quiet place to read the whole Bhagavad Gita <b>in Telugu</b> — every one of the ${TOTAL} verses in Telugu script, Telugu translation, Telugu audio, word-by-word meanings and three streams of commentary. Nothing here needs the internet.</p>
    <p class="te-line">తెలుగు లిపిలో సంపూర్ణ భగవద్గీత — శ్లోకం, అనువాదం, శ్రవ్యం, పదార్థాలు.</p>
    <p style="margin-top:1rem"><button class="btn ghost small" data-act="shortcuts">${svg('sparkle', 14)} Keyboard shortcuts</button></p></div>
    <div><h4>Wander</h4><div class="footer-links">
      <a href="#/chapters">The 18 chapters →</a><a href="#/gems">Famous verses →</a><a href="#/themes">Explore by theme →</a>
      <a href="#/journey">Your reading journey →</a><a href="#/quiz">Wisdom quiz →</a><a href="#/bookmarks">Your bookmarks →</a></div></div>
    <div><h4>Begin again</h4><div class="footer-links">
      <a href="#/v/1/1">Chapter 1, verse 1 →</a><a href="#/v/2/47">The heart of karma yoga →</a>
      <a href="#/v/11/32">The cosmic form →</a><a href="#/v/18/66">The final word →</a>
      <a href="#" data-act="random">A random verse →</a></div></div>
    </div><div class="footer-bottom"><span>${esc(G.teluguSource)}</span><span>${esc(G.source)}</span><span>Made for stillness · ${TOTAL} Telugu verses · offline Telugu TTS by eSpeak NG (GPL-3.0)</span></div>
  </div></footer>`;
}

/* ---------- HOME ---------- */
function viewHome() {
  const dv = dailyVerse, gem = gemFor(dv[0], dv[1]);
  const readPct = Math.round(S.read.size / TOTAL * 100);
  return `<section class="hero">
    <div class="hero-glow"></div><div class="mandala" id="mandala">${mandalaSVG()}</div>
    <div class="wrap">
      <div class="pre">A dialogue for every age</div>
      <h1>భగవద్గీత</h1>
      <div class="en-title">The Song of the Divine</div>
      <div class="te-sub" style="font-size:1.15rem;margin-bottom:.4rem">దైవ గీత · తెలుగు భగవద్గీత</div>
      <div class="sans-line sk">${verseAt(2, 47)[2].split('\n').map(l => esc(l)).join('<br>')}</div>
      <p class="hero-desc">A battlefield dialogue of ${TOTAL} verses, answering one human question: <em>how do I live?</em>&nbsp; Read it whole in <b>Telugu</b> — తెలుగు లిపి, తెలుగు అనువాదం, తెలుగు శ్రవ్యం — in one living sanctuary.</p>
      <div class="hero-cta">
        <a class="btn primary" href="#/v/1/1">Begin the dialogue ${svg('arrowR', 15)}</a>
        <button class="btn ghost" data-act="daily">${svg('sparkle', 15)} Verse for today</button>
        <button class="btn ghost" data-act="random">${svg('shuffle', 15)} Surprise me</button>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><b>18</b><span>Chapters</span></div>
        <div class="hero-stat"><b>${TOTAL}</b><span>Verses</span></div>
        <div class="hero-stat"><b>${G.enAuthors.length + G.teAuthors.length}</b><span>Translations</span></div>
        <div class="hero-stat"><b>3</b><span>Commentaries</span></div>
        <div class="hero-stat"><b>తె</b><span>Telugu audio</span></div>
      </div>
    </div><div class="scroll-hint">Scroll<i></i></div>
  </section>

  <section class="section"><div class="wrap">
    <div class="section-head"><div class="eyebrow">A word for today</div><h2 class="section-title">The verse that found <em>you</em></h2><div class="te-sub">నేటి శ్లోకం</div></div>
    <div class="daily panel">
      <div>
        <span class="tag"><span class="dot"></span> ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <div class="divider-ornament">✦</div>
        <div class="q sk">${esc(firstLine(dv[2]))}<br>${esc((dv[2].split('\n')[1] || ''))}</div>
        <div class="tr">${esc(firstLine(dv[3]))}</div>
        <div class="en">“${esc(enText(dv))}”</div>
        <div class="te-line" style="margin-top:.7rem">${esc(teText(dv).slice(0, 210))}</div>
        <div style="margin-top:1.5rem;display:flex;gap:.55rem;flex-wrap:wrap">
          <a class="btn ghost small" href="#/v/${dv[0]}/${dv[1]}">Read BG ${dv[0]}.${dv[1]} ${svg('arrowR', 13)}</a>
          <button class="btn ghost small" data-act="listen-verse" data-c="${dv[0]}" data-v="${dv[1]}">${svg('sound', 14)} తెలుగులో వినండి</button>
          <button class="btn ghost small" data-act="bookmark" data-c="${dv[0]}" data-v="${dv[1]}">${svg('bookmark', 14)} ${S.bookmarks.has(idxOf(dv[0], dv[1])) ? 'Saved' : 'Save'}</button>
        </div>
      </div>
      <div class="daily-side">
        ${gem ? `<div><div class="eyebrow" style="margin-bottom:.4rem">Why it matters</div><p style="font-family:var(--serif);font-size:1.3rem;font-style:italic;color:var(--gold2)">“${esc(gem[2])}”</p></div>` : ''}
        <div class="mini-stat"><span>Verses you've read</span><b>${S.read.size} / ${TOTAL}</b></div>
        <div class="mini-stat"><span>Bookmarked</span><b>${S.bookmarks.size}</b></div>
        <div class="mini-stat"><span>Day streak</span><b>${streak()}</b></div>
        <div class="mini-stat"><span>Chapter progress</span><b>${readPct}%</b></div>
        <a class="btn primary small" href="#/v/${S.last[0]}/${S.last[1]}" style="margin-top:.4rem">Continue where you left off ${svg('arrowR', 14)}</a>
      </div>
    </div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section-head"><div class="eyebrow">The whole in one glance</div><h2 class="section-title">A <em>wheel</em> of eighteen yogas</h2><div class="te-sub">పద్దెనిమిది యోగాల చక్రం</div>
      <p class="section-sub">Each arc is a chapter, sized by its number of verses. Hover to meet a chapter; click to enter it. The Gita is often read as three movements of six chapters each.</p></div>
    <div class="wheel-grid">
      <div class="wheel-wrap" id="wheelWrap">${wheelSVG()}<div class="wheel-center" id="wheelCenter"></div></div>
      <div class="act-list">${G.acts.map((a, k) => `<div class="act-row">
        <div class="eyebrow" style="margin-bottom:.25rem">Movement ${k + 1} · Chapters ${a.chapters}</div>
        <h3>${esc(a.name)}</h3><p>${esc(a.sub)} — ${esc(a.desc)}</p>
        <div class="act-chips">${C.filter(ch => ch.act === k).map(ch => `<button data-go="c:${ch.n}">${ch.n}. ${esc(ch.sk)}</button>`).join('')}</div>
      </div>`).join('')}</div>
    </div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Every verse, one sky</div><h2 class="section-title">The Gita as a <em>galaxy</em></h2><div class="te-sub">శ్లోక నక్షత్రమాల</div>
      <p class="section-sub">Seven hundred and one stars, one for each verse, spiralling out in eighteen arms — one arm for each chapter. Colour marks the chapter, a bright star is a famous verse, and every star you read begins to glow. Hover to meet a verse — click to enter it.</p></div>
    <div class="galaxy-wrap" id="galaxyWrap"><canvas id="galaxy" aria-label="Interactive map of all 701 verses"></canvas><div class="galaxy-om sk">ఓం</div><div class="galaxy-tip" id="galaxyTip"></div></div>
    <div class="galaxy-legend"><span><i></i> A verse</span><span>✦ Famous verse</span><span style="color:var(--gold2)">● Read verse</span><span>Hover · click · wander</span></div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section-head"><div class="eyebrow">The library</div><h2 class="section-title">Eighteen doors into <em>one truth</em></h2><div class="te-sub">పద్దెనిమిది అధ్యాయాలు</div>
      <p class="section-sub">From Arjuna's collapse to his surrender, every chapter is a different way of seeing the same reality. Your reading progress lives on each card.</p></div>
    <div class="chapter-grid">${C.map(chapterCard).join('')}</div>
    <div style="margin-top:1.6rem"><a class="btn ghost" href="#/chapters">Open the full library ${svg('arrowR', 15)}</a></div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Timeless lines</div><h2 class="section-title">Twenty verses to <em>carry with you</em></h2><div class="te-sub">ఇరవై ప్రసిద్ధ శ్లోకాలు</div>
      <p class="section-sub">The Gita's most quoted passages, in Telugu and English. Swipe through them, or open one to read its word meanings and commentaries.</p></div>
    <div class="gem-strip">${G.gems.map(g => gemCard(g)).join('')}</div>
    <div style="margin-top:1rem"><a class="btn ghost" href="#/gems">All famous verses ${svg('arrowR', 15)}</a></div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Follow a thread</div><h2 class="section-title">What are you <em>searching for?</em></h2><div class="te-sub">అంశాల వారీగా అన్వేషించండి</div>
      <p class="section-sub">Every verse is indexed by the questions it answers. Choose a theme and the Gita will gather its scattered wisdom on that subject.</p></div>
    <div class="theme-cloud">${G.themes.map(t => { buildThemeIndex(); return `<button class="theme-chip" data-go="theme:${t.id}"><span class="ic">${esc(t.icon)}</span>${esc(t.name)} <span style="font-family:var(--tel);opacity:.7;font-size:.82em">${esc(t.nameTe || '')}</span><span class="ct">${themeIndex[t.id].length}</span></button>`; }).join('')}</div>
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Two ways in</div><h2 class="section-title">A pilgrimage, or a <em>game of wisdom</em></h2><div class="te-sub">పఠన యాత్ర · జ్ఞాన పరీక్ష</div></div>
    <div class="journey-grid">
      <a class="act-card" href="#/journey"><span class="big">01</span><div class="eyebrow">The path</div><h3>Read it all, slowly</h3><div class="sub">Three movements, eighteen chapters, one verse at a time.</div>
        <p>Track every verse you read, pick up exactly where you stopped, and watch the wheel fill in.</p>
        <div class="act-progress"><i style="width:${readPct}%"></i></div><span class="muted" style="font-size:.7rem">${S.read.size} of ${TOTAL} verses read</span></a>
      <a class="act-card" href="#/quiz"><span class="big">02</span><div class="eyebrow">The test</div><h3>How well do you know it?</h3><div class="sub">Ten questions drawn from the text itself.</div>
        <p>Each answer links back to the verse it came from — a playful way to meet the teaching again.</p>
        <div class="act-progress"><i style="width:0%"></i></div><span class="muted" style="font-size:.7rem">${G.quiz.length} questions · no sign-up needed</span></a>
    </div>
  </div></section>` + footerHTML();
}
function gemCard(g) {
  const v = verseAt(g[0][0], g[0][1]); if (!v) return '';
  return `<div class="gem-card" data-go="v:${v[0]}:${v[1]}" role="link" tabindex="0">
    <div><div class="quote sk">${esc(v[2].split('\n').slice(0, 3).join('\n'))}</div>
      <div class="title">${esc(g[1])}</div><div class="note">${esc(g[2])}</div></div>
    <div class="ref">BG ${v[0]}.${v[1]} <span style="flex:1;height:1px;background:var(--line2)"></span> ${svg('arrowR', 13)}</div></div>`;
}

/* ---------- CHAPTERS / CHAPTER DETAIL ---------- */
function viewChapters() {
  return `<section class="section" style="padding-top:130px"><div class="wrap">
    <div class="section-head"><div class="eyebrow">The library</div><h2 class="section-title">The eighteen <em>chapters</em></h2><div class="te-sub">పద్దెనిమిది అధ్యాయాలు</div>
      <p class="section-sub">The Gita is a single conversation between Krishna and Arjuna, witnessed by Sanjaya. Its 18 chapters are traditionally grouped into three movements of six — action, devotion, knowledge.</p></div>
    ${G.acts.map((a, k) => `<div style="margin-bottom:2.8rem">
      <div style="display:flex;align-items:baseline;gap:1rem;flex-wrap:wrap;margin-bottom:1.1rem">
        <span class="tag">Movement ${k + 1} · ${esc(a.chapters)}</span><h3 style="font-size:1.9rem">${esc(a.name)}</h3>
        <span class="muted" style="font-family:var(--serif);font-style:italic;font-size:1.1rem">${esc(a.sub)}</span></div>
      <div class="chapter-grid">${C.filter(ch => ch.act === k).map(chapterCard).join('')}</div></div>`).join('')}
  </div></section>` + footerHTML();
}
function viewChapter(c) {
  const ch = C[c - 1], cvs = [], key = ch.key;
  for (let j = 0; j < ch.count; j++) cvs.push(verseAt(c, j + 1));
  const kv = verseAt(key[0], key[1]);
  const pct = Math.round(chapterRead(c) / ch.count * 100);
  return `<section class="chapter-hero"><div class="wrap">
    <div class="big-num">${String(c).padStart(2, '0')}</div>
    <div class="crumb" style="margin-bottom:1.2rem"><a href="#/chapters">Library</a> / <b>Chapter ${c}</b></div>
    <div class="eyebrow">${esc(G.acts[ch.act].name)} · ${ch.count} verses</div>
    <h1 class="csk sk">${esc(ch.sk)}</h1><div class="cen">${esc(ch.en)}</div>
    <div class="te-sub" style="font-size:1.15rem">${esc(ch.meaningTe)}</div>
    <div class="cmeaning">${esc(ch.meaningEn)}</div>
    <div style="display:flex;gap:.55rem;flex-wrap:wrap;margin-top:1.5rem">
      <a class="btn primary" href="#/v/${c}/1">Read chapter ${c} ${svg('arrowR', 15)}</a>
      <a class="btn ghost" href="#/v/${key[0]}/${key[1]}">${svg('sparkle', 15)} Key verse BG ${key[0]}.${key[1]}</a>
      ${c > 1 ? `<a class="btn ghost" href="#/c/${c - 1}">${svg('arrowL', 15)} Prev</a>` : ''}
      ${c < 18 ? `<a class="btn ghost" href="#/c/${c + 1}">Next ${svg('arrowR', 15)}</a>` : ''}
    </div>
    <div style="margin-top:2rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:220px"><div class="act-progress"><i style="width:${pct}%"></i></div>
      <span class="muted" style="font-size:.7rem">${chapterRead(c)} of ${ch.count} verses read · ${pct}%</span></div></div>
  </div></section>
  <section class="section"><div class="wrap">
    <div class="essence-box" style="margin-bottom:2rem"><div class="k">The essence</div><p>“${esc(ch.essence)}”</p></div>
    ${kv ? `<div class="daily panel" style="margin-bottom:2.4rem"><div>
        <span class="tag">A doorway into this chapter</span><div class="divider-ornament">✦</div>
        <div class="q sk">${esc(kv[2])}</div><div class="en" style="margin-top:1rem">“${esc(enText(kv))}”</div>
        <a class="btn ghost small" style="margin-top:1.2rem" href="#/v/${key[0]}/${key[1]}">Read BG ${key[0]}.${key[1]} ${svg('arrowR', 13)}</a></div>
      <div class="daily-side"><div class="eyebrow">Chapter summary</div><p style="font-size:.82rem;color:var(--muted)">${esc(ch.sumEn)}</p>
        <details class="acc"><summary>తెలుగు సారాంశం <span class="cnt">Telugu summary</span></summary><div class="acc-body sk" style="font-size:.88rem">${esc(ch.sumTe)}</div></details></div></div>` : ''}
    <div class="section-head"><div class="eyebrow">Every verse</div><h2 class="section-title">Chapter ${c}: <em>${esc(ch.en)}</em></h2>
      <p class="section-sub">All ${ch.count} verses. Click any tile to open the full reader.</p></div>
    <div class="verse-list-grid">${cvs.map(v => {
      const i = idxOf(v[0], v[1]);
      return `<div class="verse-tile ${S.read.has(i) ? 'read' : ''}" data-go="v:${v[0]}:${v[1]}" role="link" tabindex="0">
        <div class="vt-ref"><span>BG ${v[0]}.${v[1]}</span><span>${esc(SPEAKER[v[4]] ? SPEAKER[v[4]][0] : '')}</span></div>
        <div class="vt-sk">${esc(firstLine(v[2]))}</div><div class="vt-en">${esc(enText(v))}</div></div>`;
    }).join('')}</div>
    <div class="colophon" style="margin-top:2rem"><div class="eyebrow center" style="justify-content:center">Thus ends chapter ${c} · అధ్యాయం సమాప్తం</div>
      <div class="csk sk">${esc(G.colophons[c - 1][1])}</div>
      <div class="ctr">${esc(G.colophons[c - 1][2])}</div>
      <a class="btn ghost small" href="#/v/${c}/${ch.count}">${svg('arrowL', 13)} Read the last verse</a></div>
  </div></section>` + footerHTML();
}

/* ---------- READER ---------- */
function viewReader(c, v) {
  const verse = verseAt(c, v) || V[0], ch = C[c - 1], i = idxOf(c, v);
  const gem = gemFor(c, v), essence = gem ? gem[2] : ch.essence;
  const saved = S.bookmarks.has(i);
  const speaker = SPEAKER[verse[4]] || [verse[4] || '', verse[4] || ''];
  buildThemeIndex();
  const myThemes = (verseThemeMap[i] || []).slice(0, 3).map(x => G.themes.find(t => t.id === x[0])).filter(Boolean);
  const isLast = v === ch.count;
  const col = G.colophons[c - 1];

  const enTabs = G.enAuthors.map((a, k) => `<button class="${k === S.enIdx ? 'active' : ''}" data-act="en-author" data-i="${k}" title="${esc(a)}" ${verse[5][k] ? '' : 'disabled style="opacity:.35"'}>${esc(EN_SHORT[k] || a)}</button>`).join('');
  const teTabs = G.teAuthors.map((a, k) => `<button class="${k === S.teIdx ? 'active' : ''}" data-act="te-author" data-i="${k}" title="${esc(a)}" ${verse[6][k] ? '' : 'disabled style="opacity:.35"'}>${esc(TE_SHORT[k] || a)}</button>`).join('');
  const enBlock = `<div class="translation-block"><div class="tb-head"><span class="tb-label">English translation</span><div class="author-tabs">${enTabs}</div></div>
      <div class="translation-text">${esc(enText(verse))}</div>
      <div class="author-note">— ${esc(G.enAuthors[S.enIdx])}${verse[5][S.enIdx] ? '' : ' (alternate rendering shown)'}</div></div>`;
  const teBlock = `<div class="translation-block"><div class="tb-head"><span class="tb-label">తెలుగు అనువాదం · Telugu</span><div class="author-tabs">${teTabs}</div></div>
      <div class="translation-text te">${esc(teText(verse))}</div>
      <div class="author-note">— ${esc(G.teAuthors[S.teIdx])}</div></div>`;
  const trans = S.lang === 'en' ? enBlock : S.lang === 'te' ? teBlock : `<div class="translation-pair">${enBlock}${teBlock}</div>`;

  const words = verse[7] || [];
  const accWord = words.length ? `<details class="acc" ${words.length <= 12 ? 'open' : ''}><summary>Unravel the verse — word by word · పదార్థాలు <span class="cnt">${words.length} words</span></summary>
      <div class="word-grid">${words.map(w => `<div class="word-chip"><div class="w sk">${esc(w[0])}</div><div class="m">${esc(w[1])}</div></div>`).join('')}</div></details>` : '';
  const accs = [
    verse[8] ? `<details class="acc"><summary>Commentary · Swami Sivananda<span class="cnt">English</span></summary><div class="acc-body">${esc(verse[8]).split(/(?<=[.?])\s+/).map(p => `<p>${p}</p>`).join('')}</div></details>` : '',
    verse[10] ? `<details class="acc"><summary>Purport · A. C. Bhaktivedanta Swami Prabhupada<span class="cnt">English</span></summary><div class="acc-body">${esc(verse[10]).split(/(?<=[.?])\s+/).map(p => `<p>${p}</p>`).join('')}</div></details>` : '',
    verse[9] ? `<details class="acc"><summary>తెలుగు వ్యాఖ్య · Telugu commentary<span class="cnt">తెలుగు</span></summary><div class="acc-body sk" style="font-size:.9rem">${esc(verse[9]).split(/(?<=[.?])\s+/).map(p => `<p>${p}</p>`).join('')}</div></details>` : '',
    verse[11] ? `<details class="acc"><summary>సందర్భం · Context for this verse<span class="cnt">తెలుగు</span></summary><div class="acc-body sk" style="font-size:.9rem">${esc(verse[11])}</div></details>` : '',
    `<details class="acc"><summary>About chapter ${c} · ${esc(ch.en)}<span class="cnt">Context</span></summary><div class="acc-body"><p>${esc(ch.sumEn)}</p><p class="sk" style="font-size:.88rem">${esc(ch.sumTe)}</p></div></details>`,
  ].join('');

  const accAudio = `<details class="acc" id="audioAcc"><summary>♪ తెలుగు ఆడియో · Telugu audio settings<span class="cnt" id="voiceStatus">701 clips</span></summary>
      <div class="acc-body">
        <p style="font-size:.76rem">All recitation is <b>Telugu (te-IN)</b> using a neural Telugu voice (Piper). Embedded offline clips: <b>${Object.keys(TTS).length} shlokas + ${Object.keys(TTSM).length} Telugu meanings</b> in clear Ogg/Opus — no system voice and no internet. ${Object.keys(AUDIO).length} famous verses also have studio narration. If you hear nothing, press ▶ on the player at the bottom-left.</p>
        <div class="segbtns">
          <button data-act="audio-mode" data-m="auto" class="${S.audioMode === 'auto' ? 'active' : ''}">✦ Auto · studio + Telugu TTS</button>
          <button data-act="audio-mode" data-m="tts" class="${S.audioMode === 'tts' ? 'active' : ''}">Neural Telugu · all ${Object.keys(TTS).length}</button>
          <button data-act="audio-mode" data-m="browser" class="${S.audioMode === 'browser' ? 'active' : ''}">Browser Telugu voice</button>
        </div>
        <div class="voice-grid" style="margin-top:.9rem">
          <label>Telugu voice (browser TTS)<select id="voiceSelect">${voiceOptionsHTML()}</select></label>
          <label>Speed · వేగం <input type="range" id="rateSlider" min="0.6" max="1.2" step="0.05" value="${S.rate}"></label>
        </div>
        <p id="voiceNote" style="font-size:.72rem;margin-top:.7rem"></p>
        <p style="font-size:.7rem;opacity:.8">Shortcuts: <b>L</b> listen · <b>Chant</b> keeps reading aloud. A native player appears bottom-left — press ▶ there if your browser blocks autoplay. Browser mode is optional and needs a system Telugu voice.</p>
      </div></details>`;

  const rail = [];
  for (let k = 1; k <= ch.count; k++) {
    const vv = verseAt(c, k);
    rail.push(`<div class="vr-item ${k === v ? 'active' : ''}" data-go="v:${c}:${k}" id="vr-${k}"><span class="n">${c}.${k}</span><span class="t sk">${esc(firstLine(vv[2]))}</span></div>`);
  }

  return `<div class="reader wrap">
    <aside class="reader-side">
      <div class="rs-head"><div class="eyebrow" style="margin:0">Chapter ${c} of 18</div>
        <div class="rsk sk">${esc(ch.sk)}</div><div class="ren">${esc(ch.en)}</div>
        <select id="chapterSelect" aria-label="Jump to chapter">${C.map(x => `<option value="${x.n}" ${x.n === c ? 'selected' : ''}>${x.n}. ${esc(x.sk)} — ${esc(x.en)}</option>`).join('')}</select></div>
      <div class="verse-rail" id="verseRail">${rail.join('')}</div>
      <div class="rs-foot"><span>${chapterRead(c)} / ${ch.count} read</span><span>${esc(G.acts[ch.act].name)}</span></div>
    </aside>
    <div class="reader-main">
      <div class="rd-top">
        <div class="crumb"><a href="#/chapters">Library</a> / <a href="#/c/${c}">Chapter ${c}</a> / <b>Verse ${v}</b></div>
        <div class="rd-controls">
          <button class="chipbtn" data-act="prev" title="Previous verse (←)">${svg('arrowL', 13)}<span class="lbl">Prev</span></button>
          <button class="chipbtn" data-act="next" title="Next verse (→)"><span class="lbl">Next</span>${svg('arrowR', 13)}</button>
          <button class="chipbtn ${saved ? 'on' : ''}" data-act="bookmark" data-c="${c}" data-v="${v}" title="Bookmark (B)">${svg('bookmark', 13)}<span class="lbl">${saved ? 'Saved' : 'Save'}</span></button>
          <button class="chipbtn" data-act="random" title="Random verse (R)">${svg('shuffle', 13)}</button>
        </div>
      </div>
      <div class="rd-progress" title="${S.read.size} of ${TOTAL} verses read"><i style="width:${(S.read.size / TOTAL * 100).toFixed(2)}%"></i></div>

      <article class="verse-card">
        <div class="vc-head"><div class="vc-ref">BG ${c}.${v}</div>
          <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            ${hasStudio(c, v) ? '<span class="studio-badge">✦ Studio Telugu audio</span>' : ''}
            <div class="speaker"><span class="dot"></span><span>Spoken by</span><span class="sk">${esc(speaker[1])}</span><span>· ${esc(speaker[0])}</span></div>
          </div></div>
        <div class="ornament">✦ &nbsp; ${esc(ch.tr)} &nbsp; ✦</div>
        <div class="sk-text">${verse[2].split('\n').map(l => `<span class="pada">${esc(l)}</span>`).join('')}</div>
        ${S.showTranslit ? `<div class="translit">${esc(verse[3])}</div>` : ''}
        <div class="vc-actions">
          <button class="chipbtn ${S.showTranslit ? 'on' : ''}" data-act="translit">A / A</button>
          <button class="chipbtn ${S.speaking ? 'on' : ''}" data-act="listen" title="Recite in Telugu (L)">${svg('sound', 13)} వినండి · Listen</button>
          <button class="chipbtn" data-act="listen-meaning" title="Listen to the Telugu meaning">${svg('sound', 13)} అర్థం</button>
          <button class="chipbtn ${S.chant ? 'on' : ''}" data-act="chant" title="Continuous Telugu recitation">Chant</button>
          <button class="chipbtn" data-act="fs" data-d="-1">A−</button>
          <button class="chipbtn" data-act="fs" data-d="1">A+</button>
          <button class="chipbtn" data-act="copy" data-c="${c}" data-v="${v}">${svg('copy', 13)} Copy</button>
          <button class="chipbtn" data-act="share" data-c="${c}" data-v="${v}">${svg('share', 13)} Share</button>
          <button class="chipbtn ${S.focus ? 'on' : ''}" data-act="focus" title="Focus mode (F)">${svg('focus', 13)} Focus</button>
        </div>
      </article>

      ${trans}
      <div class="essence-box"><div class="k">${gem ? 'The heart of this verse' : 'The essence of this chapter'}</div><p>“${esc(essence)}”</p>
        <div class="te-line" style="margin-top:.6rem">${esc(teText(verse).slice(0, 230))}</div>
        ${myThemes.length ? `<div style="margin-top:.9rem;display:flex;gap:.4rem;flex-wrap:wrap">${myThemes.map(t => `<button class="theme-chip" style="padding:.3rem .7rem;font-size:.68rem" data-go="theme:${t.id}">${esc(t.icon)} ${esc(t.name)}</button>`).join('')}</div>` : ''}
      </div>
      ${accWord}${accs}${accAudio}

      ${isLast ? `<div class="colophon"><div class="eyebrow center" style="justify-content:center">Chapter ${c} complete · అధ్యాయం పూర్తయింది</div>
        <div class="csk sk">${esc(col[1])}</div><div class="ctr">${esc(col[2])}</div>
        <p class="muted" style="font-size:.76rem">You have read all ${ch.count} verses of ${esc(ch.en)}.</p>
        ${c < 18 ? `<a class="btn primary small" href="#/c/${c + 1}">Continue to chapter ${c + 1} ${svg('arrowR', 14)}</a>` : `<a class="btn primary small" href="#/journey">You finished the Gita ${svg('sparkle', 14)}</a>`}</div>` : ''}

      <div class="rd-nav">
        <button class="btn ghost" data-act="prev">${svg('arrowL', 15)} Previous verse</button>
        <button class="btn primary" data-act="next">Next verse ${svg('arrowR', 15)}</button>
      </div>
    </div>
  </div>
  ${S.focus ? `<div class="focus-float">
      <button class="chipbtn" data-act="prev">${svg('arrowL', 14)}</button>
      <button class="chipbtn" data-act="listen">${svg('sound', 14)}</button>
      <button class="chipbtn" data-act="bookmark" data-c="${c}" data-v="${v}">${svg('bookmark', 14)}</button>
      <button class="chipbtn on" data-act="focus">Exit focus (F)</button>
      <button class="chipbtn" data-act="next">${svg('arrowR', 14)}</button></div>` : ''}` + footerHTML();
}

/* ---------- GEMS / THEMES / JOURNEY / QUIZ / BOOKMARKS / SEARCH ---------- */
function viewGems() {
  return `<section class="section" style="padding-top:130px"><div class="wrap">
    <div class="section-head"><div class="eyebrow">The greatest hits</div><h2 class="section-title">Twenty verses that <em>changed the world</em></h2><div class="te-sub">ఇరవై ప్రసిద్ధ శ్లోకాలు</div>
      <p class="section-sub">A shortcut into the Gita's most loved teachings. Each card opens the full verse with all its translations and commentaries.</p></div>
    <div class="theme-results" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">${G.gems.map(g => {
      const v = verseAt(g[0][0], g[0][1]); if (!v) return '';
      return `<div class="result-card" data-go="v:${v[0]}:${v[1]}" role="link" tabindex="0" style="padding:1.5rem">
        <div class="rc-head"><span>BG ${v[0]}.${v[1]}</span><span>✦ ${esc(g[1])}</span></div>
        <div class="rc-sk" style="max-height:6em;font-size:1rem">${esc(v[2].split('\n').slice(0, 2).join('\n'))}</div>
        <div class="rc-en" style="max-height:6em;margin-top:.7rem;font-family:var(--serif);font-size:1.05rem">${esc(enText(v))}</div>
        <div style="margin-top:1rem;color:var(--gold);font-size:.72rem;font-style:italic">${esc(g[2])} →</div></div>`;
    }).join('')}</div></div></section>` + footerHTML();
}
function viewThemes(id) {
  buildThemeIndex();
  const t = G.themes.find(x => x.id === id) || G.themes[0];
  S.selectedTheme = t.id;
  const hits = themeIndex[t.id];
  return `<section class="section" style="padding-top:130px"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Explore by theme</div><h2 class="section-title">${esc(t.icon)} Verses on <em>${esc(t.name)}</em></h2><div class="te-sub">${esc(t.nameTe || t.name)} · ${hits.length} శ్లోకాలు</div>
      <p class="section-sub">The Gita rarely says everything in one place. These ${hits.length} verses mention or illuminate ${esc(t.name.toLowerCase())} — ranked by how strongly they speak to it.</p></div>
    <div class="theme-cloud">${G.themes.map(x => `<button class="theme-chip ${x.id === t.id ? 'active' : ''}" data-go="theme:${x.id}" title="${esc(x.nameTe || '')}"><span class="ic">${esc(x.icon)}</span>${esc(x.name)} <span style="font-family:var(--tel);opacity:.7;font-size:.82em">${esc(x.nameTe || '')}</span><span class="ct">${themeIndex[x.id].length}</span></button>`).join('')}</div>
    <div class="theme-results">${hits.slice(0, S.themeLimit).map(([i]) => resultCard(i, '')).join('')}</div>
    ${hits.length > S.themeLimit ? `<div style="text-align:center;margin-top:1.6rem"><button class="btn ghost" data-act="more-theme">Show ${Math.min(42, hits.length - S.themeLimit)} more verses ${svg('arrowR', 14)}</button></div>` : ''}
  </div></section>` + footerHTML();
}
function viewJourney() {
  const pct = Math.round(S.read.size / TOTAL * 100);
  return `<section class="section" style="padding-top:130px"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Your reading journey</div><h2 class="section-title">One verse at a <em>time</em></h2><div class="te-sub">ఒక్కొక్క శ్లోకం చొప్పున</div>
      <p class="section-sub">The Gita is not meant to be finished; it is meant to be lived with. Your place is saved automatically on this device.</p></div>
    <div class="journey-grid">${G.acts.map((a, k) => {
      const chs = C.filter(ch => ch.act === k), total = chs.reduce((s, x) => s + x.count, 0), done = chs.reduce((s, x) => s + chapterRead(x.n), 0);
      return `<div class="act-card"><span class="big">0${k + 1}</span><div class="eyebrow">Chapters ${a.chapters}</div>
        <h3>${esc(a.name)}</h3><div class="sub">${esc(a.sub)}</div><p>${esc(a.desc)}</p>
        <div class="act-progress"><i style="width:${(done / total * 100).toFixed(1)}%"></i></div>
        <span class="muted" style="font-size:.7rem">${done} of ${total} verses · ${Math.round(done / total * 100)}%</span>
        <div style="margin-top:1rem"><a class="btn ghost small" href="#/c/${chs[0].n}">Enter movement ${k + 1} ${svg('arrowR', 13)}</a></div></div>`;
    }).join('')}</div>
    <div class="journey-cta">
      <div style="flex:1;min-width:220px"><div class="eyebrow" style="margin-bottom:.3rem">Pick up the thread</div>
        <h3 style="font-size:1.7rem">You left off at BG ${S.last[0]}.${S.last[1]}</h3>
        <p class="muted" style="font-size:.8rem;margin:.4rem 0 0">${S.read.size} of ${TOTAL} verses read · ${pct}% of the journey · ${streak()} day streak · ${S.bookmarks.size} bookmarks</p></div>
      <div style="display:flex;gap:.6rem;flex-wrap:wrap"><a class="btn primary" href="#/v/${S.last[0]}/${S.last[1]}">Continue reading ${svg('arrowR', 15)}</a>
        <button class="btn ghost" data-act="reset-progress" title="Clear your reading history">Reset progress</button></div>
    </div>
    <div class="section-head" style="margin-top:3.5rem"><div class="eyebrow">The whole path</div><h2 class="section-title">The eighteen <em>steps</em></h2></div>
    <div class="theme-results" style="grid-template-columns:repeat(auto-fill,minmax(290px,1fr))">${C.map(ch => {
      const r = chapterRead(ch.n), p = Math.round(r / ch.count * 100);
      return `<div class="result-card" data-go="c:${ch.n}"><div class="rc-head"><span>Chapter ${String(ch.n).padStart(2, '0')}</span><span>${r}/${ch.count}</span></div>
        <div class="rc-sk sk" style="font-size:1rem">${esc(ch.sk)}</div><div class="rc-en">${esc(ch.essence)}</div>
        <div class="act-progress" style="margin-top:.8rem"><i style="width:${p}%"></i></div></div>`;
    }).join('')}</div>
  </div></section>` + footerHTML();
}
function viewQuiz() {
  const q = S.quiz, item = G.quiz[q.i];
  if (q.done) {
    const grade = q.score >= 9 ? 'You have lived with these verses.' : q.score >= 6 ? 'A steady mind, still growing.' : q.score >= 3 ? 'A good beginning — the Gita rewards return.' : 'Every reading starts somewhere.';
    return `<section class="section" style="padding-top:130px"><div class="wrap"><div class="quiz-box panel center">
      <div class="eyebrow" style="justify-content:center">The result</div><h2 style="font-size:clamp(2.4rem,6vw,4rem);margin:.6rem 0">${q.score} / ${G.quiz.length}</h2>
      <p class="muted" style="font-family:var(--serif);font-style:italic;font-size:1.3rem">${esc(grade)}</p>
      <div class="divider-ornament">✦</div><p class="muted" style="font-size:.82rem">Wrong answers are invitations: open the linked verse, read it once more, and the next round will feel different.</p>
      <div style="display:flex;gap:.6rem;justify-content:center;flex-wrap:wrap;margin-top:1.4rem">
        <button class="btn primary" data-act="quiz-restart">Try again ${svg('shuffle', 14)}</button><a class="btn ghost" href="#/v/1/1">Read the Gita ${svg('arrowR', 14)}</a></div>
    </div></div></section>` + footerHTML();
  }
  const letters = ['A', 'B', 'C', 'D'];
  return `<section class="section" style="padding-top:130px"><div class="wrap">
    <div class="section-head center" style="margin-inline:auto;text-align:center"><div class="eyebrow" style="justify-content:center">Wisdom quiz</div>
      <h2 class="section-title">Do you know the <em>Gita?</em></h2><div class="te-sub">గీతా జ్ఞాన పరీక్ష</div><p class="section-sub" style="margin-inline:auto">Ten questions, each drawn from a verse in this library. No timer, no pressure.</p></div>
    <div class="quiz-box panel">
      <div class="quiz-progress">${G.quiz.map((_, k) => `<i class="${k < q.i ? 'done' : ''}"></i>`).join('')}</div>
      <div class="eyebrow">Question ${q.i + 1} of ${G.quiz.length}</div>
      <h3 style="margin-top:.8rem">${esc(item.q)}</h3>
      <div class="quiz-options">${item.o.map((o, k) => {
        let cls = '';
        if (q.answered !== null) { if (k === item.a) cls = 'correct'; else if (k === q.answered) cls = 'wrong'; }
        return `<button class="quiz-opt ${cls}" data-act="quiz-answer" data-k="${k}" ${q.answered !== null ? 'disabled' : ''}><span class="letter">${letters[k]}</span>${esc(o)}</button>`;
      }).join('')}</div>
      ${q.answered !== null ? `<div class="quiz-why"><b style="color:var(--gold)">${q.answered === item.a ? '✓ Right' : '↗ The answer is ' + letters[item.a]}</b> — ${esc(item.why)}<br>
        <a href="#/v/${item.v[0]}/${item.v[1]}" style="color:var(--gold);text-decoration:underline">Read BG ${item.v[0]}.${item.v[1]} →</a></div>` : ''}
      <div class="quiz-foot"><span class="muted" style="font-size:.72rem">Score ${q.score} · ${q.i} answered</span>
        ${q.answered !== null ? `<button class="btn primary small" data-act="quiz-next">${q.i === G.quiz.length - 1 ? 'See result' : 'Next question'} ${svg('arrowR', 14)}</button>` : ''}</div>
    </div>
  </div></section>` + footerHTML();
}
function viewBookmarks() {
  const list = [...S.bookmarks].filter(i => V[i]).sort((a, b) => a - b);
  return `<section class="section" style="padding-top:130px"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Your collection</div><h2 class="section-title">Verses you <em>kept</em></h2><div class="te-sub">మీరు భద్రపరచిన శ్లోకాలు</div>
      <p class="section-sub">Saved on this device. Tap a verse to return to it; use the button on each card to let it go.</p></div>
    ${list.length ? `<div class="theme-results">${list.map(i => {
      const v = V[i]; return `<div style="position:relative"><div class="result-card" data-go="v:${v[0]}:${v[1]}"><div class="rc-head"><span>BG ${v[0]}.${v[1]}</span><span>${esc(C[v[0] - 1].en)}</span></div>
        <div class="rc-sk">${esc(firstLine(v[2]))}</div><div class="rc-en">${esc(enText(v))}</div></div>
        <button class="chipbtn" style="position:absolute;right:.7rem;bottom:.7rem;z-index:2" data-act="bookmark" data-c="${v[0]}" data-v="${v[1]}">Remove ✕</button></div>`;
    }).join('')}</div>` : `<div class="panel center" style="padding:4rem 2rem"><div style="font-size:3rem;color:var(--gold);opacity:.5">✦</div>
      <h3 style="font-size:2rem;margin:.8rem 0">Nothing saved yet</h3><p class="muted" style="max-width:420px;margin:0 auto 1.4rem">While reading any verse, press <b>B</b> or tap Save. Your favourite lines will gather here.</p>
      <a class="btn primary" href="#/gems">Discover famous verses ${svg('arrowR', 14)}</a></div>`}
  </div></section>` + footerHTML();
}
function viewSearch(q) {
  const hits = search(q, 120);
  return `<section class="section" style="padding-top:130px"><div class="wrap">
    <div class="section-head"><div class="eyebrow">Search the whole Gita</div><h2 class="section-title">Every verse, <em>one question</em></h2></div>
    <div class="palette-input panel" style="border-radius:16px;margin-bottom:1.5rem">${svg('search', 19)}<input id="pageSearch" value="${esc(q)}" placeholder="Try “fear”, “కర్మ”, “సుఖం”, “18.66”…"><button class="btn ghost small" data-act="search">⌘K</button></div>
    <p class="muted" style="font-size:.78rem;margin-bottom:1rem">${hits.length ? `${hits.length} verses found for “${esc(q)}”` : q ? `No matches for “${esc(q)}”. Try a single word, a Sanskrit word, or a reference like 2.47.` : 'Start typing to search Sanskrit, transliteration, English and Hindi.'}</p>
    <div class="theme-results">${hits.map(i => resultCard(i, q)).join('')}</div>
  </div></section>` + footerHTML();
}

/* ---------- rendering / routing ---------- */
const NAV = [
  { id: 'chapters', label: 'Library', href: 'chapters', te: 'గ్రంథాలయం' },
  { id: 'gems', label: 'Gems', href: 'gems', te: 'ప్రసిద్ధ శ్లోకాలు' },
  { id: 'themes', label: 'Themes', href: 'themes', te: 'అంశాలు' },
  { id: 'journey', label: 'Journey', href: 'journey', te: 'పఠన యాత్ర' },
  { id: 'quiz', label: 'Quiz', href: 'quiz', te: 'జ్ఞాన పరీక్ష' },
];
const BOTTOM = [
  { id: 'home', label: 'Home', href: '', icon: 'home' }, { id: 'chapters', label: 'Library', href: 'chapters', icon: 'grid' },
  { id: 'search', label: 'Search', href: 'search', icon: 'search' }, { id: 'bookmarks', label: 'Saved', href: 'bookmarks', icon: 'bookmark' },
  { id: 'quiz', label: 'Quiz', href: 'quiz', icon: 'quiz' },
];
function renderNav() {
  const active = S.view === 'reader' || S.view === 'chapter' ? 'chapters' : S.view === 'search' ? '' : S.view;
  $('#navlinks').innerHTML = NAV.map(n => `<a href="#/${n.href}" class="${active === n.id ? 'active' : ''}" title="${esc(n.te)}">${n.label}</a>`).join('');
  $('#bottomnav').innerHTML = BOTTOM.map(n => `<a href="#/${n.href}" class="${active === n.id ? 'active' : ''}">${svg(n.icon, 19)}${n.label}</a>`).join('');
  const p = S.read.size / TOTAL;
  $('#progressCircle').setAttribute('stroke-dasharray', (2 * Math.PI * 15).toFixed(2));
  $('#progressCircle').setAttribute('stroke-dashoffset', (2 * Math.PI * 15 * (1 - p)).toFixed(2));
  $('#progressPct').textContent = Math.round(p * 100);
  const lbtn = $('#langbtn'); lbtn.textContent = S.lang === 'en' ? 'EN' : S.lang === 'te' ? 'తె' : 'EN+';
  lbtn.title = 'అనువాద భాష · Translation language: ' + (S.lang === 'en' ? 'English' : S.lang === 'te' ? 'Telugu (తెలుగు)' : 'English + Telugu');
  lbtn.classList.toggle('on', S.lang !== 'en');
  $('#ambientbtn').classList.toggle('on', S.ambient);
  $('#lightbtn').classList.toggle('on', S.light);
  $('#topbar').classList.remove('open');
}
function render(keepScroll) {
  const y = window.scrollY;
  document.body.classList.toggle('light', S.light);
  document.body.classList.toggle('focus-mode', S.focus && S.view === 'reader');
  document.documentElement.style.setProperty('--fs', S.scale);
  let html = '';
  switch (S.view) {
    case 'chapters': html = viewChapters(); break;
    case 'chapter': html = viewChapter(S.c); break;
    case 'reader': html = viewReader(S.c, S.v); break;
    case 'gems': html = viewGems(); break;
    case 'themes': html = viewThemes(S.selectedTheme); break;
    case 'journey': html = viewJourney(); break;
    case 'quiz': html = viewQuiz(); break;
    case 'bookmarks': html = viewBookmarks(); break;
    case 'search': html = viewSearch(S.q); break;
    default: html = viewHome();
  }
  app.innerHTML = html;
  renderNav();
  document.title = (S.view === 'reader' ? `BG ${S.c}.${S.v} — ` : S.view === 'chapter' ? `Chapter ${S.c} — ` : '') + 'భగవద్గీత · Gītā Telugu';
  if (S.view === 'home') { updateWheel(S.wheelC); initGalaxy(); }
  if (S.view === 'reader') {
    const el = document.getElementById('vr-' + S.v);
    if (el) {
      const rail = $('#verseRail');
      rail.scrollTop = Math.max(0, el.offsetTop - rail.offsetTop - rail.clientHeight / 2 + el.clientHeight / 2);
    }
    updateVoiceNote();
  }
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
}
function applyRoute(force) {
  const h = location.hash.replace(/^#\/?/, '');
  const p = h.split('/').filter(Boolean);
  const prevView = S.view;
  if (!p.length) S.view = 'home';
  else if (p[0] === 'chapters') S.view = 'chapters';
  else if (p[0] === 'gems') S.view = 'gems';
  else if (p[0] === 'themes') { S.view = 'themes'; S.selectedTheme = p[1] || S.selectedTheme; S.themeLimit = 42; }
  else if (p[0] === 'journey') S.view = 'journey';
  else if (p[0] === 'quiz') S.view = 'quiz';
  else if (p[0] === 'bookmarks') S.view = 'bookmarks';
  else if (p[0] === 'search') { S.view = 'search'; S.q = decodeURIComponent(p.slice(1).join('/') || ''); }
  else if (p[0] === 'c') { S.view = 'chapter'; S.c = clamp(+p[1] || 1, 1, 18); }
  else if (p[0] === 'v') {
    S.c = clamp(+p[1] || 1, 1, 18); S.v = clamp(+p[2] || 1, 1, chapCount[S.c]); S.view = 'reader';
    const i = idxOf(S.c, S.v); if (i >= 0) S.read.add(i);
    S.last = [S.c, S.v]; persist();
  } else S.view = 'home';
  if (prevView !== 'reader' && S.view !== 'reader') S.focus = false;
  // Any navigation ends the current recitation (chant mode starts the next one itself).
  stopSpeech();
  if (S.view !== 'reader') S.chant = false;
  render(false);
  if (force) window.scrollTo(0, 0);
}
function go(p) {
  let h;
  if (p === 'home') h = '#/';
  else if (p.startsWith('v:')) { const [, c, v] = p.split(':'); h = `#/v/${c}/${v}`; }
  else if (p.startsWith('c:')) h = `#/c/${p.split(':')[1]}`;
  else if (p.startsWith('theme:')) { S.selectedTheme = p.split(':')[1]; S.themeLimit = 42; persist(); h = `#/themes/${S.selectedTheme}`; }
  else h = '#/' + p;
  if (location.hash === h) applyRoute(true); else location.hash = h;
}

/* ---------- actions ---------- */
function stepVerse(d) {
  const i = idxOf(S.c, S.v), ni = clamp(i + d, 0, TOTAL - 1);
  go(`v:${V[ni][0]}:${V[ni][1]}`);
}
function toggleBookmark(c, v) {
  const i = idxOf(c, v);
  if (S.bookmarks.has(i)) { S.bookmarks.delete(i); toast('Removed from your collection'); }
  else { S.bookmarks.add(i); toast('Verse saved · BG ' + c + '.' + v); }
  persist(); render(true);
}
function verseText(v) {
  return `భగవద్గీత ${v[0]}.${v[1]}\n\n${v[2]}\n\n${v[3]}\n\nతెలుగు అనువాదం: ${teText(v)}\n\nEnglish: ${enText(v)}\n\n— Gītā, the eternal dialogue`;
}
function copyVerse(c, v) {
  const vv = verseAt(c, v); if (!vv) return;
  const t = verseText(vv);
  const done = () => toast('Verse copied to clipboard');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done).catch(() => legacyCopy(t, done));
  else legacyCopy(t, done);
}
function legacyCopy(t, done) {
  const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy — select the text manually'); }
  document.body.removeChild(ta);
}
async function shareVerse(c, v) {
  const vv = verseAt(c, v); if (!vv) return;
  if (navigator.share) { try { await navigator.share({ title: `Bhagavad Gita ${c}.${v}`, text: verseText(vv) }); return; } catch (e) {} }
  copyVerse(c, v);
}
function randomVerse() { const i = Math.floor(Math.random() * TOTAL); go(`v:${V[i][0]}:${V[i][1]}`); }

function handleAct(act, el, e) {
  switch (act) {
    case 'search': openPalette(); break;
    case 'shortcuts': $('#shortcuts').classList.remove('hide'); break;
    case 'close-overlays': closeOverlays(); break;
    case 'menu': $('#topbar').classList.toggle('open'); break;
    case 'light': S.light = !S.light; persist(); render(true); break;
    case 'lang': S.lang = S.lang === 'en' ? 'te' : S.lang === 'te' ? 'both' : 'en'; persist(); render(true); toast(S.lang === 'en' ? 'English translation' : S.lang === 'te' ? 'తెలుగు అనువాదం' : 'English + Telugu'); break;
    case 'ambient': toggleAmbient(); renderNav(); break;
    case 'daily': go(`v:${dailyVerse[0]}:${dailyVerse[1]}`); break;
    case 'random': randomVerse(); break;
    case 'prev': stepVerse(-1); break;
    case 'next': stepVerse(1); break;
    case 'bookmark': toggleBookmark(+el.dataset.c, +el.dataset.v); break;
    case 'copy': copyVerse(+el.dataset.c, +el.dataset.v); break;
    case 'share': shareVerse(+el.dataset.c, +el.dataset.v); break;
    case 'translit': S.showTranslit = !S.showTranslit; render(true); break;
    case 'fs': S.scale = clamp(+(S.scale + (+el.dataset.d) * .08).toFixed(2), .85, 1.35); persist(); render(true); break;
    case 'focus': S.focus = !S.focus; render(true); toast(S.focus ? 'Focus mode on · press F to exit' : 'Focus mode off'); break;
    case 'chant': S.chant = !S.chant; render(true); toast(S.chant ? 'Continuous recitation on' : 'Continuous recitation off'); if (S.chant && !S.speaking) listenCurrent(); break;
    case 'listen': toggleListen(); break;
    case 'listen-verse': playVerse(+el.dataset.c, +el.dataset.v, 'shloka'); break;
    case 'listen-meaning': playVerse(S.c, S.v, 'meaning'); break;
    case 'audio-mode': S.audioMode = el.dataset.m || 'auto'; persist(); render(true);
      toast(S.audioMode === 'auto' ? 'Auto · studio clips + neural Telugu' : S.audioMode === 'tts' ? 'Neural Telugu for every verse' : 'Browser Telugu voice selected'); break;
    case 'audio-close': hideDock(); break;
    case 'en-author': S.enIdx = +el.dataset.i; persist(); render(true); break;
    case 'te-author': S.teIdx = +el.dataset.i; persist(); render(true); break;
    case 'more-theme': S.themeLimit += 42; render(true); break;
    case 'quiz-answer': {
      const q = S.quiz; if (q.answered !== null) break;
      q.answered = +el.dataset.k;
      if (q.answered === G.quiz[q.i].a) q.score++;
      render(true); break;
    }
    case 'quiz-next': {
      const q = S.quiz;
      if (q.i === G.quiz.length - 1) { q.done = true; } else { q.i++; q.answered = null; }
      render(false); break;
    }
    case 'quiz-restart': S.quiz = { i: 0, score: 0, answered: null, done: false }; render(false); break;
    case 'reset-progress': if (confirm('Clear all your reading progress and bookmarks on this device?')) { S.read.clear(); S.bookmarks.clear(); persist(); render(true); toast('Progress cleared — a fresh start'); } break;
  }
}

/* ---------- palette ---------- */
function openPalette() {
  S.paletteOpen = true; $('#palette').classList.remove('hide');
  const inp = $('#paletteInput'); inp.value = ''; inp.focus();
  S.paletteHits = G.gems.map(g => idxOf(g[0][0], g[0][1])).filter(i => i >= 0);
  S.paletteSel = 0; renderPalette('');
}
function closeOverlays() {
  S.paletteOpen = false; $('#palette').classList.add('hide'); $('#shortcuts').classList.add('hide');
}
function paletteItem(i, q, k) {
  const v = V[i];
  return `<div class="pr-item ${k === S.paletteSel ? 'sel' : ''}" data-pal="${k}"><span class="pr-ref">BG ${v[0]}.${v[1]}</span>
    <div class="pr-body"><div class="pr-sk">${hl(firstLine(v[2]), q)}</div><div class="pr-en">${hl(enText(v), q)}</div></div></div>`;
}
function renderPalette(q) {
  S.paletteHits = q.trim() ? search(q, 50) : G.gems.map(g => idxOf(g[0][0], g[0][1])).filter(i => i >= 0);
  S.paletteSel = clamp(S.paletteSel, 0, Math.max(0, S.paletteHits.length - 1));
  const box = $('#paletteResults');
  if (!S.paletteHits.length) { box.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.82rem">No verse matched. Try a word, a name, or a reference like <b>2.47</b>.</div>`; return; }
  box.innerHTML = `<div style="padding:.4rem .8rem;font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)">${q.trim() ? S.paletteHits.length + ' verses' : 'Start here · famous verses'}</div>` +
    S.paletteHits.map((i, k) => paletteItem(i, q, k)).join('');
}
function openPaletteHit(k) {
  const i = S.paletteHits[k]; if (i === undefined) return;
  closeOverlays(); go(`v:${V[i][0]}:${V[i][1]}`);
}

/* ---------- Telugu audio: offline TTS for all 701 verses + studio clips + browser voices ---------- */
function player() { return $('#teluguPlayer'); }
function showDock(label) {
  const dock = $('#audioDock'); if (!dock) return;
  dock.classList.remove('hide');
  if (label) {
    const el = $('#audioDockLabel');
    if (el) el.innerHTML = esc(label) + '<span class="ad-sub">offline · press ▶ if sound is blocked</span>';
  }
}
function hideDock() {
  const dock = $('#audioDock'); if (!dock) return;
  const p = player(); if (p) { try { p.pause(); } catch (e) {} }
  dock.classList.add('hide');
  S.speaking = false;
}
function stopSpeech() {
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
  const p = player();
  if (p) { try { p.pause(); } catch (e) {} p.onended = null; p.onerror = null; }
  S.speaking = false; S.studioPlaying = false;
}
/* Play any data-URI clip through the visible native <audio controls> element.
   Native controls mean the user can always press play directly, even inside a
   restrictive sandboxed iframe where programmatic play() may be blocked. */
function playSource(src, label, onend, isStudio) {
  const p = player();
  if (!p || !src) return false;
  stopSpeech();
  showDock(label);
  p.src = src;
  try { p.currentTime = 0; } catch (e) {}
  p.onended = () => { S.speaking = false; S.studioPlaying = false; if (onend) onend(); };
  p.onerror = () => { S.speaking = false; toast('Audio error — press ▶ on the Telugu player'); };
  let pr;
  try { pr = p.play(); } catch (e) { pr = null; }
  if (pr && pr.catch) pr.catch(() => toast('Press ▶ on the Telugu player to start audio'));
  S.speaking = true; S.studioPlaying = !!isStudio;
  return true;
}
/* Browser speechSynthesis. Chrome needs resume() and a short delay after
   cancel(); without them speak() is frequently silent. */
function speak(text, lang, onend) {
  const ss = window.speechSynthesis;
  if (!ss) { toast('No speech engine here — use the Telugu player instead'); return; }
  try { ss.cancel(); ss.resume(); } catch (e) {}
  S.speaking = true;
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(cleanForSpeech(text));
    u.lang = lang || AUDIO_LANG;
    u.rate = S.rate; u.pitch = 1; u.volume = 1;
    const voices = ss.getVoices();
    const chosen = voices.find(x => x.voiceURI === S.voiceURI)
      || voices.find(x => /^te/i.test(x.lang || ''))
      || voices.find(x => /^hi/i.test(x.lang || ''))
      || voices[0];
    if (chosen) u.voice = chosen;
    let started = false;
    u.onstart = () => { started = true; };
    u.onend = () => { S.speaking = false; if (onend) onend(); };
    u.onerror = () => { S.speaking = false; toast('Browser voice failed — switch to Telugu TTS in audio settings'); };
    try { ss.resume(); } catch (e) {}
    try { ss.speak(u); } catch (e) { S.speaking = false; }
    setTimeout(() => {
      if (!started && S.speaking) toast('No working system voice — switch to Telugu TTS in audio settings');
    }, 3000);
  }, 120);
}
function chantAdvance() {
  if (!S.chant || S.view !== 'reader') return;
  const i = idxOf(S.c, S.v);
  if (i < TOTAL - 1) {
    go(`v:${V[i + 1][0]}:${V[i + 1][1]}`);
    setTimeout(() => { if (S.chant) playVerse(S.c, S.v, 'shloka'); }, 700);
  } else { S.chant = false; toast('You have reached the end of the Gita'); }
}
function playVerse(c, v, kind) {
  const verse = verseAt(c, v); if (!verse) return;
  const isMeaning = kind === 'meaning';
  const done = () => { if (!isMeaning) chantAdvance(); };
  // The "meaning" button reads the Telugu prose translation. It has its own
  // embedded neural clip for every verse; Browser mode can still override it.
  if (isMeaning) {
    if (S.audioMode !== 'browser' && CAN_OPUS && TTSM[audioKey(c, v)]) {
      if (playSource(TTSM[audioKey(c, v)], 'Telugu meaning · BG ' + c + '.' + v, null, false)) {
        toast('Telugu meaning · BG ' + c + '.' + v);
        return;
      }
    }
    speak(teText(verse), AUDIO_LANG, null);
    toast('Telugu meaning · BG ' + c + '.' + v);
    return;
  }
  if (S.audioMode === 'browser') {
    speak(verse[2], AUDIO_LANG, done);
    toast('Browser Telugu voice · BG ' + c + '.' + v);
    return;
  }
  if (S.audioMode === 'auto' && hasStudio(c, v)) {
    if (playSource(AUDIO[audioKey(c, v)], '✦ Studio Telugu · BG ' + c + '.' + v, done, true)) {
      toast('✦ Studio Telugu recitation · BG ' + c + '.' + v);
      return;
    }
  }
  // THE GUARANTEED PATH: an embedded offline Telugu clip exists for all 701 verses.
  // Opus is used where supported; an MP3 copy is embedded for older browsers.
  if (hasTTS(c, v)) {
    const k = audioKey(c, v);
    const src = CAN_OPUS ? TTS[k] : (TTSFB[k] || TTS[k]);
    const lbl = (CAN_OPUS ? 'Neural Telugu' : 'Telugu (compat)') + ' · BG ' + c + '.' + v;
    if (playSource(src, lbl, done, false)) {
      toast(lbl);
      return;
    }
  }
  speak(verse[2], AUDIO_LANG, done);
  toast('Browser Telugu voice · BG ' + c + '.' + v);
}
function listenCurrent() { playVerse(S.c, S.v, 'shloka'); }
function toggleListen() {
  if (S.speaking) { stopSpeech(); toast('Recitation stopped'); }
  else listenCurrent();
}

/* ---------- ambient drone ---------- */
let actx = null, ambMaster = null, ambOsc = [], ambTimer = null;
function bell() {
  if (!actx || !S.ambient) return;
  const t = actx.currentTime;
  [523.25, 784, 1046.5].forEach((f, k) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.032 / (k + 1), t + .03);
    g.gain.exponentialRampToValueAtTime(.0001, t + 4.2 + k);
    o.connect(g); g.connect(ambMaster); o.start(t); o.stop(t + 5.5 + k);
  });
}
function startAmbient() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { toast('Ambient audio is not available here'); return; }
    actx = actx || new AC(); actx.resume();
    ambMaster = actx.createGain(); ambMaster.gain.setValueAtTime(0, actx.currentTime);
    ambMaster.gain.linearRampToValueAtTime(.55, actx.currentTime + 3);
    ambMaster.connect(actx.destination);
    [130.81, 196, 261.63, 329.63, 392].forEach((f, k) => {
      const o = actx.createOscillator(), g = actx.createGain(), lfo = actx.createOscillator(), lg = actx.createGain();
      o.type = k % 2 ? 'sine' : 'triangle'; o.frequency.value = f;
      g.gain.value = .022 / (1 + k * .28);
      lfo.frequency.value = .045 + k * .019; lg.gain.value = .012 / (1 + k * .28);
      lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(ambMaster);
      o.start(); lfo.start(); ambOsc.push(o, lfo);
    });
    bell(); ambTimer = setInterval(bell, 15000);
    S.ambient = true; toast('Ambient sound on · a soft temple drone');
  } catch (e) { toast('Ambient audio is not available here'); }
}
function stopAmbient() {
  S.ambient = false; clearInterval(ambTimer);
  try {
    if (ambMaster) ambMaster.gain.linearRampToValueAtTime(0, actx.currentTime + .6);
    setTimeout(() => { ambOsc.forEach(o => { try { o.stop(); } catch (e) {} }); ambOsc = []; }, 700);
  } catch (e) {}
  toast('Ambient sound off');
}
function toggleAmbient() { S.ambient ? stopAmbient() : startAmbient(); }

/* ---------- starfield ---------- */
function initStars() {
  const cv = $('#stars'), ctx = cv.getContext('2d');
  let stars = [], w = 0, h = 0, raf = null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize() {
    w = cv.width = window.innerWidth * (window.devicePixelRatio > 1 ? 1 : 1);
    h = cv.height = window.innerHeight;
    const n = Math.min(190, Math.floor(w * h / 9000));
    stars = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.25 + .2, a: Math.random() * .6 + .12, s: Math.random() * .012 + .002, p: Math.random() * 6.28 }));
  }
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const st of stars) {
      const a = st.a + Math.sin(t * .0006 + st.p) * .22;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.283);
      ctx.fillStyle = `rgba(240,214,164,${Math.max(.04, a)})`; ctx.fill();
      if (!reduce) { st.y += st.s * 6; if (st.y > h) { st.y = 0; st.x = Math.random() * w; } }
    }
    raf = requestAnimationFrame(draw);
  }
  resize(); window.addEventListener('resize', resize);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(draw);
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); return; }
  const pal = e.target.closest('[data-pal]');
  if (pal) { openPaletteHit(+pal.dataset.pal); return; }
  const a = e.target.closest('[data-act]');
  if (a) { e.preventDefault(); handleAct(a.dataset.act, a, e); return; }
  if (e.target.id === 'palette') closeOverlays();
  if (e.target.id === 'shortcuts') closeOverlays();
});
document.addEventListener('input', e => {
  if (e.target.id === 'paletteInput') { S.paletteSel = 0; renderPalette(e.target.value); }
  if (e.target.id === 'rateSlider') { S.rate = +e.target.value; }
  if (e.target.id === 'pageSearch') {
    const q = e.target.value;
    S.q = q;
    const hits = search(q, 120);
    const results = document.querySelector('.theme-results');
    if (results) results.innerHTML = hits.map(i => resultCard(i, q)).join('');
    const note = document.querySelector('.section .muted');
    if (note) note.textContent = hits.length ? `${hits.length} verses found for “${q}”` : q ? 'No matches — try one word, a Sanskrit word, or a reference like 2.47.' : 'Start typing to search Sanskrit, transliteration, English and Hindi.';
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'chapterSelect') go('c:' + e.target.value);
  if (e.target.id === 'voiceSelect') { S.voiceURI = e.target.value; persist(); toast('Telugu voice updated'); }
  if (e.target.id === 'rateSlider') { S.rate = +e.target.value; persist(); }
});
document.addEventListener('mouseover', e => {
  const seg = e.target.closest('.wheel-seg');
  if (seg) updateWheel(+seg.dataset.c);
});
document.addEventListener('keydown', e => {
  const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); S.paletteOpen ? closeOverlays() : openPalette(); return; }
  if (e.key === 'Escape') { closeOverlays(); if (S.focus) { S.focus = false; render(true); } $('#topbar').classList.remove('open'); return; }
  if (S.paletteOpen && typing && e.target.id === 'paletteInput') {
    if (e.key === 'ArrowDown') { e.preventDefault(); S.paletteSel = clamp(S.paletteSel + 1, 0, S.paletteHits.length - 1); renderPalette($('#paletteInput').value); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); S.paletteSel = clamp(S.paletteSel - 1, 0, S.paletteHits.length - 1); renderPalette($('#paletteInput').value); return; }
    if (e.key === 'Enter') { e.preventDefault(); openPaletteHit(S.paletteSel); return; }
    return;
  }
  if (typing) return;
  if (e.key === '/') { e.preventDefault(); openPalette(); return; }
  if (e.key === '?') { $('#shortcuts').classList.toggle('hide'); return; }
  if (S.view === 'reader') {
    if (e.key === 'ArrowRight') { e.preventDefault(); stepVerse(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepVerse(-1); }
    else if (e.key.toLowerCase() === 'b') toggleBookmark(S.c, S.v);
    else if (e.key.toLowerCase() === 'l') toggleListen();
    else if (e.key.toLowerCase() === 'f') { S.focus = !S.focus; render(true); }
  }
  if (e.key.toLowerCase() === 'r' && !S.paletteOpen && $('#shortcuts').classList.contains('hide')) randomVerse();
});
window.addEventListener('hashchange', () => applyRoute(false));
if ('speechSynthesis' in window) {
  try {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      const sel = $('#voiceSelect'); if (sel) sel.innerHTML = voiceOptionsHTML();
      updateVoiceNote();
    };
  } catch (e) {}
}

/* ---------- boot ---------- */
initStars();
persist();
applyRoute(false);
})();
