"""يولّد ملفات الشرح الصوتي العربي بصوت عصبي طبيعي (Microsoft Edge neural TTS عبر مكتبة edge-tts).
الاستخدام: python tools/gen_voice.py voice-list.json www/audio/voice [VOICE]
"""
import asyncio, json, os, sys
import edge_tts

LIST, OUT = sys.argv[1], sys.argv[2]
VOICE = sys.argv[3] if len(sys.argv) > 3 else 'ar-SA-HamedNeural'
os.makedirs(OUT, exist_ok=True)
items = json.load(open(LIST, encoding='utf-8'))
sem = asyncio.Semaphore(6)
ok, failed = [], []

async def one(it):
    path = os.path.join(OUT, it['id'] + '.mp3')
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        ok.append(it['id']); return
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(it['text'], VOICE, rate='-6%').save(path)
                if os.path.getsize(path) > 1000:
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
    print(f'generated {len(ok)} / {len(items)}, failed {len(failed)}')

asyncio.run(main())
