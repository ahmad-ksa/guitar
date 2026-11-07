# توليد عينات صوتية بنموذج SILMA TTS (Apache-2.0) للمقارنة مع الصوت الحالي
import json, sys, os, glob, subprocess
import silma_tts.api as api
from silma_tts.api import SilmaTTS
items = json.load(open(sys.argv[1]))
out = sys.argv[2]; os.makedirs(out, exist_ok=True)
pkg = os.path.dirname(os.path.abspath(api.__file__))
refs = glob.glob(os.path.join(pkg, '**', '*ar*ref*.wav'), recursive=True) + glob.glob(os.path.join(pkg, '**', '*.wav'), recursive=True)
print('refs', refs[:5])
tts = SilmaTTS()
for i, it in enumerate(items[:6]):
    wav_path = os.path.join(out, f"silma_{i}.wav")
    tts.infer(ref_file=refs[0], ref_text='', gen_text=it['text'], file_wave=wav_path, seed=7, speed=1)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav_path, '-b:a', '64k', wav_path.replace('.wav', '.mp3')])
    print(i, it['text'][:60])
