import json, urllib.request, urllib.parse
API_KEY='AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U'
DB='https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app'
def req(url,data=None):
    body=None; headers={}
    if data is not None:
        body=json.dumps(data).encode(); headers['Content-Type']='application/json'
    r=urllib.request.Request(url,data=body,headers=headers)
    try:
        with urllib.request.urlopen(r,timeout=20) as resp:
            print(resp.status, resp.read()[:500])
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read()[:500])

auth=json.loads(urllib.request.urlopen(urllib.request.Request(f'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}', data=json.dumps({'returnSecureToken':True}).encode(), headers={'Content-Type':'application/json'}),timeout=20).read().decode())
tok=auth['idToken']
req(f'{DB}/.settings/rules.json?auth={urllib.parse.quote(tok)}')
