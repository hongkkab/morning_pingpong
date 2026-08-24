from pathlib import Path
s=Path('table-tennis-elo.html').read_text(encoding='utf-8')
needles=[
 'const app = A.initializeApp(c);',
 'const S = { players:[]',
 'const mt=S.meTab',
 '<button data-metab="rec"',
 'S.me=P(id); await sSet',
 'S.me=P(p.id); await sSet',
 'function matchCardHTML(m){',
 '<div class="macts" id="act_${m.id}"',
 "document.querySelectorAll('[data-ok]')",
]
for needle in needles:
    i=s.find(needle)
    print('NEEDLE', needle, 'IDX', i)
    print(repr(s[i:i+700] if i>=0 else ''))
