from pathlib import Path
import json

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
OUT = ROOT / "tmp-card-preview" / "top50"
CHAR_DIR = OUT / "chars"
CHAR_DIR.mkdir(parents=True, exist_ok=True)

TOP5_SHEET = ROOT / "tmp-card-preview" / "top10-review" / "top10-v5-colorful-01-05-v2.png"
TOP6_10 = ROOT / "tmp-card-preview" / "top10-individual-v2"
RANKING = OUT / "top50-by-games.json"


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


def cleanup_known_artifacts(rank: int, im: Image.Image) -> Image.Image:
    if rank != 3:
        return im
    arr = np.array(im.convert("RGBA"))
    rgb = arr[:, :, :3].astype(np.int16)
    mean = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    h, w = arr.shape[:2]
    yy = np.arange(h)[:, None]
    xx = np.arange(w)[None, :]
    floor_remnant = (yy > int(h * 0.945)) & (xx > int(w * 0.78)) & (mean > 210) & (spread < 42)
    arr[:, :, 3] = np.where(floor_remnant, 0, arr[:, :, 3])
    return Image.fromarray(arr, "RGBA")


def find_components(mask: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    comps = []
    for y in range(h):
        xs = np.where(mask[y] & ~seen[y])[0]
        for x0 in xs:
            if seen[y, x0] or not mask[y, x0]:
                continue
            stack = [(y, x0)]
            seen[y, x0] = True
            l = r = x0
            t = b = y
            area = 0
            while stack:
                cy, cx = stack.pop()
                area += 1
                l = min(l, cx)
                r = max(r, cx)
                t = min(t, cy)
                b = max(b, cy)
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            if area > 6000 and (b - t) > 220:
                comps.append((l, t, r + 1, b + 1, area))
    return sorted(comps, key=lambda c: c[0])


def split_top5() -> list[Path]:
    im = Image.open(TOP5_SHEET).convert("RGBA")
    # The approved top-5 sheet is a fixed five-character lineup.
    # Manual x windows avoid merging adjacent rackets/arms during segmentation.
    comps = [
        (35, 45, 420, 795, 0),
        (430, 45, 760, 795, 0),
        (760, 45, 1060, 795, 0),
        (1075, 45, 1430, 795, 0),
        (1435, 45, 1785, 795, 0),
    ]
    ranking = json.loads(RANKING.read_text(encoding="utf-8"))
    paths = []
    for item, (l, t, r, b, _area) in zip(ranking[:5], comps):
        pad = 18
        crop = im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))
        out = CHAR_DIR / f"{int(item['rank']):02d}-{item['id']}.png"
        char = trim_white_fringe(edge_white_to_alpha(crop))
        cleanup_known_artifacts(int(item["rank"]), crop_alpha(char, 8)).save(out)
        paths.append(out)
    return paths


def copy_top6_10() -> list[Path]:
    ranking = json.loads(RANKING.read_text(encoding="utf-8"))
    sources = [
        TOP6_10 / "06-jung-kijin.png",
        TOP6_10 / "07-dong-jongseong-tomahawk.png",
        TOP6_10 / "08-ahn-hyegyeong.png",
        TOP6_10 / "09-gwak-myeonghun.png",
        TOP6_10 / "10-jo-daewoo.png",
    ]
    paths = []
    for item, src in zip(ranking[5:10], sources):
        out = CHAR_DIR / f"{int(item['rank']):02d}-{item['id']}.png"
        crop_alpha(trim_white_fringe(edge_white_to_alpha(Image.open(src))), 8).save(out)
        paths.append(out)
    return paths


def write_items() -> Path:
    ranking = json.loads(RANKING.read_text(encoding="utf-8"))
    items = []
    for item in ranking[:10]:
        p = CHAR_DIR / f"{int(item['rank']):02d}-{item['id']}.png"
        items.append({"rank": item["rank"], "id": item["id"], "name": item["name"], "path": str(p)})
    out = OUT / "generated-items.json"
    out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


split_top5()
copy_top6_10()
print(write_items())
