import collections
import datetime
import json
import urllib.parse
import urllib.request
API_KEY='AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U'
BASE='https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app/clubs/morning'
def req(url,data=None,method=None):
    body=None; headers={}
    if data is not None:
        body=json.dumps(data).encode('utf-8'); headers['Content-Type']='application/json'
    r=urllib.request.Request(url,data=body,headers=headers,method=method or ('POST' if data is not None else 'GET'))
    with urllib.request.urlopen(r,timeout=80) as resp:
        raw=resp.read(); return json.loads(raw.decode('utf-8')) if raw else None
tok=req(f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}',{'returnSecureToken':True})['idToken']
def get(path): return req(f'{BASE}/{path}.json?auth={urllib.parse.quote(tok)}')
def as_list(v):
    if not v: return []
    if isinstance(v,list): return [x for x in v if x]
    if isinstance(v,dict): return list(v.values())
    return []
def iso_week(x):
    try:
        d=datetime.date.fromisoformat(str(x)[:10]); y,w,_=d.isocalendar(); return f'{y}-W{w:02d}'
    except Exception: return ''
settings=get('settings') or {}; meta=get('meta') or {}; matches=as_list(get('matches')); players=as_list(get('players'))
print('settings keys', list(settings.keys()))
print('meta keys', list(meta.keys()))
print('total matches', len(matches), 'players', len(players))
print('\nMATCH league counts')
lc=collections.Counter(); bounds=collections.defaultdict(lambda:[None,None]); wcnt=collections.defaultdict(collections.Counter)
for m in matches:
    lg=m.get('lg') or m.get('league') or '(none)'
    lc[lg]+=1
    d=m.get('date') or ''
    if d:
        bounds[lg][0]=d if bounds[lg][0] is None else min(bounds[lg][0],d)
        bounds[lg][1]=d if bounds[lg][1] is None else max(bounds[lg][1],d)
        if d.startswith('2026'):
            wcnt[lg][m.get('rd') or m.get('round') or iso_week(d)]+=1
for lg,c in lc.most_common():
    print(lg,c,bounds[lg][0],bounds[lg][1])
    if wcnt[lg]:
        print('  2026 rounds:', ' '.join(f'{k}:{v}' for k,v in sorted(wcnt[lg].items())))
print('\nMETA round key prefixes')
rounds=meta.get('rounds') or {}
pc=collections.Counter(str(k).split('|',1)[0] for k in rounds)
for p,c in pc.most_common(): print(p,c)
print('\nMETA sample 2026 rounds')
for k,v in sorted(rounds.items()):
    if '2026' in str(k):
        if isinstance(v,dict):
            print(k, 'date=',v.get('date'), 'fmt=',v.get('fmt'), 'title=',v.get('title'), 'parts=',len(v.get('participants') or []), 'name=',v.get('name'))
        else:
            print(k,type(v).__name__)
