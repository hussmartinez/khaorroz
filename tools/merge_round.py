#!/usr/bin/env python3
"""Merge research-fork hand-off files into the atlas data.

Usage: python3 tools/merge_round.py /tmp/round3/<fork>.json [...]

Each hand-off file:
  {"glosses": {file: {en,es,ca,th,ar}}, "categories": {file: id},
   "families": {file: [family names]}, "newCategories": {id: {name:{..}, description:{..}}},
   "regionNotes": {provincial_x.md: ["Dish | type | zone", ...]}}

- glosses.json: adds glosses; puts each recipe into exactly one category of its area
  (area found from the recipe's nav-line region files); creates newCategories.
- tools/atlas.py: appends recipes to FAMILIES (existing names only; unknown family names
  are reported so a human can add them with translations).
- provincial_*.md: appends rows to the "## 3." recipes table (dedup by recipe link).
Only touches recipes whose files exist. Prints a summary; never deletes anything.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
C = ROOT / "content"


def nav_regions(f: Path):
    line = next((l for l in f.read_text(encoding="utf-8").splitlines() if l.startswith("> ⬅")), "")
    return re.findall(r"\((provincial_[a-z_]+\.md)\)", line)


def main(paths):
    g = json.loads((C / "glosses.json").read_text(encoding="utf-8"))
    region_area = {r: a for a, v in g["areas"].items() for r in v.get("regions", [])}
    atlas = (ROOT / "tools" / "atlas.py").read_text(encoding="utf-8")
    fam_names = re.findall(r'^    "([^"]+)": \(\n', atlas, re.M)
    unknown_fams, missing, report = {}, [], []

    for path in paths:
        h = json.loads(Path(path).read_text(encoding="utf-8"))
        name = Path(path).stem
        n = 0
        # new categories (any area that the fork's recipes belong to)
        for cid, spec in (h.get("newCategories") or {}).items():
            for a, v in g["areas"].items():
                if a == "spain":
                    continue
                ids = {c["id"] for c in v.get("categories", [])}
                # create in the area that owns recipes assigned to it
                owners = {region_area.get(r) for f, c in (h.get("categories") or {}).items() if c == cid
                          for r in (nav_regions(C / f) if (C / f).exists() else [])}
                if a in owners and cid not in ids:
                    v.setdefault("categories", []).append({"id": cid, "name": spec["name"],
                                                           "description": spec["description"], "members": []})
        for f, gl in (h.get("glosses") or {}).items():
            if not (C / f).exists():
                missing.append(f"{name}: {f}")
                continue
            g["recipes"][f] = gl
            n += 1
        for f, cid in (h.get("categories") or {}).items():
            if not (C / f).exists():
                continue
            areas = {region_area.get(r) for r in nav_regions(C / f)} - {None, "spain"}
            for a in areas:
                cats = g["areas"][a].get("categories", [])
                for c in cats:  # exactly one category per area
                    if f in c["members"] and c["id"] != cid:
                        c["members"].remove(f)
                tgt = next((c for c in cats if c["id"] == cid), None)
                if tgt is None:
                    missing.append(f"{name}: category '{cid}' not in area '{a}' for {f}")
                elif f not in tgt["members"]:
                    tgt["members"].append(f)
        for f, fams in (h.get("families") or {}).items():
            if not (C / f).exists():
                continue
            stem = f[len("recipe_"):-3]
            for fam in fams:
                if fam not in fam_names:
                    unknown_fams.setdefault(fam, []).append(stem)
                    continue
                m = re.search(r'    "' + re.escape(fam) + r'": \(\n.*?\n        \[(.*?)\]\),', atlas, re.S)
                if f'"{stem}"' in m.group(1):
                    continue
                atlas = atlas[:m.start(1)] + m.group(1).rstrip() + f', "{stem}"' + atlas[m.end(1):]
        for pf, rows in (h.get("regionNotes") or {}).items():
            p = C / pf
            if not p.exists():
                continue
            s = p.read_text(encoding="utf-8")
            m = re.search(r"^## 3\..*?$\n(.*?)(?=^## \d+\.|\Z)", s, re.S | re.M)
            if not m:
                continue
            body = m.group(1).rstrip("\n")
            add = []
            for row in rows:
                link = re.search(r"\((recipe_[a-z0-9_]+\.md)\)", row)
                if link and link.group(1) in s:
                    continue
                if not (link and (C / link.group(1)).exists()):
                    continue
                row = row.strip()
                add.append(row if row.startswith("|") else "| " + row + " |")
            if add:
                s = s[:m.start(1)] + body + "\n" + "\n".join(add) + "\n\n" + s[m.end(1):].lstrip("\n")
                p.write_text(s, encoding="utf-8")
        report.append(f"{name}: {n} glosses merged")

    (C / "glosses.json").write_text(json.dumps(g, ensure_ascii=False, indent=1), encoding="utf-8")
    (ROOT / "tools" / "atlas.py").write_text(atlas, encoding="utf-8")
    print("\n".join(report))
    if missing:
        print("SKIPPED:", *missing, sep="\n  ")
    if unknown_fams:
        print("UNKNOWN FAMILIES (add to FAMILIES + FAMILY_I18N):", json.dumps(unknown_fams, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1:])
