from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

API_KEY = "AIzaSyD3blDOHWg88jj8JRmVIJV5L4w8Ln2ik7U"
DB = "https://morning-pingpong-default-rtdb.asia-southeast1.firebasedatabase.app"
BASE = f"{DB}/clubs/morning"
ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
XLSX = Path(r"C:\Users\hek72\OneDrive\문서\탁동이미지.xlsx")
OUT = ROOT / "tmp-card-preview" / "all"
REF_DIR = OUT / "refs"
OUT.mkdir(parents=True, exist_ok=True)
REF_DIR.mkdir(parents=True, exist_ok=True)
NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


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
    req = urllib.request.Request(url, data=json.dumps({"returnSecureToken": True}).encode("utf-8"), method="POST")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=90) as res:
        return json.loads(res.read().decode("utf-8"))["idToken"]


def as_list(v: Any) -> list[Any]:
    if isinstance(v, list):
        return v
    if isinstance(v, dict):
        return list(v.values())
    return []


def norm_name(s: str) -> str:
    s = re.sub(r"\([^)]*\)", "", str(s or ""))
    s = s.split("/")[0]
    return re.sub(r"[^가-힣A-Za-z0-9]", "", s).upper()


def read_xlsx_rows() -> list[list[str]]:
    with zipfile.ZipFile(XLSX) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("a:si", NS):
                shared.append("".join(t.text or "" for t in si.findall(".//a:t", NS)))
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//a:sheetData/a:row", NS):
            cells: dict[int, str] = {}
            for c in row.findall("a:c", NS):
                ref = c.attrib.get("r", "")
                m = re.match(r"([A-Z]+)", ref)
                col = 1
                if m:
                    col = 0
                    for ch in m.group(1):
                        col = col * 26 + ord(ch) - 64
                v = c.find("a:v", NS)
                val = "" if v is None else v.text or ""
                if c.attrib.get("t") == "s" and val:
                    val = shared[int(val)]
                cells[col] = val
            if cells:
                vals = [cells.get(i, "") for i in range(1, max(cells) + 1)]
                if vals and vals[0] != "name":
                    rows.append(vals)
        return rows


def find_url(rows: list[list[str]], name: str) -> tuple[str | None, str | None]:
    key = norm_name(name)
    candidates = []
    for row in rows:
        if not row:
            continue
        row_name = row[0]
        row_key = norm_name(row_name)
        if row_key == key or row_key.startswith(key) or key.startswith(row_key):
            if len(row) > 1 and str(row[1]).startswith("http"):
                candidates.append(row)
    if not candidates:
        return None, None
    candidates.sort(key=lambda r: (norm_name(r[0]) != key, len(str(r[0]))))
    return candidates[0][1], candidates[0][0]


def download(url: str, path: Path) -> tuple[Path, int, str]:
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "Mozilla/5.0")
    req.add_header("Referer", "https://band.us/")
    with urllib.request.urlopen(req, timeout=60) as res:
        data = res.read()
        ctype = (res.headers.get("Content-Type", "") or "").lower()
    suffix = ".png" if "png" in ctype or url.lower().endswith(".png") else ".jpg"
    out = path.with_suffix(suffix)
    out.write_bytes(data)
    return out, len(data), ctype


def main() -> None:
    token = auth_token()
    players = [p for p in as_list(request("GET", "players", token)) if isinstance(p, dict) and p.get("id")]
    matches = [m for m in as_list(request("GET", "matches", token)) if isinstance(m, dict) and not m.get("void")]
    photos = request("GET", "photos/playerCardChars", token) or {}
    active = [p for p in players if p.get("active") is not False]
    games = Counter()
    wins = Counter()
    for m in matches:
        a, b = m.get("aId"), m.get("bId")
        if a:
            games[a] += 1
        if b:
            games[b] += 1
        winner = m.get("winnerId")
        if winner:
            wins[winner] += 1
    xrows = read_xlsx_rows()
    top50_refs = ROOT / "tmp-card-preview" / "top50" / "refs"
    summary = []
    for p in active:
        pid = p["id"]
        rank_sort = (-games[pid], -wins[pid], str(p.get("name") or ""))
        url, matched = find_url(xrows, p.get("name") or "")
        local = None
        for old in top50_refs.glob(f"*-{pid}.*"):
            local = old
            break
        if local is None:
            for old in REF_DIR.glob(f"*-{pid}.*"):
                local = old
                break
        entry = {
            "id": pid,
            "name": p.get("name") or "",
            "bu": p.get("bu"),
            "hand": p.get("hand") or p.get("handed") or "",
            "grip": p.get("grip") or p.get("racket") or "",
            "games": games[pid],
            "wins": wins[pid],
            "hasCard": bool(p.get("cardCharRef") or p.get("cardCharImg") or photos.get(pid)),
            "cardCharRef": p.get("cardCharRef") or "",
            "photoBytes": len(str(photos.get(pid, ""))),
            "matched": matched,
            "url": url,
            "path": str(local) if local else "",
            "_sort": rank_sort,
        }
        summary.append(entry)
    summary.sort(key=lambda x: x["_sort"])
    for i, item in enumerate(summary, 1):
        item["order"] = i
        item.pop("_sort", None)
        if item["path"] or not item["url"]:
            continue
        try:
            path, size, ctype = download(item["url"], REF_DIR / f"{i:03d}-{item['id']}")
            item.update({"path": str(path), "bytes": size, "contentType": ctype})
            time.sleep(0.05)
        except urllib.error.HTTPError as e:
            item["error"] = f"HTTP {e.code}"
        except Exception as e:
            item["error"] = str(e)
    path = OUT / "card-inventory.json"
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "path": str(path),
        "activePlayers": len(summary),
        "withSource": sum(1 for x in summary if x.get("path")),
        "withExistingCard": sum(1 for x in summary if x.get("hasCard")),
        "missingSource": [
            {"order": x["order"], "name": x["name"], "id": x["id"], "games": x["games"], "matched": x.get("matched"), "error": x.get("error", "")}
            for x in summary if not x.get("path")
        ],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
