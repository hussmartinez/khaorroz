#!/usr/bin/env python3
"""Sham photo round: download chosen Commons photos, convert to WebP, write attribution to a hand-off JSON (not images.json).

Usage: uv run --with pillow python3 tools/commons_fetch.py <workdir> <selections.json>
selections.json: {"<slug>": {"pick": <candidate index>, "alt": {"en": .., "es": .., "ca": .., "th": .., "ar": ..}}}
Raw downloads stay in <workdir>; only the converted WebP goes into content/images/."""
import io, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
UA = {"User-Agent": "Khaorroz-atlas/1.0 (https://github.com/hussmartinez/khaorroz)"}
API = "https://commons.wikimedia.org/w/api.php"
MAX_W, TARGET = 1600, 200_000


def get(url):
    for attempt in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
        except Exception:
            time.sleep(3 + attempt * 4)
    raise RuntimeError("download failed: " + url)


def url_1600(title):
    q = urllib.parse.urlencode({"action": "query", "format": "json", "titles": title, "prop": "imageinfo",
                                "iiprop": "url|size", "iiurlwidth": MAX_W})
    d = json.loads(get(API + "?" + q))
    ii = next(iter(d["query"]["pages"].values()))["imageinfo"][0]
    return ii.get("thumburl") or ii["url"]


def to_webp(raw):
    im = Image.open(io.BytesIO(raw)); im.load()
    im = im.convert("RGB")
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    for q in (80, 72, 65, 58):
        buf = io.BytesIO(); im.save(buf, "WEBP", quality=q, method=6)  # no metadata written
        if buf.tell() <= TARGET:
            break
    if buf.tell() > TARGET and im.width > 1200:
        im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, "WEBP", quality=70, method=6)
    return buf.getvalue(), im.size


def license_url(lic, given):
    if given:
        return given
    m = re.match(r"CC (BY(?:-SA)?) ([0-9.]+)", lic)
    if m:
        return f"https://creativecommons.org/licenses/{m.group(1).lower()}/{m.group(2)}/"
    if lic.upper().startswith("CC0"):
        return "https://creativecommons.org/publicdomain/zero/1.0/"
    return ""


def main():
    """Usage: uv run --with pillow python3 tools/commons_sham.py <selections.json> <handoff.json>
    selections: [{"file": "recipe_x.md", "title": "File:..", "license": .., "licenseUrl": .., "author": .., "page": .., "alt": {..}}]"""
    sel = json.loads(Path(sys.argv[1]).read_text())
    out_path = Path(sys.argv[2])
    out = json.loads(out_path.read_text()) if out_path.exists() else {}
    out_dir = ROOT / "content" / "images"; out_dir.mkdir(exist_ok=True)
    for s in sel:
        slug = s["file"][len("recipe_"):-3].replace("_", "-")
        raw = get(url_1600(s["title"]))
        webp, (w, h) = to_webp(raw)
        (out_dir / f"{slug}.webp").write_bytes(webp)
        author = re.sub(r"\s+", " ", s["author"]).strip() or "Unknown (see source page)"
        out[s["file"]] = {"file": f"images/{slug}.webp", "width": w, "height": h, "commonsTitle": s["title"],
                          "source": s["page"], "author": author, "license": s["license"],
                          "licenseUrl": license_url(s["license"], s.get("licenseUrl", "")), "alt": s["alt"]}
        out_path.write_text(json.dumps(out, ensure_ascii=False, indent=1))
        print(f"{slug}: {len(webp)//1024} KB {w}x{h} {s['license']}", flush=True)
        time.sleep(0.5)


if __name__ == "__main__":
    main()
