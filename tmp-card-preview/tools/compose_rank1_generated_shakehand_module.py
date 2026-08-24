from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
BASE = ROOT / "tmp-card-preview" / "all" / "chars" / "001-p_msdxylg84qsjp-base-v6.png"
MODULE = ROOT / "tmp-card-refs" / "shakehand-high-module-v4.png"
OUT = ROOT / "tmp-card-preview" / "all" / "chars" / "001-p_msdxylg84qsjp-shake-v4.png"


def erase_old_racket_and_hand(base: Image.Image) -> Image.Image:
    out = base.copy().convert("RGBA")
    alpha = out.getchannel("A")
    mask = Image.new("L", out.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 318, 346, 780), radius=34, fill=255)
    d.polygon([(150, 470), (360, 515), (292, 700), (84, 676)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    cleared_alpha = Image.composite(Image.new("L", out.size, 0), alpha, mask)
    out.putalpha(cleared_alpha)
    return out


def main() -> None:
    base = Image.open(BASE).convert("RGBA")
    module = Image.open(MODULE).convert("RGBA")
    module.thumbnail((230, 365), Image.LANCZOS)
    composed = erase_old_racket_and_hand(base)
    composed.alpha_composite(module, (38, 364))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    composed.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
