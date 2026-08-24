from __future__ import annotations

import base64
from pathlib import Path


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
SRC = ROOT / "tmp-card-preview" / "gem-frame-set-v1" / "frames"
FILES = [ROOT / "table-tennis-elo.html", ROOT / "index.html"]
START = "const CARD_FRAME_TIERS = {"
END = "const cardFrameSrc = t => 'data:image/webp;base64,'+(CARD_FRAME_TIERS[(t&&t.k)||'']||CARD_FRAME_TIERS.bronze);\n"
KEYS = ["bronze", "silver", "gold", "plat", "dia"]


def frame_js() -> str:
    encoded = {}
    for key in KEYS:
        path = SRC / f"{key}.webp"
        encoded[key] = base64.b64encode(path.read_bytes()).decode("ascii")
        print(f"{key}: {path} {path.stat().st_size}")
    return (
        "const CARD_FRAME_TIERS = {\n"
        + ",\n".join(f"  {key}:'{encoded[key]}'" for key in KEYS)
        + "\n};\n"
        + "const cardFrameSrc = t => 'data:image/webp;base64,'+(CARD_FRAME_TIERS[(t&&t.k)||'']||CARD_FRAME_TIERS.bronze);\n"
    )


def replace(path: Path, js: str) -> None:
    text = path.read_text(encoding="utf-8")
    a = text.index(START)
    b = text.index(END, a) + len(END)
    path.write_text(text[:a] + js + text[b:], encoding="utf-8", newline="\n")
    print(f"updated: {path}")


def main() -> None:
    js = frame_js()
    for path in FILES:
        replace(path, js)


if __name__ == "__main__":
    main()
