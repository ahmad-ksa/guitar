#!/usr/bin/env bash
# يجمع كل فيديوهات الدروس بالترتيب في فيديو واحد مع فصول بأسماء الدروس
set -e
OUT=${1:-guitar-academy-all-lessons.mp4}
mkdir -p /tmp/fv && rm -rf /tmp/fv/videos
git fetch --depth 1 origin gh-pages && git archive FETCH_HEAD videos | tar -x -C /tmp/fv
node --input-type=module -e "
import fs from 'fs';
const m = await import('$(pwd)/www/js/lessons/index.js');
const ids = []; m.LEVELS.forEach(lv => lv.units.forEach(u => u.lessons.forEach(l => ids.push([l.id, l.title]))));
fs.writeFileSync('/tmp/fv/ids.json', JSON.stringify(ids));"
python3 - <<'PY'
import json, subprocess
ids = json.load(open('/tmp/fv/ids.json')); t = 0
ch = [';FFMETADATA1', 'title=أكاديمية الجيتار — كل الدروس بالفيديو']
lst = []
for i, (lid, title) in enumerate(ids, 1):
    f = f'/tmp/fv/videos/{lid}.mp4'
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).strip())
    ch += ['[CHAPTER]', 'TIMEBASE=1/1000', f'START={int(t*1000)}', f'END={int((t+d)*1000)}', f'title={i}. {title}']; t += d
    lst.append(f"file '{f}'")
open('/tmp/fv/chapters.txt', 'w').write('\n'.join(ch) + '\n'); open('/tmp/fv/list.txt', 'w').write('\n'.join(lst))
print('minutes', round(t / 60, 1))
PY
ffmpeg -y -loglevel error -f concat -safe 0 -i /tmp/fv/list.txt -i /tmp/fv/chapters.txt -map_metadata 1 -map_chapters 1 -c copy -movflags +faststart "$OUT"
ls -la "$OUT"
