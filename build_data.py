#!/usr/bin/env python3
"""Distil the vedicscriptures/bhagavad-gita dataset into a compact offline bundle."""
import json, re, glob, os, html
from transliterate import dev_to_tel, SPEAKER_TE

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
TELUGU_SRC = os.path.join(SRC, 'telugu')
OUT = os.path.join(ROOT, 'gita-data.json')

EN_KEYS = [
    ('siva',    'Swami Sivananda'),
    ('purohit', 'Shri Purohit Swami'),
    ('adi',     'Swami Adidevananda'),
    ('gambir',  'Swami Gambirananda'),
    ('san',     'Dr. S. Sankaranarayan'),
    ('prabhu',  'A. C. Bhaktivedanta Swami Prabhupada'),
]
TE_AUTHORS = ['తెలుగు వికీసోర్స్ · భగవద్గీత తెలుగు అనువాదము (CC BY-SA 4.0)']
TE_SHORT = ['వికీసోర్స్']
THEME_TE = {
    'karma': 'కర్మ & ధర్మం', 'bhakti': 'భక్తి & ప్రేమ', 'jnana': 'జ్ఞానం & వివేకం',
    'dhyana': 'మనస్సు & ధ్యానం', 'dharma': 'ధర్మం & సద్గుణం', 'vairagya': 'వైరాగ్యం',
    'shaurya': 'ధైర్యం & దుఃఖం', 'kala': 'కాలం & మరణం', 'prakriti': 'ప్రకృతి & గుణాలు',
    'shanti': 'శాంతి & ఆనందం', 'atman': 'ఆత్మ & అహం', 'sharanagati': 'శరణాగతి & కృప',
}

# Curated editorial layer: acts, hues, essences, anchor verses.
META = [
    # (act, hue, essence, key verse, tags)
    (0, 22,  "A warrior lays down his bow. From that collapse, the greatest dialogue begins.", [1, 47], ["dilemma", "grief", "the question"]),
    (0, 32,  "You are not the body. Act fully, and let go of the fruit.", [2, 47], ["soul", "karma", "detachment"]),
    (0, 40,  "Work becomes worship when the ego steps aside.", [3, 9], ["karma", "service", "sacrifice"]),
    (0, 46,  "Whenever dharma declines, the Divine descends again.", [4, 7], ["avatar", "knowledge", "dharma"]),
    (0, 50,  "Be a lotus in water: acting, yet untouched.", [5, 10], ["renunciation", "purity", "action"]),
    (0, 44,  "The mind can be your greatest friend — or your worst enemy.", [6, 5], ["meditation", "mind", "yoga"]),
    (1, 38,  "There is nothing higher than the Divine; all things rest there.", [7, 7], ["knowledge", "god", "maya"]),
    (1, 28,  "Whatever you remember in the last moment shapes where you go.", [8, 6], ["death", "remembrance", "time"]),
    (1, 18,  "A leaf, a flower, a fruit — offered with love, it is enough.", [9, 22], ["devotion", "grace", "offering"]),
    (1, 12,  "Wherever there is brilliance, know it as a spark of the Divine.", [10, 41], ["glory", "manifestation", "wonder"]),
    (1, 6,   "Arjuna is shown the universe inside a single form.", [11, 32], ["cosmic form", "time", "awe"]),
    (1, 348, "Beyond practice and knowledge, love is the shortest path.", [12, 12], ["bhakti", "love", "surrender"]),
    (2, 176, "The body is the field. You are the one who knows it.", [13, 1], ["field", "knower", "self"]),
    (2, 200, "Sattva, rajas, tamas — the three threads, and how to rise above them.", [14, 20], ["gunas", "nature", "freedom"]),
    (2, 222, "An upside-down tree of existence, rooted in the highest.", [15, 1], ["supreme", "tree", "world"]),
    (2, 258, "Three gates to darkness: desire, anger and greed.", [16, 21], ["virtue", "vice", "discipline"]),
    (2, 280, "As a person's faith, so that person becomes.", [17, 3], ["faith", "food", "giving"]),
    (2, 300, "Abandon all else, remember the Divine, and act. This is freedom.", [18, 66], ["surrender", "moksha", "final teaching"]),
]
ACTS = [
    {"name": "Karma Kāṇḍa", "sub": "The Yoga of Action", "chapters": "1–6", "desc": "Arjuna's crisis becomes the soil for a teaching on work, self and discipline."},
    {"name": "Bhakti Kāṇḍa", "sub": "The Yoga of Devotion", "chapters": "7–12", "desc": "Krishna reveals his nature, his glories, and the path of loving surrender."},
    {"name": "Jñāna Kāṇḍa", "sub": "The Yoga of Knowledge", "chapters": "13–18", "desc": "The field and the knower, the gunas, and the final word on freedom."},
]

GEMS = [
    ([2, 47], "The art of action", "Do your work. Release the outcome."),
    ([2, 20], "The deathless self", "The soul is never born; it never dies."),
    ([2, 14], "The law of change", "Pleasure and pain come and go. Endure them."),
    ([2, 62], "The chain of thought", "Dwelling on objects breeds attachment."),
    ([2, 63], "The fall of anger", "From anger comes delusion; from delusion, ruin."),
    ([3, 9], "Work as offering", "Action becomes bondage only when it is not sacrifice."),
    ([4, 7], "The promise", "Whenever dharma fades, I manifest myself."),
    ([5, 10], "The lotus leaf", "Act without attachment, as water slides off a lotus."),
    ([6, 5], "Master of the mind", "Lift yourself by yourself; do not lower yourself."),
    ([8, 6], "The final thought", "Whatever one remembers at death determines one's destination."),
    ([9, 22], "Grace", "To those ever united with me, I carry what they lack."),
    ([9, 27], "Offer everything", "Whatever you do, do it as an offering."),
    ([10, 20], "The beginning", "I am the Self seated in the heart of all beings."),
    ([11, 32], "Time unveiled", "I am mighty Time, the destroyer of the worlds."),
    ([12, 12], "The ladder of love", "Better than practice is knowledge; better still, renunciation."),
    ([13, 27], "One light, many forms", "The same Divine dwells in every being."),
    ([15, 1], "The eternal tree", "The world is a tree with roots above and branches below."),
    ([16, 21], "The three gates", "Lust, anger and greed — the gates to hell."),
    ([18, 66], "The final word", "Surrender all dharmas to me; I will free you."),
    ([18, 78], "The benediction", "Where Krishna and Arjuna are, there is victory."),
]

THEMES = [
    {"id": "karma",     "name": "Action & Duty",       "icon": "✦", "words": ["action", "work", "duty", "deed", "fruit", "perform", "acts", "labour", "task"]},
    {"id": "bhakti",    "name": "Devotion & Love",     "icon": "❋", "words": ["devotion", "devotee", "worship", "love", "surrender", "refuge", "adore", "faith", "offer"]},
    {"id": "jnana",     "name": "Knowledge & Wisdom",  "icon": "◈", "words": ["knowledge", "wisdom", "wise", "understand", "realize", "truth", "learned", "ignorance", "knower"]},
    {"id": "dhyana",    "name": "Mind & Meditation",   "icon": "◎", "words": ["meditation", "mind", "contemplation", "concentrat", "senses", "yoga", "thought", "steady"]},
    {"id": "dharma",    "name": "Dharma & Virtue",     "icon": "⚖", "words": ["dharma", "righteous", "virtue", "duty", "moral", "sin", "purity", "scripture"]},
    {"id": "vairagya",  "name": "Detachment",          "icon": "❈", "words": ["attach", "detach", "desire", "renounc", "abandon", "longing", "craving", "indifferen"]},
    {"id": "shaurya",   "name": "Courage & Grief",     "icon": "⚔", "words": ["fear", "grief", "sorrow", "courage", "fight", "battle", "warrior", "slay", "enemy", "hero"]},
    {"id": "kala",      "name": "Time & Death",        "icon": "◷", "words": ["death", "birth", "time", "end", "depart", "die", "mortal", "worlds", "eternal"]},
    {"id": "prakriti",  "name": "Nature & the Guṇas",  "icon": "☘", "words": ["nature", "modes", "sattva", "rajas", "tamas", "material", "elements", "creation", "gunas"]},
    {"id": "shanti",    "name": "Peace & Joy",         "icon": "☾", "words": ["peace", "bliss", "happiness", "tranquil", "serenity", "calm", "joy", "delight"]},
    {"id": "atman",     "name": "The Self & Soul",     "icon": "✧", "words": ["self", "soul", "spirit", "atman", "immortal", "embodied", "eternal", "within", "heart"]},
    {"id": "sharanagati","name": "Surrender & Grace",  "icon": "✧", "words": ["surrender", "refuge", "grace", "mercy", "protect", "liberate", "unto me", "in me", "my devotee"]},
]

QUIZ = [
    {"q": "Which verse says you have a right to action, but never to its fruits?", "a": 0, "o": ["BG 2.47", "BG 3.9", "BG 4.7", "BG 18.66"], "v": [2, 47], "why": "Krishna's most quoted teaching on desireless action."},
    {"q": "What does Krishna promise in BG 4.7?", "a": 1, "o": ["To end all wars", "To manifest whenever dharma declines", "To make Arjuna immortal", "To reveal the future"], "v": [4, 7], "why": "'Whenever there is a decline of righteousness, I manifest Myself.'"},
    {"q": "Which verse declares the soul is never born and never dies?", "a": 2, "o": ["BG 1.47", "BG 2.13", "BG 2.20", "BG 8.5"], "v": [2, 20], "why": "'He is not slain when the body is slain.'"},
    {"q": "According to BG 6.5, the mind can be…", "a": 0, "o": ["Your friend or your enemy", "Destroyed by fasting", "Always pure", "The same as the soul"], "v": [6, 5], "why": "'One must lift oneself by oneself; one should not degrade oneself.'"},
    {"q": "Which verse calls Krishna 'mighty Time, the destroyer of the worlds'?", "a": 3, "o": ["BG 9.22", "BG 10.20", "BG 11.12", "BG 11.32"], "v": [11, 32], "why": "Spoken during the revelation of the cosmic form."},
    {"q": "In BG 9.27, what are we asked to do with everything we do?", "a": 1, "o": ["Renounce it entirely", "Offer it to the Divine", "Teach it to others", "Forget it"], "v": [9, 27], "why": "'Whatever you do, whatever you eat… do that as an offering unto Me.'"},
    {"q": "BG 16.21 names three gates to darkness. They are:", "a": 0, "o": ["Desire, anger and greed", "Pride, fear and doubt", "Sleep, hunger and pain", "Wealth, fame and power"], "v": [16, 21], "why": "'Triple is the gate of this hell, destructive of the self.'"},
    {"q": "What is the final instruction of the Gita?", "a": 2, "o": ["Fight bravely", "Renounce the world", "Abandon all dharmas and take refuge in the Divine", "Study the Vedas"], "v": [18, 66], "why": "BG 18.66 — 'I shall liberate you from all sins; grieve not.'"},
    {"q": "Which chapter contains only 20 verses and describes the path of devotion?", "a": 3, "o": ["Chapter 6", "Chapter 9", "Chapter 10", "Chapter 12"], "v": [12, 1], "why": "Bhakti Yoga is the shortest chapter of the Gita."},
    {"q": "BG 18.78 declares that where Krishna and Arjuna are, there is…", "a": 1, "o": ["Silence", "Prosperity, victory and firm policy", "Eternal night", "The end of time"], "v": [18, 78], "why": "Sanjaya's closing benediction ends the dialogue."},
]

NUM_RE = re.compile(r'^\s*(?:।।\s*)?\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s*(?:।।|\.|\)|:|-|–)?\s*')
DEV = r'\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF'
WORD_RE = re.compile(r'^([%s]+(?:[\s\-][%s]+)*)\s+(.+?)\s*[\.\?]?$' % (DEV, DEV))


def clean(t):
    if not t:
        return ''
    t = html.unescape(t)
    t = t.replace('\u00a0', ' ').replace('\u200c', '').replace('\u200d', '')
    t = NUM_RE.sub('', t)
    t = re.sub(r'^\s*[।\|]{2}\s*', '', t)
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'\s*\|\|\s*\d+\s*\|\|\s*$', '', t)
    if 'did not comment on this' in t.lower() or t.lower().startswith('no commentary'):
        return ''
    return t.strip(' .;')


def clip(t, n):
    t = t or ''
    if len(t) <= n:
        return t
    cut = t[:n]
    p = max(cut.rfind('. '), cut.rfind('? '), cut.rfind('! '), cut.rfind('। '))
    if p > n * .55:
        return cut[:p + 1].strip()
    return cut.rsplit(' ', 1)[0].rstrip(' ,;:') + '…'


def words_from(ec, c, v):
    """Turn Sivananda's 'word meaning? word meaning.' preamble into [[sanskrit, gloss], ...]."""
    if not ec:
        return []
    s = re.sub(r'^\s*\d{1,2}\.\d{1,2}\s*', '', ec)
    s = re.split(r'(?i)\bcommentary\b|\bcomment\b|\bword meaning', s)[0]
    out = []
    for chunk in re.split(r'[?？]', s):
        chunk = chunk.strip().strip('.').strip()
        if not chunk:
            continue
        m = WORD_RE.match(chunk)
        if not m:
            continue
        sk, gloss = m.group(1).strip(), m.group(2).strip(' .?-')
        if not sk or not gloss or len(sk) > 55 or len(gloss) > 120:
            continue
        if not re.match(r'[A-Za-z]', gloss):
            continue
        out.append([sk, gloss])
        if len(out) >= 40:
            break
    return out


def clean_te_shloka(t):
    t = (t or '').strip()
    t = re.sub(r'\s*\|\|\s*[\d\u0c66-\u0c6f\s\-]+\|\|\s*$', '', t)
    lines = [l.strip() for l in t.split('\n') if l.strip()]
    if lines and 'ఉవాచ' in lines[0] and len(lines[0]) <= 46:
        lines = lines[1:]
    return '\n'.join(lines)


def main():
    TE = json.load(open(os.path.join(TELUGU_SRC, 'verses.json'), encoding='utf-8'))
    TE_CH = json.load(open(os.path.join(TELUGU_SRC, 'chapters.json'), encoding='utf-8'))
    te_verse = {(x['chapter_id'], x['verse_number']): x for x in TE}
    te_chapter = {x['id']: x for x in TE_CH}
    chapters = []
    for c in range(1, 19):
        d = json.load(open(f'{SRC}/chapter/bhagavadgita_chapter_{c}.json', encoding='utf-8'))
        t = te_chapter[c]
        act, hue, essence, key, tags = META[c - 1]
        chapters.append({
            'n': c, 'sk': t['name_telugu'], 'tr': d['transliteration'], 'en': d['translation'],
            'meaningEn': d['meaning']['en'], 'meaningTe': t['name_meaning_telugu'],
            'sumEn': clip(clean(d['summary']['en']), 900), 'sumTe': clip(clean(t['summary_telugu']), 900),
            'count': d['verses_count'], 'act': act, 'hue': hue, 'essence': essence,
            'key': key, 'tags': tags,
        })

    verses, colophons = [], []
    for c in range(1, 19):
        for v in range(1, chapters[c - 1]['count'] + 2):
            f = f'{SRC}/slok/bhagavadgita_chapter_{c}_slok_{v}.json'
            if not os.path.exists(f):
                continue
            d = json.load(open(f, encoding='utf-8'))
            is_colophon = v > chapters[c - 1]['count']
            sk = (d.get('slok') or '').strip()
            tr = (d.get('transliteration') or '').strip()
            # strip trailing verse-number marks from the Sanskrit text itself
            sk = re.sub(r'\s*\|\|[\d-]+\|\|\s*$', '', sk)
            tr = re.sub(r'\s*\|\|[\d-]+\|\|\s*$', '', tr)
            # The dataset prefixes some verses with "X uvāca |" — we show the speaker as its own badge.
            def strip_speaker(text, is_sk):
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                if lines and len(lines[0]) <= 46 and (
                        (is_sk and ('उवाच' in lines[0])) or
                        (not is_sk and re.search(r'uvāca|uvaca', lines[0]))):
                    lines = lines[1:]
                return '\n'.join(lines)
            sk = strip_speaker(sk, True)
            tr = strip_speaker(tr, False)
            if is_colophon:
                colophons.append([c, dev_to_tel(sk), tr])
                continue
            t = te_verse[(c, v)]
            te_shloka = clean_te_shloka(t['text_telugu'])
            te_translation = clip(clean(t['translation_telugu']), 700)
            te_commentary = clip(clean(t.get('commentary_telugu') or ''), 1400)
            te_context = clip(clean(t.get('context_telugu') or ''), 700)
            en = [clip(clean((d.get(k) or {}).get('et', '')), 700) for k, _ in EN_KEYS]
            siva_ec = (d.get('siva') or {}).get('ec', '') or ''
            com_en = clip(clean(re.split(r'(?i)\bcommentary\b', siva_ec)[-1]) if 'ommentary' in siva_ec else '', 1700)
            purport = clip(clean((d.get('prabhu') or {}).get('ec', '')), 1900)
            words = [[dev_to_tel(w[0]), w[1]] for w in words_from(siva_ec, c, v)]
            speaker_raw = d.get('speaker', '')
            verses.append([
                c, v, te_shloka, tr, SPEAKER_TE.get(speaker_raw, dev_to_tel(speaker_raw)),
                en, [te_translation], words, com_en, te_commentary, purport, te_context,
            ])

    # This recension contains 701 numbered verses (the traditional count is 700);
    # the 18 chapter-ending colophons are stored separately.
    assert len(verses) == 701, f'expected 701 verses, got {len(verses)}'
    assert len(colophons) == 18, f'expected 18 colophons, got {len(colophons)}'
    assert all(ch['count'] == sum(1 for x in verses if x[0] == ch['n']) for ch in chapters)

    bundle = {
        'chapters': chapters,
        'verses': verses,
        'colophons': colophons,
        'acts': ACTS,
        'gems': GEMS,
        'themes': [{'id': t['id'], 'name': t['name'], 'nameTe': THEME_TE.get(t['id'], t['name']),
                    'icon': t['icon'], 'words': t['words']} for t in THEMES],
        'quiz': QUIZ,
        'enAuthors': [a for _, a in EN_KEYS],
        'teAuthors': TE_AUTHORS,
        'teShort': TE_SHORT,
        'audioLang': 'te-IN',
        'scriptLang': 'te',
        'source': 'Scripture & English translations: vedicscriptures/bhagavad-gita (GPL-3.0). Telugu shlokas, translations & commentary: te.wikisource.org — భగవద్గీత తెలుగు అనువాదము (CC BY-SA 4.0), via nvkudva/Bhagavad-Geeta. Fonts: Cormorant Garamond, Manrope, Noto Serif Telugu (SIL OFL).',
        'teluguSource': 'te.wikisource.org — భగవద్గీత తెలుగు అనువాదము (CC BY-SA 4.0), compiled in github.com/nvkudva/Bhagavad-Geeta. Telugu commentary is an IndicTrans2 machine translation of an English commentary.',
    }
    # Final scrub: no Devanagari character should remain in anything the UI shows.
    # (A few source glosses/commentaries quote Sanskrit words inline.)
    def scrub(x):
        if isinstance(x, str):
            return dev_to_tel(x)
        if isinstance(x, list):
            return [scrub(i) for i in x]
        if isinstance(x, dict):
            return {k: scrub(v) for k, v in x.items()}
        return x
    bundle = scrub(bundle)

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(bundle, f, ensure_ascii=False, separators=(',', ':'))
    print('verses', len(verses), 'colophons', len(colophons), 'bytes', os.path.getsize(OUT))
    print('word-meaning verses', sum(1 for x in verses if x[7]))
    print('en commentaries', sum(1 for x in verses if x[8]), 'te commentaries', sum(1 for x in verses if x[9]), 'purports', sum(1 for x in verses if x[10]))
    print('telugu shlokas', sum(1 for x in verses if x[2]), 'telugu translations', sum(1 for x in verses if x[6][0]), 'telugu context', sum(1 for x in verses if x[11]))
    for i in range(6):
        print('en', i, sum(1 for x in verses if x[5][i]))


if __name__ == '__main__':
    main()
