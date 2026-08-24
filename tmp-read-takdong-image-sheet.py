import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

xlsx = Path(r"C:\Users\hek72\OneDrive\문서\탁동이미지.xlsx")
ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

def col_row(cell_ref):
    m = re.match(r"([A-Z]+)(\d+)", cell_ref)
    if not m:
        return cell_ref, None
    col = 0
    for ch in m.group(1):
        col = col * 26 + ord(ch) - 64
    return col, int(m.group(2))

with zipfile.ZipFile(xlsx) as z:
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("a:si", ns):
            texts = [t.text or "" for t in si.findall(".//a:t", ns)]
            shared.append("".join(texts))

    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in root.findall(".//a:sheetData/a:row", ns):
        cells = {}
        for c in row.findall("a:c", ns):
            ref = c.attrib.get("r", "")
            v = c.find("a:v", ns)
            val = "" if v is None else v.text or ""
            if c.attrib.get("t") == "s" and val:
                val = shared[int(val)]
            col, _ = col_row(ref)
            cells[col] = val
        if cells:
            rows.append([cells.get(i, "") for i in range(1, max(cells) + 1)])

print(json.dumps(rows[:80], ensure_ascii=False, indent=2))
