import json
import re
import urllib.error
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
RANKING = ROOT / "tmp-card-preview" / "top50" / "top50-by-games.json"
XLSX = Path(r"C:\Users\hek72\OneDrive\문서\탁동이미지.xlsx")
OUT = ROOT / "tmp-card-preview" / "top50" / "refs"
OUT.mkdir(parents=True, exist_ok=True)
NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def read_rows():
    with zipfile.ZipFile(XLSX) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("a:si", NS):
                shared.append("".join(t.text or "" for t in si.findall(".//a:t", NS)))
        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall(".//a:sheetData/a:row", NS):
            vals = []
            cells = {}
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


def norm_name(s):
    s = re.sub(r"\([^)]*\)", "", str(s or ""))
    s = s.split("/")[0]
    return re.sub(r"[^가-힣A-Za-z0-9]", "", s).upper()


def find_url(rows, name):
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
    if candidates:
        candidates.sort(key=lambda r: (norm_name(r[0]) != key, len(str(r[0]))))
        return candidates[0][1], candidates[0][0]
    return None, None


def download(url, path):
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "Mozilla/5.0")
    req.add_header("Referer", "https://band.us/")
    with urllib.request.urlopen(req, timeout=60) as res:
        data = res.read()
        ctype = (res.headers.get("Content-Type", "") or "").lower()
    if "png" in ctype or url.lower().endswith(".png"):
        path = path.with_suffix(".png")
    else:
        path = path.with_suffix(".jpg")
    path.write_bytes(data)
    return path, len(data), ctype


rows = read_rows()
ranking = json.loads(RANKING.read_text(encoding="utf-8"))
summary = []
for item in ranking:
    rank = int(item["rank"])
    name = item["name"]
    url, matched = find_url(rows, name)
    entry = {"rank": rank, "id": item["id"], "name": name, "matched": matched, "url": url}
    if url:
        safe = f"{rank:02d}-{item['id']}"
        try:
            path, size, ctype = download(url, OUT / safe)
            entry.update({"path": str(path), "bytes": size, "contentType": ctype})
        except urllib.error.HTTPError as e:
            entry.update({"error": f"HTTP {e.code}"})
        except Exception as e:
            entry.update({"error": str(e)})
    summary.append(entry)

path = OUT.parent / "top50-ref-summary.json"
path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"summary": str(path), "found": sum(1 for x in summary if x.get("path")), "missing": [x for x in summary if not x.get("path")]}, ensure_ascii=False, indent=2))
