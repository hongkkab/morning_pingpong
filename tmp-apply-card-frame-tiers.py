from __future__ import annotations

from pathlib import Path

ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
FRAME_JS = ROOT / "tmp-card-preview" / "card-frames" / "card-frame-tiers.js"
FILES = [ROOT / "table-tennis-elo.html", ROOT / "index.html"]

START = "const CARD_FRAME_TIERS = {"
END = "const cardFrameSrc = t => 'data:image/webp;base64,'+(CARD_FRAME_TIERS[(t&&t.k)||'']||CARD_FRAME_TIERS.bronze);\n"
INSERT_AFTER = "const tierForBu = bu => CARD_TIERS.find(t=>bu>=t.bu[0]&&bu<=t.bu[1]) || CARD_TIERS[CARD_TIERS.length-1];\n"

frame_js = FRAME_JS.read_text(encoding="utf-8")

for path in FILES:
    text = path.read_text(encoding="utf-8")
    if START in text:
        a = text.index(START)
        b = text.index(END, a) + len(END)
        text = text[:a] + frame_js + text[b:]
    else:
        text = text.replace(INSERT_AFTER, INSERT_AFTER + frame_js, 1)
    old = "const frontStyle = hasChar ? '' : ` style=\"background-image:url('${cardBgFor(p)}')\"`;"
    new = "const frontStyle = ` style=\"background-image:url('${hasChar?cardFrameSrc(tier):cardBgFor(p)}')\"`;"
    if old in text:
        text = text.replace(old, new, 1)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(path)
