from __future__ import annotations

import base64
from pathlib import Path

from PIL import Image


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
SRC = ROOT / "tmp-card-preview" / "card-frames-v2"
OUT = ROOT / "tmp-card-preview" / "card-frames"
FILES = [ROOT / "table-tennis-elo.html", ROOT / "index.html"]

SOURCES = {
    "bronze": SRC / "bronze-arena-power-v6.png",
    "silver": SRC / "silver-arena-power-v6.png",
    "gold": SRC / "gold-arena-power-v6.png",
    "plat": SRC / "platinum-arena-emerald-v7.png",
    "dia": SRC / "diamond-arena-power-v6.png",
}

START = "const CARD_FRAME_TIERS = {"
END = "const cardFrameSrc = t => 'data:image/webp;base64,'+(CARD_FRAME_TIERS[(t&&t.k)||'']||CARD_FRAME_TIERS.bronze);\n"


def build_frame_js() -> str:
    OUT.mkdir(parents=True, exist_ok=True)
    encoded: dict[str, str] = {}
    for key, src in SOURCES.items():
        im = Image.open(src).convert("RGB").resize((516, 774), Image.Resampling.LANCZOS)
        out = OUT / f"{key}.webp"
        im.save(out, "WEBP", quality=84, method=6)
        encoded[key] = base64.b64encode(out.read_bytes()).decode("ascii")
        print(f"{key}: {out} {out.stat().st_size}")
    js = (
        "const CARD_FRAME_TIERS = {\n"
        + ",\n".join(f"  {key}:'{val}'" for key, val in encoded.items())
        + "\n};\n"
        + "const cardFrameSrc = t => 'data:image/webp;base64,'+(CARD_FRAME_TIERS[(t&&t.k)||'']||CARD_FRAME_TIERS.bronze);\n"
    )
    (OUT / "card-frame-tiers.js").write_text(js, encoding="utf-8")
    return js


def replace_frame_js(path: Path, frame_js: str) -> None:
    text = path.read_text(encoding="utf-8")
    a = text.index(START)
    b = text.index(END, a) + len(END)
    path.write_text(text[:a] + frame_js + text[b:], encoding="utf-8", newline="\n")
    print(f"updated: {path}")


def main() -> None:
    frame_js = build_frame_js()
    for path in FILES:
        replace_frame_js(path, frame_js)


if __name__ == "__main__":
    main()
