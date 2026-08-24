from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

API_KEY = "AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U"
DB = "https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app"
BASE = f"{DB}/clubs/morning"
ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
KST = ZoneInfo("Asia/Seoul")


def request(method: str, path: str, token: str | None = None, data=None):
    url = f"{BASE}/{path}.json"
    if token:
        url += "?" + urllib.parse.urlencode({"auth": token})
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=90) as res:
        raw = res.read()
    return json.loads(raw.decode("utf-8")) if raw else None


def auth_token() -> str:
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
    body = json.dumps({"returnSecureToken": True}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=90) as res:
        return json.loads(res.read().decode("utf-8"))["idToken"]


def stamp() -> str:
    return datetime.now(KST).strftime("%Y%m%d-%H%M%S")


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("ids", nargs="*")
    parser.add_argument("--inventory", type=Path)
    parser.add_argument("--from-order", type=int)
    args = parser.parse_args()

    token = auth_token()
    players = request("GET", "players", token) or []
    photos = request("GET", "photos/playerCardChars", token) or {}
    backup = ROOT / f"backup-2026-08-18-{stamp()}-before-card-clear.json"
    backup.write_text(json.dumps({"players": players, "playerCardChars": photos}, ensure_ascii=False, indent=2), encoding="utf-8")

    ids = set(args.ids)
    if args.inventory and args.from_order is not None:
        inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
        ids.update(str(item.get("id")) for item in inventory if int(item.get("order") or 0) >= args.from_order)
    ids.discard("")
    if not ids:
        raise SystemExit("no ids")
    changed = []
    for player in players:
        if isinstance(player, dict) and player.get("id") in ids:
            player["cardCharRef"] = ""
            player.pop("cardCharImg", None)
            changed.append({"id": player.get("id"), "name": player.get("name")})

    photo_patch = {pid: None for pid in ids}
    request("PATCH", "photos/playerCardChars", token, photo_patch)
    request("PUT", "players", token, players)
    request("PUT", "sig", token, {"t": int(time.time() * 1000), "by": "codex-card-clear"})
    print(json.dumps({"cleared": changed, "backup": str(backup)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
