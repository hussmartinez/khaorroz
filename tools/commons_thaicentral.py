#!/usr/bin/env python3
"""Photo-round variant of commons_fetch.py: fetch chosen Commons photos, convert to WebP into content/images/,
and write attribution to a hand-off JSON (not content/images.json, which another step merges).

Usage: uv run --with pillow python3 tools/commons_thaicentral.py <workdir> <selections.json> <handoff.json>
selections.json: {"<target-slug>": {"from": "<candidate slug, default = target>", "pick": <index>, "alt": {en,es,ca,th,ar}}}"""
import json, re, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from commons_fetch import get, url_1600, to_webp, license_url  # reuse the tested helpers

ROOT = Path(__file__).resolve().parent.parent


def main():
    work, sel, out = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text()), Path(sys.argv[3])
    cands = json.loads((work / "candidates.json").read_text())
    data = json.loads(out.read_text()) if out.exists() else {}
    img_dir = ROOT / "content" / "images"
    for slug, s in sel.items():
        file = f"recipe_{slug.replace('-', '_')}.md"
        if file in data:
            continue
        c = cands[s.get("from", slug)]["candidates"][s["pick"]]
        webp, (w, h) = to_webp(get(url_1600(c["title"])))
        (img_dir / f"{slug}.webp").write_bytes(webp)
        author = re.sub(r"\s+", " ", c["author"]).strip() or "Unknown (see source page)"
        data[file] = {"file": f"images/{slug}.webp", "width": w, "height": h, "commonsTitle": c["title"],
                      "source": c["page"], "author": author, "license": c["license"],
                      "licenseUrl": license_url(c["license"], c.get("licenseUrl", "")), "alt": s["alt"]}
        out.write_text(json.dumps(data, ensure_ascii=False, indent=1))
        print(f"{slug}: {len(webp)//1024} KB {w}x{h} {c['license']} <- {c['title'][5:60]}", flush=True)
        time.sleep(0.5)


if __name__ == "__main__":
    main()
