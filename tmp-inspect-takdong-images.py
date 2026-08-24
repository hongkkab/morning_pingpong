import json
import zipfile
from pathlib import Path

xlsx = Path(r"C:\Users\hek72\OneDrive\문서\탁동이미지.xlsx")

with zipfile.ZipFile(xlsx) as z:
    names = z.namelist()
    media = [n for n in names if n.startswith("xl/media/")]
    sheets = [n for n in names if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")]
    drawings = [n for n in names if n.startswith("xl/drawings/") and n.endswith(".xml")]
    shared = "xl/sharedStrings.xml" in names
    print(json.dumps({
        "media": media,
        "sheets": sheets,
        "drawings": drawings,
        "hasSharedStrings": shared,
    }, ensure_ascii=False, indent=2))
