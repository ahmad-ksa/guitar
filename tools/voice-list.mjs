// يجمع كل نصوص الشرح المسموع من الدروس ويكتب قائمة لسكربت توليد الأصوات
import { writeFileSync } from 'node:fs';
import { ALL, LEVELS } from '../www/js/lessons/index.js';
import { cleanForSpeech, voiceKey } from '../www/js/voicekey.js';

const texts = new Map();
const add = t => { if (t && cleanForSpeech(t)) texts.set(voiceKey(t), cleanForSpeech(t)); };
for (const l of ALL) (l.steps || []).forEach(s => add(s.say));
add('مرحباً بك في أكاديمية الجيتار. هذا اختبار للصوت العربي.');
const list = [...texts].map(([id, text]) => ({ id, text }));
writeFileSync(process.argv[2] || 'voice-list.json', JSON.stringify(list, null, 1));
console.log(`${list.length} نصاً`);
