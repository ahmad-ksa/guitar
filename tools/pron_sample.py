"""عينات قبل/بعد قاموس النطق للمقارنة بالأذن."""
import asyncio, json, os, sys, re
import edge_tts
sys.path.insert(0, os.path.dirname(__file__))
import pronounce
items = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]; os.makedirs(out, exist_ok=True)
def score(t): return sum(1 for w in pronounce._TOK.findall(t) if pronounce._word(w) != w)
# جمل قصيرة فيها أكثر الكلمات المعدّلة، مع ضمان وجود «فرت»
cands = sorted([i for i in items if len(i['text']) < 260], key=lambda i: -score(i['text']) / (len(i['text']) ** 0.5))
pick = [i for i in cands if 'فرت' in i['text']][:3]
for i in cands:
    if len(pick) >= 8: break
    if i not in pick: pick.append(i)
lines = []
async def go():
    for n, it in enumerate(pick, 1):
        await edge_tts.Communicate(it['text'], 'ar-SA-HamedNeural', rate='-6%').save(f'{out}/{n}_before.mp3')
        await edge_tts.Communicate(pronounce.apply(it['text']), 'ar-SA-HamedNeural', rate='-6%').save(f'{out}/{n}_after.mp3')
        lines.append(f'{n}) {it["text"]}\n   بعد: {pronounce.apply(it["text"])}\n')
asyncio.run(go())
open(f'{out}/sentences.txt', 'w', encoding='utf-8').write('\n'.join(lines))
print('\n'.join(lines))
