import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

API_KEY = "AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U"
DB = "https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app"
BASE = f"{DB}/clubs/morning"

PLAYER_IDS = [
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
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as res:
        raw = res.read()
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def auth_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
    res = request("POST", url, {"returnSecureToken": True})
    return res["idToken"]


def db_url(path, token):
    return f"{BASE}/{path}.json?{urllib.parse.urlencode({'auth': token})}"


token = auth_token()
players = request("GET", db_url("players", token))
chars_before = request("GET", db_url("photos/playerCardChars", token))

backup = {
    "t": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    "players": players,
    "playerCardChars": chars_before,
}
backup_path = Path("backup-2026-08-18-before-card-char-rollback.json")
backup_path.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")

if not isinstance(players, list):
    raise SystemExit("players is not a list")

removed = []
target = set(PLAYER_IDS)
for p in players:
    if not isinstance(p, dict) or p.get("id") not in target:
        continue
    if p.pop("cardCharRef", None) is not None:
        removed.append(p.get("id"))
    p.pop("cardCharImg", None)

photo_patch = {pid: None for pid in PLAYER_IDS}

request("PUT", db_url("players", token), players)
request("PATCH", db_url("photos/playerCardChars", token), photo_patch)
request("PUT", db_url("sig", token), {"t": int(time.time() * 1000), "by": "codex-cardchar-rollback"})

print(json.dumps({"removedRefs": len(removed), "removedPhotos": len(photo_patch), "backup": str(backup_path)}, ensure_ascii=False))
