import json
import urllib.request
from pathlib import Path

ITEMS = [
    ("01", "이균호", "https://coresos-phinf.pstatic.net/a/37j3g9/3_7j6Ud018svc1tuxln6wlpxjh_yy8vy.jpg"),
    ("02", "윤경배", "https://coresos-phinf.pstatic.net/a/388eae/e_ab5Ud018svc1am5kjc1ayx3n_qobdcr.jpg"),
    ("03", "서호철", "https://coresos-phinf.pstatic.net/a/37g4bc/8_icfUd018svcbcn5y9uegbng_t768if.jpg"),
    ("04", "안치훈", "https://coresos-phinf.pstatic.net/a/2g3aff_g/gggUd015tlzihvf8kvxs_3yyj8i.jpg"),
    ("05", "김재훈", "https://coresos-phinf.pstatic.net/a/357f1g/i_f30Ud018svc15xgh0jer5v0m_ryd5cl.jpg"),
]

out = Path("tmp-card-preview/top5-source-refs")
out.mkdir(parents=True, exist_ok=True)

done = []
for no, name, url in ITEMS:
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "Mozilla/5.0")
    req.add_header("Referer", "https://band.us/")
    with urllib.request.urlopen(req, timeout=60) as res:
        data = res.read()
        ctype = res.headers.get("Content-Type", "")
    ext = "jpg"
    if "png" in ctype.lower() or url.lower().endswith(".png"):
        ext = "png"
    path = out / f"{no}-{name}.{ext}"
    path.write_bytes(data)
    done.append({"name": name, "path": str(path), "bytes": len(data), "contentType": ctype})

print(json.dumps(done, ensure_ascii=False, indent=2))
