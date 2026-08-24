import json, urllib.request, urllib.error
API_KEY='AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U'
url=f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}'
body=json.dumps({'email':'codex-provider-check@morning-pingpong.local','password':'ttlog-0000','returnSecureToken':True}).encode()
try:
    urllib.request.urlopen(urllib.request.Request(url,data=body,headers={'Content-Type':'application/json'}),timeout=20)
    print('unexpected success')
except urllib.error.HTTPError as e:
    raw=e.read().decode('utf-8','replace')
    print(raw)
