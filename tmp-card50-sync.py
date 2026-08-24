from __future__ import annotations

import base64
import json
import math
import re
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from PIL import Image

API_KEY = "AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U"
DB = "https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app"
BASE = f"{DB}/clubs/morning"
ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
OUT = ROOT / "tmp-card-preview" / "top50"
REF_DIR = OUT / "refs"
CHAR_DIR = OUT / "chars"
KST = ZoneInfo("Asia/Seoul")

DEFAULTS = {
    "baseRating": 1200,
    "formBase": 1500,
    "bestOf": 5,
    "handiElo": 129,
    "residualBu": 0,
    "autoCalib": True,
    "calibEvery": 50,
    "ptsPerBu": 2,
    "maxHandi": 0,
    "defLeague": "morning",
    "kNew": 40,
    "kMid": 28,
    "kBase": 20,
    "newGames": 10,
    "midGames": 30,
    "repeatN0": 5,
    "poolCeilingBu": 0,
    "kHalfLife": 30,
    "formDays": 30,
    "moveDays": 1,
    "handiOn": True,
    "confirmedOnly": True,
    "provisional": 5,
    "shrinkC": 6,
    "legacyBefore": "2026-08-05T00:00:00.000Z",
    "leagues": [{"id": "morning", "name": "모닝탁구"}, {"id": "quickmeet", "name": "빨리모이", "cup": True, "fmt": "leagueko"}],
}
BU_MIN = 3
BU_MAX = 10


def request(method: str, path: str, token: str | None = None, data: Any = None) -> Any:
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


def as_list(v: Any) -> list[Any]:
    if isinstance(v, list):
        return v
    if isinstance(v, dict):
        return list(v.values())
    return []


def clean_key(s: str) -> str:
    return re.sub(r"[.#$\[\]/]", "-", s)


def now_stamp() -> str:
    return datetime.now(KST).strftime("%Y%m%d-%H%M%S")


def today() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def days_between(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    try:
        da = datetime.fromisoformat(a[:10])
        db = datetime.fromisoformat(b[:10])
        return max(0.0, (db - da).total_seconds() / 86400)
    except Exception:
        return 0.0


def load_all(token: str) -> dict[str, Any]:
    meta = request("GET", "meta", token) or {}
    players = as_list(request("GET", "players", token))
    matches = as_list(request("GET", "matches", token))
    photos = request("GET", "photos/playerCardChars", token) or {}
    return {"meta": meta, "players": players, "matches": matches, "playerCardChars": photos}


def save_backup(data: dict[str, Any], label: str) -> Path:
    p = ROOT / f"backup-2026-08-18-{now_stamp()}-{label}.json"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return p


def normalize_settings(meta: dict[str, Any]) -> dict[str, Any]:
    settings = dict(DEFAULTS)
    settings.update((meta or {}).get("settings") or {})
    return settings


def lg_of(m: dict[str, Any], settings: dict[str, Any]) -> str:
    return m.get("lg") or m.get("league") or settings.get("defLeague") or "morning"


def winner_of(m: dict[str, Any]) -> str | None:
    if m.get("winnerId"):
        return m.get("winnerId")
    try:
        return m.get("aId") if float(m.get("aSets") or 0) > float(m.get("bSets") or 0) else m.get("bId")
    except Exception:
        return m.get("bId")


def is_confirmed(m: dict[str, Any], settings: dict[str, Any]) -> bool:
    if not settings.get("confirmedOnly", True):
        return True
    if len(m.get("confirmedBy") or []) >= 2:
        return True
    return str(m.get("enteredAt") or "") < str(settings.get("legacyBefore") or "")


@dataclass
class EngineResult:
    ratings: dict[str, float]
    games: dict[str, int]
    wins: dict[str, int]
    losses: dict[str, int]
    last: dict[str, str | None]


class EloComputer:
    def __init__(self, players: list[dict[str, Any]], matches: list[dict[str, Any]], settings: dict[str, Any]):
        self.players = [p for p in players if isinstance(p, dict) and p.get("id") and p.get("active") is not False]
        self.by_id = {p["id"]: p for p in self.players}
        self.matches = sorted(
            [
                m
                for m in matches
                if isinstance(m, dict)
                and not m.get("void")
                and m.get("aId") in self.by_id
                and m.get("bId") in self.by_id
                and is_confirmed(m, settings)
            ],
            key=lambda m: str(m.get("date") or "") + "|" + str(m.get("enteredAt") or ""),
        )
        self.settings = settings
        self._calib: float | None = None

    def per_bu(self) -> float:
        residual = self._calib if (self.settings.get("autoCalib") and self._calib is not None) else (self.settings.get("residualBu") or 0)
        return (self.settings.get("ptsPerBu") or 0) * (self.settings.get("handiElo") or 0) + residual

    def base_for(self, bu: Any) -> float:
        try:
            b = int(bu)
        except Exception:
            b = BU_MAX
        b = min(BU_MAX, max(BU_MIN, b))
        return (self.settings.get("baseRating") or 1200) + (BU_MAX - b) * self.per_bu()

    def k_for(self, n: float) -> float:
        if n < (self.settings.get("newGames") or 10):
            return self.settings.get("kNew") or 40
        if n < (self.settings.get("midGames") or 30):
            return self.settings.get("kMid") or 28
        return self.settings.get("kBase") or 20

    def decay_exp(self, n: float, days: float) -> float:
        half = self.settings.get("kHalfLife") or 30
        return n * math.pow(0.5, days / half)

    def handi_elo_in(self, lg: str) -> float:
        for item in self.settings.get("leagues") or []:
            if isinstance(item, dict) and item.get("id") == lg:
                rules = item.get("rules") or {}
                if rules.get("handiElo") not in (None, ""):
                    return float(rules.get("handiElo"))
        return float(self.settings.get("handiElo") or 0)

    def run(self, mode: str = "skill") -> EngineResult:
        skill = mode == "skill"
        ratings: dict[str, float] = {}
        games = {}
        wins = {}
        losses = {}
        last = {}
        for p in self.players:
            ratings[p["id"]] = self.base_for(p.get("bu")) if skill else float(self.settings.get("formBase") or 1500)
            games[p["id"]] = 0
            wins[p["id"]] = 0
            losses[p["id"]] = 0
            last[p["id"]] = None
        exp_games = dict(games)
        pair: dict[str, dict[str, Any]] = {}
        for m in self.matches:
            a, b = m.get("aId"), m.get("bId")
            if a not in ratings or b not in ratings:
                continue
            na = self.decay_exp(exp_games[a], days_between(last[a], m.get("date"))) if last[a] else 0
            nb = self.decay_exp(exp_games[b], days_between(last[b], m.get("date"))) if last[b] else 0
            pk = "|".join(sorted([a, b]))
            met = 0.0
            if pk in pair:
                met = float(pair[pk]["n"]) * math.pow(0.5, days_between(pair[pk]["d"], m.get("date")) / (self.settings.get("kHalfLife") or 30))
            rep = 1 / (1 + met / (self.settings.get("repeatN0") or 5)) if (self.settings.get("repeatN0") or 0) > 0 else 1
            pair[pk] = {"n": met + 1, "d": m.get("date")}
            ra, rb = ratings[a], ratings[b]
            ea, eb = ra, rb
            if skill and self.settings.get("handiOn", True) and isinstance(m.get("handi"), dict) and (m["handi"].get("pts") or 0) > 0:
                h = float(m["handi"].get("pts") or 0) * self.handi_elo_in(lg_of(m, self.settings))
                if m["handi"].get("toId") == a:
                    ea += h
                if m["handi"].get("toId") == b:
                    eb += h
            exp_a = 1 / (1 + math.pow(10, (eb - ea) / 400))
            sa = 1 if winner_of(m) == a else 0
            mov = 1.0
            if self.settings.get("movOn") and m.get("aSets") is not None and m.get("bSets") is not None:
                try:
                    aa, bb = float(m.get("aSets")), float(m.get("bSets"))
                    mg, tot = abs(aa - bb), max(aa, bb)
                    if tot >= 2 and mg >= 1:
                        mov = 1.2 if mg >= tot else (0.8 if mg == 1 else 1)
                except Exception:
                    pass
            d_a = self.k_for(na) * rep * mov * (sa - exp_a)
            d_b = self.k_for(nb) * rep * mov * ((1 - sa) - (1 - exp_a))
            ratings[a] = ra + d_a
            ratings[b] = rb + d_b
            games[a] += 1
            games[b] += 1
            if sa:
                wins[a] += 1
                losses[b] += 1
            else:
                wins[b] += 1
                losses[a] += 1
            exp_games[a] = na + 1
            exp_games[b] = nb + 1
            last[a] = m.get("date")
            last[b] = m.get("date")
        return EngineResult(ratings=ratings, games=games, wins=wins, losses=losses, last=last)

    def ranked(self, mode: str = "skill") -> list[dict[str, Any]]:
        res = self.run(mode)
        shrink_c = self.settings.get("shrinkC") or 0
        rows = []
        for p in self.players:
            pid = p["id"]
            raw = res.ratings[pid]
            if shrink_c:
                base = self.base_for(p.get("bu")) if mode == "skill" else float(self.settings.get("formBase") or 1500)
                g = res.games[pid]
                rating = base + (raw - base) * g / (g + shrink_c)
            else:
                rating = raw
            rows.append(
                {
                    "rank": None,
                    "id": pid,
                    "name": p.get("name"),
                    "bu": p.get("bu"),
                    "grip": p.get("grip") or "shake",
                    "hand": p.get("hand") or "R",
                    "sex": p.get("sex") or "",
                    "rating": rating,
                    "games": res.games[pid],
                    "wins": res.wins[pid],
                    "losses": res.losses[pid],
                    "last": res.last[pid],
                    "cardCharRef": p.get("cardCharRef") or "",
                }
            )
        rows.sort(key=lambda r: (-r["rating"], -r["games"], str(r["name"] or "")))
        for i, r in enumerate(rows, 1):
            r["rank"] = i
        return rows


def to_webp_data(path: Path) -> str:
    im = Image.open(path).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        l, t, r, b = bbox
        pad = 12
        im = im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))
    if im.height > 900:
        w = round(im.width * 900 / im.height)
        im = im.resize((w, 900), Image.Resampling.LANCZOS)
    buf = BytesIO()
    im.save(buf, format="WEBP", quality=80, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def upload_chars(token: str, items: list[dict[str, Any]]) -> dict[str, Any]:
    data = load_all(token)
    backup = save_backup(data, "before-card50-upload")
    players = data["players"]
    by_id = {p.get("id"): p for p in players if isinstance(p, dict)}
    patch = {}
    uploaded = []
    missing = []
    for item in items:
        pid = item["id"]
        path = Path(item["path"])
        if not path.exists() or pid not in by_id:
            missing.append(item)
            continue
        patch[pid] = to_webp_data(path)
        p = by_id[pid]
        p["cardCharRef"] = f"tt:photo:playerCardChars/{pid}"
        p.pop("cardCharImg", None)
        uploaded.append({"rank": item.get("rank"), "id": pid, "name": p.get("name"), "path": str(path)})
    if patch:
        request("PATCH", "photos/playerCardChars", token, patch)
        request("PUT", "players", token, players)
        request("PUT", "sig", token, {"t": int(time.time() * 1000), "by": "codex-card50"})
    return {"uploaded": uploaded, "missing": missing, "backup": str(backup)}


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("cmd", choices=["rank", "games", "upload", "verify"])
    parser.add_argument("--items", type=Path)
    args = parser.parse_args()

    token = auth_token()
    data = load_all(token)
    settings = normalize_settings(data.get("meta") or {})
    if args.cmd == "rank":
        save_backup(data, "card50-source")
        rows = EloComputer(data["players"], data["matches"], settings).ranked("skill")
        OUT.mkdir(parents=True, exist_ok=True)
        path = OUT / "top50-ranking.json"
        path.write_text(json.dumps(rows[:50], ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"count": len(rows), "matches": len(data["matches"]), "top50": rows[:50]}, ensure_ascii=False, indent=2))
    elif args.cmd == "games":
        save_backup(data, "card50-source")
        rows = EloComputer(data["players"], data["matches"], settings).ranked("skill")
        rows.sort(key=lambda r: (-r["games"], -r["rating"], str(r["name"] or "")))
        for i, r in enumerate(rows, 1):
            r["rank"] = i
        OUT.mkdir(parents=True, exist_ok=True)
        path = OUT / "top50-by-games.json"
        path.write_text(json.dumps(rows[:50], ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"count": len(rows), "matches": len(data["matches"]), "top50": rows[:50]}, ensure_ascii=False, indent=2))
    elif args.cmd == "upload":
        if not args.items:
            raise SystemExit("--items required")
        items = json.loads(args.items.read_text(encoding="utf-8"))
        print(json.dumps(upload_chars(token, items), ensure_ascii=False, indent=2))
    elif args.cmd == "verify":
        rows = EloComputer(data["players"], data["matches"], settings).ranked("skill")
        top = rows[:50]
        photos = data.get("playerCardChars") or {}
        out = []
        by_id = {p.get("id"): p for p in data["players"] if isinstance(p, dict)}
        for r in top:
            p = by_id.get(r["id"]) or {}
            ref = p.get("cardCharRef") or ""
            out.append({"rank": r["rank"], "id": r["id"], "name": r["name"], "ref": ref, "photoBytes": len(str(photos.get(r["id"], "")))})
        print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
