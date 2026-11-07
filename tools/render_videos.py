"""يصنع فيديو MP4 لكل درس من محرك www/video (رسم إطار بإطار + شريط صوت كامل).
الاستخدام: python tools/render_videos.py OUT_DIR [lesson ids...|all] [--shard i/n] [--base http://localhost:8765]
يتخطى الدروس التي لم يتغير محتواها (بصمة في OUT_DIR/manifest.json).
"""
import asyncio, base64, hashlib, json, os, subprocess, sys, time
from playwright.async_api import async_playwright

args = [a for a in sys.argv[1:] if not a.startswith('--')]
OUT = args[0]; IDS = args[1:] or ['all']
opt = lambda k, d=None: next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == k and i + 1 < len(sys.argv)), d)
BASE = opt('--base', 'http://localhost:8765')
SHARD = opt('--shard')
REMOTE = '--remote' in sys.argv  # manifest.json منزّل من الإصدار: لا نحتاج الملفات محلياً
os.makedirs(OUT, exist_ok=True)
BATCH = 12

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'{BASE}/video/index.html'); await pg.wait_for_function('window.videoReady')
        ids = IDS
        if ids == ['all']:
            ids = await pg.evaluate("window.videoLessonIds()")
        print(len(ids), 'lessons', flush=True)
        if SHARD:
            i, n = map(int, SHARD.split('/')); ids = ids[i::n]
        man_path = os.path.join(OUT, 'manifest.json')
        try: manifest = json.load(open(man_path))
        except Exception: manifest = {}
        for lid in ids:
            # بصمة المحتوى: نص الدرس + نسخة المحرك
            sig = await pg.evaluate("id => window.videoLessonSig(id)", lid)
            eng = ''.join(open(os.path.join(os.path.dirname(__file__), '..', 'www', 'video', f), encoding='utf-8').read() for f in ('render.js', 'figures.js'))
            h = hashlib.sha1((sig + eng).encode()).hexdigest()[:16]
            mp4 = os.path.join(OUT, f'{lid}.mp4')
            if manifest.get(lid, {}).get('hash') == h and (REMOTE or os.path.exists(mp4)):
                print('skip', lid, flush=True); continue
            t0 = time.time()
            await pg.goto(f'{BASE}/video/index.html'); await pg.wait_for_function('window.videoReady')
            info = await pg.evaluate(f"window.videoPrepare('{lid}')")
            wav = os.path.join(OUT, f'{lid}.wav')
            open(wav, 'wb').write(base64.b64decode(await pg.evaluate('window.videoAudio()')))
            nfr = int(info['duration'] * info['fps']) + 1
            ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(info['fps']), '-c:v', 'mjpeg', '-i', '-', '-i', wav,
                                   '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-tune', 'animation', '-pix_fmt', 'yuv420p',
                                   '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', mp4], stdin=subprocess.PIPE)
            for k in range(0, nfr, BATCH):
                ts = [j / info['fps'] for j in range(k, min(nfr, k + BATCH))]
                urls = await pg.evaluate("ts => ts.map(t => { window.videoFrame(t); return document.getElementById('cv').toDataURL('image/jpeg', 0.9); })", ts)
                for u in urls: ff.stdin.write(base64.b64decode(u.split(',', 1)[1]))
            ff.stdin.close(); ff.wait(); os.remove(wav)
            manifest[lid] = {'hash': h, 'duration': round(info['duration'], 1), 'size': os.path.getsize(mp4)}
            json.dump(manifest, open(man_path, 'w'), indent=1)
            rp = os.path.join(OUT, 'rendered.json')
            try: rendered = json.load(open(rp))
            except Exception: rendered = {}
            rendered[lid] = manifest[lid]; json.dump(rendered, open(rp, 'w'), indent=1)
            print(f"{lid}: {info['duration']:.0f}s video, missing voices {info['missingVoice']}, {os.path.getsize(mp4)/1e6:.1f}MB in {time.time()-t0:.0f}s", flush=True)
        if errs: print('PAGE ERRORS', errs[:5])
        await b.close()

asyncio.run(main())
