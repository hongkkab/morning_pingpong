import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

xlsx = Path(r"C:\Users\hek72\OneDrive\문서\탁동이미지.xlsx")
targets = ["이균호", "윤경배", "서호철", "안치훈", "김재훈"]
ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

with zipfile.ZipFile(xlsx) as z:
    shared_root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    shared = [
        "".join(t.text or "" for t in si.findall(".//a:t", ns))
        for si in shared_root.findall("a:si", ns)
    ]
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in sheet.findall(".//a:sheetData/a:row", ns):
        vals = []
        for c in row.findall("a:c", ns):
            v = c.find("a:v", ns)
            val = "" if v is None else v.text or ""
            if c.attrib.get("t") == "s" and val:
                val = shared[int(val)]
            vals.append(val)
        if vals:
            rows.append(vals)

matches = {}
for target in targets:
    matches[target] = [r for r in rows if r and target in r[0]]

print(json.dumps(matches, ensure_ascii=False, indent=2))
