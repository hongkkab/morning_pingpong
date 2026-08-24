from __future__ import annotations

import base64
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
INV = ROOT / "tmp-card-preview" / "all" / "card-inventory.json"
CHAR_DIR = ROOT / "tmp-card-preview" / "all" / "chars"
FRAME_JS = ROOT / "tmp-card-preview" / "card-frames" / "card-frame-tiers.js"
OUT_DIR = ROOT / "tmp-card-preview" / "all"


def tier_for_bu(bu: int | None) -> str:
    if bu is None:
        return "bronze"
    if bu <= 3:
        return "dia"
    if bu <= 6:
        return "plat"
    if bu == 7:
        return "gold"
    if bu == 8:
        return "silver"
    return "bronze"


def load_font(size: int, bold: bool = False):
    paths = [
        r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for p in paths:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def load_frames() -> dict[str, Image.Image]:
    raw = FRAME_JS.read_text(encoding="utf-8")
    frames: dict[str, Image.Image] = {}
    for key, b64 in re.findall(r"([a-z]+):'([^']+)'", raw):
        frames[key] = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")
    return frames


def fit_card_char(im: Image.Image, max_w: int, max_h: int) -> Image.Image:
    out = im.copy().convert("RGBA")
    out.thumbnail((max_w, max_h), Image.LANCZOS)
    return out


def make_preview(start: int, end: int) -> None:
    rows = json.loads(INV.read_text(encoding="utf-8"))
    rows = [r for r in rows if start <= int(r["order"]) <= end]
    frames = load_frames()
    name_font = load_font(21, True)
    meta_font = load_font(13, False)
    card_w, card_h = 280, 390
    cards = []
    for r in rows:
        order = int(r["order"])
        pid = r["id"]
        char_path = CHAR_DIR / f"{order:03d}-{pid}.png"
        frame = frames[tier_for_bu(r.get("bu"))].resize((card_w, card_h), Image.LANCZOS)
        card = Image.new("RGBA", (card_w, card_h), (6, 14, 24, 255))
        card.alpha_composite(frame)
        if char_path.exists():
            char = fit_card_char(Image.open(char_path), 225, 255)
            x = (card_w - char.width) // 2
            y = 74 + (230 - char.height) // 2
            card.alpha_composite(char, (x, y))
        dr = ImageDraw.Draw(card)
        dr.rounded_rectangle((38, 318, 244, 362), radius=7, fill=(5, 14, 29, 220))
        dr.text((48, 322), f"{order:03d} {r['name']}", font=name_font, fill=(250, 250, 255, 255))
        dr.text((48, 348), f"{r.get('bu') or '?'}부 · {r.get('hand') or '?'} · {r.get('grip') or 'shake'}", font=meta_font, fill=(158, 212, 238, 255))
        cards.append(card)

    cols = min(5, max(1, len(cards)))
    rows_n = (len(cards) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * 300, rows_n * 420), (9, 16, 25, 255))
    for i, card in enumerate(cards):
        sheet.alpha_composite(card, ((i % cols) * 300 + 10, (i // cols) * 420 + 10))
    out = OUT_DIR / f"batch-{start:03d}-{end:03d}-card-preview.png"
    sheet.convert("RGB").save(out, quality=92)

    cut_w, cut_h = 240, 330
    cut_sheet = Image.new("RGBA", (cols * cut_w, rows_n * cut_h), (32, 44, 56, 255))
    dr = ImageDraw.Draw(cut_sheet)
    for i, r in enumerate(rows):
        order = int(r["order"])
        pid = r["id"]
        char_path = CHAR_DIR / f"{order:03d}-{pid}.png"
        x0, y0 = (i % cols) * cut_w, (i // cols) * cut_h
        for yy in range(y0, y0 + cut_h, 24):
            for xx in range(x0, x0 + cut_w, 24):
                fill = (28, 38, 48, 255) if ((xx // 24 + yy // 24) % 2) else (45, 58, 70, 255)
                dr.rectangle((xx, yy, xx + 24, yy + 24), fill=fill)
        dr.text((x0 + 6, y0 + 6), f"{order:03d} {r['name']}", font=meta_font, fill=(235, 245, 255, 255))
        if char_path.exists():
            char = fit_card_char(Image.open(char_path), 210, 285)
            cut_sheet.alpha_composite(char, (x0 + (cut_w - char.width) // 2, y0 + 34 + (270 - char.height) // 2))
    cut_out = OUT_DIR / f"batch-{start:03d}-{end:03d}-cutouts-preview.png"
    cut_sheet.convert("RGB").save(cut_out, quality=92)
    print(out)
    print(cut_out)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: tmp-card-preview-batch.py START END")
    make_preview(int(sys.argv[1]), int(sys.argv[2]))
