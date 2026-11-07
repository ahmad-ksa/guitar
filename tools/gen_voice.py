"""يولّد ملفات الشرح الصوتي العربي بصوت عصبي طبيعي (Microsoft Edge neural TTS عبر مكتبة edge-tts).
الاستخدام: python tools/gen_voice.py voice-list.json www/audio/voice [VOICE] [--pronounce]
--pronounce: يطبّق قاموس النطق (www/data/pronounce.json) على النص قبل النطق.
"""
import asyncio, json, os, sys
import edge_tts

args = [a for a in sys.argv[1:] if not a.startswith('--')]
LIST, OUT = args[0], args[1]
VOICE = args[2] if len(args) > 2 else 'ar-SA-HamedNeural'
PRON = '--pronounce' in sys.argv
if PRON:
    sys.path.insert(0, os.path.dirname(__file__))
    import pronounce
speak = (lambda t: pronounce.apply(t)) if PRON else (lambda t: t)
os.makedirs(OUT, exist_ok=True)
items = json.load(open(LIST, encoding='utf-8'))
# ما نُطق فعلاً لكل ملف، حتى نعيد توليد الملفات التي تغيّر نطقها فقط
SPOKEN = os.path.join(OUT, 'spoken.json')
try: spoken = json.load(open(SPOKEN, encoding='utf-8'))
except Exception: spoken = {}
sem = asyncio.Semaphore(6)
ok, failed = [], []

async def one(it):
    path = os.path.join(OUT, it['id'] + '.mp3')
    text = speak(it['text'])
    if os.path.exists(path) and os.path.getsize(path) > 1000 and spoken.get(it['id'], it['text']) == text:
        spoken[it['id']] = text
        ok.append(it['id']); return
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, VOICE, rate='-6%').save(path)
                if os.path.getsize(path) > 1000:
                    spoken[it['id']] = text
                    ok.append(it['id']); return
            except Exception as e:
                err = e
            await asyncio.sleep(2 + attempt * 3)
        failed.append(it['id'])
        if os.path.exists(path): os.remove(path)
        print('FAILED', it['id'], err if 'err' in dir() else '', flush=True)

async def main():
    await asyncio.gather(*(one(it) for it in items))
    # حذف ملفات قديمة لم تعد مستخدمة
    keep = {i['id'] for i in items}
    for f in os.listdir(OUT):
        if f.endswith('.mp3') and f[:-4] not in keep: os.remove(os.path.join(OUT, f))
    json.dump(sorted(ok), open(os.path.join(OUT, 'index.json'), 'w'))
    json.dump({k: v for k, v in spoken.items() if k in keep}, open(SPOKEN, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'generated {len(ok)} / {len(items)}, failed {len(failed)}')

asyncio.run(main())
