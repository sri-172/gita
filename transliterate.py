#!/usr/bin/env python3
"""Devanagari -> Telugu script transliteration.

Used for short metadata (chapter colophons, word-by-word Sanskrit headwords,
speaker names). The full shlokas come from the Telugu Wikisource corpus in
src/telugu/verses.json, which is already in authentic Telugu lipi.
"""
import re

# Most Devanagari letters map to the Telugu block at a fixed +0x300 offset.
_MAP = {}
for _cp in list(range(0x0901, 0x0904)) + list(range(0x0905, 0x090B)) \
        + list(range(0x0915, 0x093A)) + list(range(0x093E, 0x094D)) \
        + list(range(0x0966, 0x0970)):
    _MAP[chr(_cp)] = chr(_cp + 0x300)
_MAP.update({
    'ऋ': 'ఋ',       # vocalic R
    'ऌ': 'ఌ',       # vocalic L
    'ॠ': 'ౠ',       # vocalic RR
    'ॡ': 'ౡ',       # vocalic LL
    'ॢ': 'ౢ',       # vocalic L matra
    'ॣ': 'ౣ',
    'ए': 'ఏ', 'ऐ': 'ఐ', 'ओ': 'ఓ', 'औ': 'ఔ',
    'ऍ': 'ఎ', 'ఎ': 'ఎ', 'ऑ': 'ఒ', 'ఒ': 'ఒ',
    '्': '్',       # virama
    'ऽ': 'ఽ',       # avagraha
    'ॐ': 'ఓం',
    '।': '.', '॥': '.',   # danda -> Latin period (keep UI fully Telugu/Latin)
    '़': '',        # nukta — drop
})

# In Telugu, homorganic nasal + stop conjuncts are written with the anusvara.
_NASAL = [
    (r'ఙ్(?=[కఖగఘ])', 'ం'),
    (r'ఞ్(?=[చఛజఝ])', 'ం'),
    (r'ణ్(?=[టఠడఢ])', 'ం'),
    (r'న్(?=[తథదధ])', 'ం'),
    (r'మ్(?=[పఫబభ])', 'ం'),
]


def dev_to_tel(text):
    if not text:
        return ''
    out = ''.join(_MAP.get(ch, ch) for ch in str(text))
    for pattern, repl in _NASAL:
        out = re.sub(pattern, repl, out)
    return out


SPEAKER_TE = {
    'श्रीभगवान्': 'శ్రీ భగవానుడు',
    'अर्जुन': 'అర్జునుడు',
    'सञ्जय': 'సంజయుడు',
    'धृतराष्ट्र': 'ధృతరాష్ట్రుడు',
}

if __name__ == '__main__':
    for s in ['कर्मणि', 'अधिकारः', 'धर्मक्षेत्रे कुरुक्षेत्रे',
              'ॐ तत्सदिति श्रीमद्भगवद्गीतासूपनिषत्सु', 'सङ्गोऽस्त्वकर्मणि', 'पाण्डवाश्चैव']:
        print(s, '->', dev_to_tel(s))
