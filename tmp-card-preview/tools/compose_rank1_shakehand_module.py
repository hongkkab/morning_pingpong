from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
SRC = ROOT / "tmp-card-preview" / "all" / "chars" / "001-p_msdxylg84qsjp.png"
OUT = ROOT / "tmp-card-preview" / "all" / "chars" / "001-p_msdxylg84qsjp-shake-module.png"
MODULE_OUT = ROOT / "tmp-card-refs" / "shakehand-front-module-v1.png"


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def make_grip_module(scale: int = 4) -> Image.Image:
    w, h = 320 * scale, 430 * scale
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def sbox(box):
        return tuple(int(v * scale) for v in box)

    skin = (238, 169, 102, 255)
    skin_hi = (255, 205, 145, 255)
    skin_shadow = (190, 104, 54, 255)
    outline = (126, 70, 38, 255)
    red = (210, 20, 22, 255)
    red_hi = (246, 52, 42, 255)
    red_shadow = (132, 18, 24, 255)
    black = (20, 20, 22, 255)
    wood = (142, 83, 33, 255)
    wood_hi = (205, 139, 68, 255)
    wood_shadow = (66, 38, 22, 255)

    # Racket blade, drawn first so it hides the index finger side completely.
    d.ellipse(sbox((48, 10, 276, 244)), fill=black)
    d.ellipse(sbox((61, 22, 263, 232)), fill=red)
    d.ellipse(sbox((73, 35, 248, 216)), outline=red_hi, width=3 * scale)
    d.arc(sbox((67, 31, 254, 225)), 190, 320, fill=red_shadow, width=3 * scale)
    for yy in (190, 197, 204):
        d.arc(sbox((70, yy - 30, 255, yy + 40)), 185, 340, fill=(170, 20, 22, 110), width=1 * scale)

    # Neck and handle stay partly visible between the fingers.
    d.polygon(
        [tuple(int(v * scale) for v in p) for p in [(133, 224), (182, 224), (196, 405), (118, 405)]],
        fill=wood_shadow,
    )
    rounded(d, sbox((128, 229, 187, 407)), 12 * scale, wood, wood_shadow, 3 * scale)
    d.line(sbox((145, 240, 131, 392)), fill=wood_hi, width=5 * scale)
    d.line(sbox((173, 240, 185, 392)), fill=(50, 36, 25, 220), width=5 * scale)
    d.ellipse(sbox((146, 304, 158, 316)), fill=(235, 164, 83, 255))
    d.ellipse(sbox((155, 364, 167, 376)), fill=(235, 164, 83, 255))

    # Palm/wrist behind the handle, connecting to the forearm on the right.
    rounded(d, sbox((154, 230, 304, 352)), 55 * scale, skin, outline, 3 * scale)
    rounded(d, sbox((230, 250, 320, 334)), 34 * scale, skin, outline, 3 * scale)
    d.ellipse(sbox((229, 263, 304, 324)), fill=skin)

    # Thumb support on the front shoulder: short and supportive, not pinching.
    rounded(d, sbox((92, 224, 169, 287)), 27 * scale, skin, outline, 3 * scale)
    d.ellipse(sbox((110, 238, 148, 268)), fill=skin_hi)

    # Redraw handle center so it is visible through the grip.
    rounded(d, sbox((134, 251, 184, 407)), 10 * scale, wood, wood_shadow, 2 * scale)
    d.line(sbox((149, 260, 137, 395)), fill=wood_hi, width=4 * scale)
    d.line(sbox((171, 260, 181, 395)), fill=(50, 36, 25, 200), width=4 * scale)

    # Three separated handle fingers. No index finger is drawn.
    finger_boxes = [(70, 258, 184, 310), (72, 315, 188, 366), (80, 370, 190, 417)]
    for i, box in enumerate(finger_boxes):
        rounded(d, sbox(box), 23 * scale, skin, outline, 3 * scale)
        x1, y1, x2, y2 = box
        d.line(sbox((x1 + 20, y1 + 17, x2 - 18, y1 + 17)), fill=skin_shadow, width=2 * scale)
        d.ellipse(sbox((x1 + 8, y1 + 8, x1 + 42, y1 + 35)), fill=skin_hi)
        if i < 2:
            d.line(sbox((x1 + 30, y2 - 3, x2 - 24, y2 - 3)), fill=(88, 48, 25, 150), width=2 * scale)

    # Small occlusion shadow under blade, emphasizing that the hidden index is behind it.
    d.rectangle(sbox((125, 224, 188, 236)), fill=(45, 26, 17, 100))
    im = im.filter(ImageFilter.GaussianBlur(0.25 * scale))
    im = im.resize((320, 430), Image.LANCZOS)
    return im


def erase_old_grip(base: Image.Image) -> Image.Image:
    out = base.copy().convert("RGBA")
    mask = Image.new("L", out.size, 0)
    d = ImageDraw.Draw(mask)
    # Clear the old racket/hand region completely; the module includes its own wrist.
    d.rounded_rectangle((0, 342, 316, 768), radius=32, fill=255)
    d.polygon([(190, 500), (330, 535), (275, 690), (120, 668)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    arr = out.getchannel("A")
    out.putalpha(Image.composite(Image.new("L", out.size, 0), arr, mask))
    return out


def main() -> None:
    base = Image.open(SRC).convert("RGBA")
    module = make_grip_module()
    module = module.resize((230, 309), Image.LANCZOS)
    MODULE_OUT.parent.mkdir(parents=True, exist_ok=True)
    module.save(MODULE_OUT)

    out = erase_old_grip(base)
    # Position module to connect the new wrist with the existing right forearm.
    out.alpha_composite(module, (36, 404))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.save(OUT)
    print(OUT)
    print(MODULE_OUT)


if __name__ == "__main__":
    main()
