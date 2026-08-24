import json
import urllib.parse
import urllib.request

API_KEY = "AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U"
DB = "https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app"
BASE = f"{DB}/clubs/morning"

ids = [
    "p_msdxylg84qsjp",
    "p_msdz95a1u7za2",
    "p_msjq6v7y5ixgz",
    "p_msdzslncxpa8u",
    "p_msdz9xa1t8adp",
    "p_msjul0lsi8371",
    "p_msdzt8fpk7h67",
    "p_msjq6w145w8fo",
    "p_msl6xvgsgxdod",
    "p_msjq6vn1bbt89",
]

def request(method, url, data=None):
    body = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    return json.loads(raw.decode("utf-8")) if raw else None

token = request(
    "POST",
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}",
    {"returnSecureToken": True},
)["idToken"]

def db_url(path):
    return f"{BASE}/{path}.json?{urllib.parse.urlencode({'auth': token})}"

players = request("GET", db_url("players"))
photos = request("GET", db_url("photos/playerCardChars")) or {}
found = []
for pid in ids:
    p = next((x for x in players if isinstance(x, dict) and x.get("id") == pid), None)
    found.append({
        "id": pid,
        "name": p.get("name") if p else None,
        "ref": p.get("cardCharRef") if p else None,
        "photoBytes": len(photos.get(pid, "")),
    })
print(json.dumps(found, ensure_ascii=False, indent=2))
