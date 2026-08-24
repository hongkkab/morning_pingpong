from pathlib import Path
from PIL import Image
from io import BytesIO
import base64
import json
import time
import urllib.parse
import urllib.request

API_KEY = "AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U"
DB = "https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app"
BASE = f"{DB}/clubs/morning"
CHAR_DIR = Path(r"C:\Users\hek72\Downloads\모닝\tmp-card-preview\chars")

items = [
    ("p_msdxylg84qsjp", "01-이균호.png"),
    ("p_msdz95a1u7za2", "02-윤경배.png"),
    ("p_msjq6v7y5ixgz", "03-서호철.png"),
    ("p_msdzslncxpa8u", "04-안치훈.png"),
    ("p_msdz9xa1t8adp", "05-김재훈.png"),
    ("p_msjul0lsi8371", "06-정기진.png"),
    ("p_msdzt8fpk7h67", "07-동종성.png"),
    ("p_msjq6w145w8fo", "08-안혜경.png"),
    ("p_msl6xvgsgxdod", "09-곽명훈.png"),
    ("p_msjq6vn1bbt89", "10-조대우.png"),
]

def request(method, url, data=None):
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))

def auth_token():
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
    res = request("POST", url, {"returnSecureToken": True})
    return res["idToken"]

def db_url(path, token):
    return f"{BASE}/{path}.json?{urllib.parse.urlencode({'auth': token})}"

def to_webp_data(path):
    im = Image.open(path).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        l, t, r, b = bbox
        pad = 12
        im = im.crop((max(0, l-pad), max(0, t-pad), min(im.width, r+pad), min(im.height, b+pad)))
    if im.height > 900:
        w = round(im.width * 900 / im.height)
        im = im.resize((w, 900), Image.Resampling.LANCZOS)
    buf = BytesIO()
    im.save(buf, format="WEBP", quality=80, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

token = auth_token()
players = request("GET", db_url("players", token))
photos_before = request("GET", db_url("photos/playerCardChars", token))
backup = {
    "t": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    "players": players,
    "playerCardChars": photos_before,
}
backup_path = Path("backup-2026-08-18-before-top10-card-chars.json")
backup_path.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")

if not isinstance(players, list):
    raise SystemExit("players is not a list")

by_id = {p.get("id"): p for p in players if isinstance(p, dict)}
missing = [pid for pid, _ in items if pid not in by_id]
if missing:
    raise SystemExit("missing players: " + ", ".join(missing))

photo_patch = {}
for pid, fn in items:
    photo_patch[pid] = to_webp_data(CHAR_DIR / fn)

for pid, _ in items:
    p = by_id[pid]
    p["cardCharRef"] = f"tt:photo:playerCardChars/{pid}"
    p.pop("cardCharImg", None)

request("PATCH", db_url("photos/playerCardChars", token), photo_patch)
request("PUT", db_url("players", token), players)
request("PUT", db_url("sig", token), {"t": int(time.time() * 1000), "by": "codex-cardchars"})
print(json.dumps({"uploaded": len(items), "backup": str(backup_path)}, ensure_ascii=False))
