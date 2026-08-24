from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")


def make_card(frame_name: str, char_rel: str) -> Image.Image:
    frame = Image.open(ROOT / "tmp-card-preview" / "current-embedded-frames" / frame_name).convert("RGBA")
    char = Image.open(ROOT / char_rel).convert("RGBA")
    box = char.getchannel("A").getbbox()
    if box:
        char = char.crop(box)

    target = (
        int(frame.width * 0.07),
        int(frame.height * 0.13),
        int(frame.width * 0.93),
        int(frame.height * 0.79),
    )
    scale = min((target[2] - target[0]) / char.width, (target[3] - target[1]) / char.height)
    char = char.resize((round(char.width * scale), round(char.height * scale)), Image.Resampling.LANCZOS)

    alpha = char.getchannel("A")
    glow = Image.new("RGBA", char.size, (116, 240, 230, 0))
    glow.putalpha(alpha.filter(ImageFilter.GaussianBlur(2)))

    card = frame.copy()
    x = (frame.width - char.width) // 2
    y = target[3] - char.height
    card.alpha_composite(glow, (x, y))
    card.alpha_composite(char, (x, y))
    return card


def main() -> None:
    approved = Image.open(
        ROOT / "tmp-card-preview" / "attendance-top5-v2" / "attendance-top5-v2-card-preview.png"
    ).convert("RGB")
    approved = approved.resize((860, 242), Image.Resampling.LANCZOS)

    frames = Image.open(
        ROOT / "tmp-card-preview" / "current-embedded-frames" / "embedded-frame-preview.png"
    ).convert("RGB")
    frames = frames.resize((700, 245), Image.Resampling.LANCZOS)

    seo = make_card("plat.webp", "tmp-card-preview/all-v2/chars/003-p_msjq6v7y5ixgz-v4.png")
    seo = seo.resize((258, 387), Image.Resampling.LANCZOS).convert("RGB")

    sheet = Image.new("RGB", (900, 690), (6, 10, 15))
    sheet.paste(approved, (20, 20))
    sheet.paste(frames, (20, 300))
    sheet.paste(seo, (622, 282))
    out = ROOT / "tmp-card-preview" / "all-v2" / "recheck-seo-v4-and-current-frames.png"
    sheet.save(out, quality=94)
    print(out)


if __name__ == "__main__":
    main()
