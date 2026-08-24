from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
SRC = ROOT / "tmp-card-preview" / "gem-frame-set-v1" / "tier-set-sheet-v1.png"
OUT = ROOT / "tmp-card-preview" / "gem-frame-set-v1" / "frames"
PREVIEW = ROOT / "tmp-card-preview" / "gem-frame-set-v1" / "tier-set-cropped-preview.png"
NAMES = ["bronze", "silver", "gold", "plat", "dia"]


def spans(mask: np.ndarray, min_len: int) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    inside = False
    start = 0
    for i, value in enumerate(mask):
        if value and not inside:
            start = i
            inside = True
        if inside and ((not value) or i == len(mask) - 1):
            end = i if not value else i + 1
            if end - start >= min_len:
                out.append((start, end))
            inside = False
    return out


def crop_cards(im: Image.Image) -> list[Image.Image]:
    arr = np.array(im.convert("RGB"))
    # Labels are below the cards, so ignore the lower strip for detection.
    upper = arr[: int(arr.shape[0] * 0.86)]
    bright = (upper.max(axis=2) > 70) & (
        (upper.max(axis=2) - upper.min(axis=2) > 15) | (upper.mean(axis=2) > 92)
    )
    x_spans = spans(bright.sum(axis=0) > 20, 70)
    # The frame border has enough separation between cards. Keep the 5 widest card spans.
    x_spans = sorted(x_spans, key=lambda s: s[1] - s[0], reverse=True)[:5]
    x_spans = sorted(x_spans)
    if len(x_spans) != 5:
        raise RuntimeError(f"expected 5 x spans, got {x_spans}")

    cards: list[Image.Image] = []
    for x0, x1 in x_spans:
        region = bright[:, max(0, x0 - 6) : min(bright.shape[1], x1 + 6)]
        y_spans = spans(region.sum(axis=1) > 12, 70)
        y0, y1 = max(y_spans, key=lambda s: s[1] - s[0])
        # Pad only a little; then fit to exact 2:3 card ratio around the detected frame.
        x0 = max(0, x0 - 6)
        x1 = min(im.width, x1 + 6)
        y0 = max(0, y0 - 6)
        y1 = min(im.height, y1 + 6)
        w = x1 - x0
        h = y1 - y0
        target_ratio = 2 / 3
        if w / h > target_ratio:
            nw = int(h * target_ratio)
            d = (w - nw) // 2
            x0 += d
            x1 = x0 + nw
        else:
            nh = int(w / target_ratio)
            d = (h - nh) // 2
            y0 += d
            y1 = y0 + nh
        cards.append(im.crop((x0, y0, x1, y1)).resize((516, 774), Image.Resampling.LANCZOS))
    return cards


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    im = Image.open(SRC).convert("RGB")
    cards = crop_cards(im)
    thumbs = []
    for name, card in zip(NAMES, cards):
        png = OUT / f"{name}.png"
        webp = OUT / f"{name}.webp"
        card.save(png)
        card.save(webp, "WEBP", quality=88, method=6)
        thumbs.append(card.resize((206, 309), Image.Resampling.LANCZOS))
        print(name, png, webp)
    gap = 18
    sheet = Image.new("RGB", (len(thumbs) * 206 + gap * (len(thumbs) - 1), 309), (6, 10, 15))
    for i, thumb in enumerate(thumbs):
        sheet.paste(thumb, (i * (206 + gap), 0))
    sheet.save(PREVIEW, quality=94)
    print(PREVIEW)


if __name__ == "__main__":
    main()
