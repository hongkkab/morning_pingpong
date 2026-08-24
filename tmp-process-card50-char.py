from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def flood_background(cand: np.ndarray) -> np.ndarray:
    h, w = cand.shape
    bg = np.zeros((h, w), dtype=bool)
    stack: list[tuple[int, int]] = []
    for x in range(w):
        if cand[0, x]:
            stack.append((0, x))
            bg[0, x] = True
        if cand[h - 1, x] and not bg[h - 1, x]:
            stack.append((h - 1, x))
            bg[h - 1, x] = True
    for y in range(h):
        if cand[y, 0] and not bg[y, 0]:
            stack.append((y, 0))
            bg[y, 0] = True
        if cand[y, w - 1] and not bg[y, w - 1]:
            stack.append((y, w - 1))
            bg[y, w - 1] = True
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                stack.append((ny, nx))
    return bg


def fill_holes(mask: np.ndarray) -> np.ndarray:
    return ~flood_background(~mask)


def drop_edge_slivers(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    keep = np.zeros((h, w), dtype=bool)
    for y in range(h):
        xs = np.where(mask[y] & ~seen[y])[0]
        for x0 in xs:
            if seen[y, x0] or not mask[y, x0]:
                continue
            stack = [(y, x0)]
            pix = []
            seen[y, x0] = True
            l = r = x0
            t = b = y
            while stack:
                cy, cx = stack.pop()
                pix.append((cy, cx))
                l = min(l, cx)
                r = max(r, cx)
                t = min(t, cy)
                b = max(b, cy)
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            area = len(pix)
            touches_side = l <= 1 or r >= w - 2
            tiny = area < 900 or (r - l + 1) < 16 or (b - t + 1) < 16
            side_sliver = touches_side and area < 14000 and ((l + r) / 2 < w * 0.18 or (l + r) / 2 > w * 0.82)
            if tiny or side_sliver:
                continue
            for py, px in pix:
                keep[py, px] = True
    return keep


def edge_white_to_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    if im.getchannel("A").getextrema()[0] < 250:
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        im = bg
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.int16)
    mean = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    cand = ((mean > 205) & (spread < 58)) | ((mean > 185) & (spread < 32))
    bg = flood_background(cand)
    fg = ~bg
    closed = Image.fromarray(np.where(fg, 255, 0).astype("uint8"), "L")
    closed = closed.filter(ImageFilter.MaxFilter(25)).filter(ImageFilter.MinFilter(25))
    filled = fill_holes(np.array(closed) > 128)
    near_top = np.array(
        Image.fromarray(np.where(fg, 255, 0).astype("uint8"), "L").filter(ImageFilter.MaxFilter(7))
    ) > 128
    near_bottom = np.array(
        Image.fromarray(np.where(fg, 255, 0).astype("uint8"), "L").filter(ImageFilter.MaxFilter(25))
    ) > 128
    yy = np.arange(fg.shape[0])[:, None]
    fill_zone = (yy < int(fg.shape[0] * 0.50)) | (yy >= int(fg.shape[0] * 0.66))
    near = np.where(yy >= int(fg.shape[0] * 0.66), near_bottom, near_top)
    fixed = drop_edge_slivers(fg | (filled & cand & near & fill_zone))
    alpha = np.where(fixed, 255, 0).astype("uint8")
    mask = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.35))
    arr[:, :, 3] = np.array(mask)
    return Image.fromarray(arr, "RGBA")


def trim_white_fringe(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(np.int16)
    mean = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    inside = alpha > 12
    core = np.array(
        Image.fromarray(np.where(inside, 255, 0).astype("uint8"), "L").filter(ImageFilter.MinFilter(9))
    ) > 128
    white_edge = inside & ~core & (mean > 185) & (spread < 80)
    arr[:, :, 3] = np.where(white_edge, 0, alpha)
    return Image.fromarray(arr, "RGBA")


def crop_alpha(im: Image.Image, pad: int = 18) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("out", type=Path)
    args = ap.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    im = crop_alpha(trim_white_fringe(edge_white_to_alpha(Image.open(args.src))), 10)
    im.save(args.out)
    print(args.out)


if __name__ == "__main__":
    main()
