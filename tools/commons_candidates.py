#!/usr/bin/env python3
"""Collect freely licensed Commons photo candidates for each recipe and build contact sheets for visual review.

Usage: uv run --with pillow python3 tools/commons_candidates.py <workdir> [slug ...]
Writes <workdir>/candidates.json and <workdir>/sheets/sheet_NN.png (4 dishes per sheet, numbered thumbs).
Downloads are untrusted data and stay in <workdir> (outside the repo)."""
import io, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "Khaorroz-atlas/1.0 (https://github.com/hussmartinez/khaorroz)"}
OVERRIDES: dict = {}
OK = re.compile(r"^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)", re.I)


def get_json(params):
    for attempt in range(4):
        try:
            req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=40))
        except Exception:
            time.sleep(2 + attempt * 3)
    return {}


def fetch(url):
    for attempt in range(4):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except Exception:
            time.sleep(2 + attempt * 3)
    return None


def search(q, limit=6):
    d = get_json({"action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap {q}",
                  "gsrnamespace": 6, "gsrlimit": limit, "prop": "imageinfo", "iiprop": "url|size|extmetadata",
                  "iiurlwidth": 400})
    out = []
    pages = sorted((d.get("query", {}).get("pages", {}) or {}).values(), key=lambda p: p.get("index", 99))
    for p in pages:
        ii = p["imageinfo"][0]; m = ii.get("extmetadata", {})
        lic = m.get("LicenseShortName", {}).get("value", "")
        if not OK.match(lic) or re.search(r"\b(NC|ND)\b", lic):
            continue
        out.append({"title": p["title"], "license": lic, "w": ii.get("width"), "h": ii.get("height"),
                    "thumb": ii.get("thumburl"), "page": ii.get("descriptionurl"),
                    "author": re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip(),
                    "licenseUrl": m.get("LicenseUrl", {}).get("value", "")})
    return out


def queries(h1):
    parts = [x.strip() for x in h1.split(" / ")]
    qs = []
    for p in parts:
        qs.append(re.sub(r"\s*\(.*?\)", "", p).strip())
        qs += re.findall(r"\((.*?)\)", p)
    seen, res = set(), []
    for q in qs:
        k = q.lower()
        if q and k not in seen and len(q) > 2:
            seen.add(k); res.append(q)
    return res[:4]


def main():
    work = Path(sys.argv[1]); work.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[2:])
    global OVERRIDES
    ov = work / "overrides.json"   # optional {slug: [queries]} for a targeted second pass
    OVERRIDES = json.loads(ov.read_text()) if ov.exists() else {}
    if OVERRIDES and not only:
        only = set(OVERRIDES)
    cand_file = work / "candidates.json"
    cands = json.loads(cand_file.read_text()) if cand_file.exists() else {}
    recipes = sorted(ROOT.glob("content/recipe_*.md"))
    for f in recipes:
        slug = f.stem[len("recipe_"):].replace("_", "-")
        if only and slug not in only:
            continue
        if slug in cands and slug not in OVERRIDES and not only:
            continue
        h1 = f.read_text(encoding="utf-8").splitlines()[0][2:].strip()
        found, titles = [], set()
        for q in OVERRIDES.get(slug) or queries(h1):
            for c in search(q):
                if c["title"] not in titles:
                    titles.add(c["title"]); c["query"] = q; found.append(c)
            time.sleep(0.5)
            if len(found) >= 8:
                break
        found = found[:8]
        for i, c in enumerate(found):
            data = fetch(c["thumb"]) if c["thumb"] else None
            if data:
                p = work / "thumbs" / slug / f"{i}.img"; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(data)
                c["local"] = str(p)
            time.sleep(0.2)
        cands[slug] = {"file": f.name, "h1": h1, "candidates": found}
        cand_file.write_text(json.dumps(cands, ensure_ascii=False, indent=1))
        print(f"{slug}: {len(found)}", flush=True)
    # contact sheets
    sheets = work / ("sheets2" if OVERRIDES else "sheets"); sheets.mkdir(exist_ok=True)
    slugs = [s for s in sorted(cands) if cands[s]["candidates"] and (not only or s in only)]
    TW, TH = 260, 190
    for n in range(0, len(slugs), 4):
        group = slugs[n:n + 4]
        sheet = Image.new("RGB", (TW * 8 + 10, len(group) * (TH + 34)), "white")
        d = ImageDraw.Draw(sheet)
        for r, s in enumerate(group):
            y = r * (TH + 34)
            d.text((5, y + 3), f"{s}  ::  {cands[s]['h1'][:110].encode('ascii', 'replace').decode()}", fill="black")
            for i, c in enumerate(cands[s]["candidates"]):
                if "local" not in c:
                    continue
                try:
                    im = Image.open(c["local"]).convert("RGB"); im.thumbnail((TW - 6, TH - 4))
                except Exception:
                    continue
                x = i * TW + 5
                sheet.paste(im, (x, y + 18))
                d.rectangle([x, y + 18, x + 22, y + 34], fill="yellow"); d.text((x + 6, y + 20), str(i), fill="black")
        sheet.save(sheets / f"sheet_{n // 4:02d}.png")
    print("sheets:", len(range(0, len(slugs), 4)))


if __name__ == "__main__":
    main()
