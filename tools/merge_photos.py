#!/usr/bin/env python3
"""Merge photo hand-off files (/tmp/photos/<fork>.json) into content/images.json.
Validates that each recipe exists, the webp exists, and all credit fields are present.
Usage: python3 tools/merge_photos.py /tmp/photos/a.json [...]"""
import json, sys
from pathlib import Path
C = Path(__file__).resolve().parent.parent / "content"
p = C / "images.json"; data = json.loads(p.read_text(encoding="utf-8"))
need = ("file", "width", "height", "source", "author", "license", "licenseUrl", "alt")
for h in sys.argv[1:]:
    ok = bad = 0
    for f, e in json.loads(Path(h).read_text(encoding="utf-8")).items():
        if not (C / f).exists() or not (C / e.get("file", "")).exists() or any(not e.get(k) for k in need) \
           or set(e["alt"]) < {"en", "es", "ca", "th", "ar"}:
            print("  rejected:", Path(h).stem, f); bad += 1; continue
        data["recipes"][f] = e; ok += 1
    print(f"{Path(h).stem}: {ok} merged, {bad} rejected")
p.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print("images.json entries:", len(data["recipes"]))
