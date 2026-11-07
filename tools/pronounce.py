"""تطبيق قاموس النطق (www/data/pronounce.json) على نص الشرح قبل تحويله لصوت."""
import json, os, re
_D = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'www', 'data', 'pronounce.json'), encoding='utf-8'))['words']
_PRE = ['وبال', 'وفال', 'وال', 'فال', 'بال', 'كال', 'ولل', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك', '']
_TOK = re.compile(r'[ء-ي٠-٩ً-ْٰ]+')

def _word(w):
    if any('ً' <= ch <= 'ْ' for ch in w):
        return w  # مشكول مسبقاً
    for p in _PRE:
        if w.startswith(p):
            rest = w[len(p):]
            if rest in _D:
                return p + _D[rest]
    return w

def apply(text):
    return _TOK.sub(lambda m: _word(m.group(0)), text)

if __name__ == '__main__':
    import sys
    print(apply(sys.argv[1]))
