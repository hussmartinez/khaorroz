#!/usr/bin/env python3
"""Sham photo retry: gather Commons candidates by browsing cuisine categories and by
multilingual search, then build numbered contact sheets for visual checking.

Usage:
  uv run --with pillow python3 tools/commons_sham_retry.py cats <workdir> "Category:A" ["Category:B" ...]
      -> <workdir>/cats.json : every file (with licence) in those categories + one level of subcategories
  uv run --with pillow python3 tools/commons_sham_retry.py search <workdir> <name> "query1" ["query2" ...]
      -> <workdir>/<name>.json : search candidates
  uv run --with pillow python3 tools/commons_sham_retry.py sheet <workdir> <cands.json> <out.png> [filter-regex]
      -> contact sheet of acceptable-licence candidates (index labels match the order in the json)
Raw thumbnails stay in <workdir> (untrusted data, opened only with Pillow)."""
import io, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw

UA = {"User-Agent": "Khaorroz-atlas/1.0 (https://github.com/hussmartinez/khaorroz)"}
API = "https://commons.wikimedia.org/w/api.php"
OK = re.compile(r"^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)", re.I)


def api(params):
    q = API + "?" + urllib.parse.urlencode({"format": "json", **params})
    for a in range(4):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(q, headers=UA), timeout=60).read())
        except Exception:
            time.sleep(3 + 4 * a)
    return {}


def info(titles):
    out = []
    for i in range(0, len(titles), 40):
        d = api({"action": "query", "titles": "|".join(titles[i:i + 40]), "prop": "imageinfo",
                 "iiprop": "url|size|extmetadata", "iiurlwidth": 300})
        for p in (d.get("query", {}).get("pages", {}) or {}).values():
            if "imageinfo" not in p:
                continue
            ii = p["imageinfo"][0]; m = ii.get("extmetadata", {})
            lic = m.get("LicenseShortName", {}).get("value", "")
            out.append({"title": p["title"], "license": lic, "ok": bool(OK.match(lic)),
                        "licenseUrl": m.get("LicenseUrl", {}).get("value", ""),
                        "author": re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()[:120],
                        "desc": re.sub(r"<[^>]+>", "", m.get("ImageDescription", {}).get("value", "")).strip()[:200],
                        "w": ii.get("width"), "h": ii.get("height"), "thumb": ii.get("thumburl"),
                        "page": ii.get("descriptionurl")})
        time.sleep(0.3)
    return out


def members(cat, kind):
    res, cont = [], {}
    while True:
        d = api({"action": "query", "list": "categorymembers", "cmtitle": cat, "cmtype": kind, "cmlimit": 500, **cont})
        res += [x["title"] for x in d.get("query", {}).get("categorymembers", [])]
        if "continue" not in d:
            return res
        cont = d["continue"]


def cats(workdir, roots):
    files = set()
    for c in roots:
        files.update(members(c, "file"))
        for sub in members(c, "subcat"):
            files.update(members(sub, "file"))
        time.sleep(0.3)
    data = info(sorted(files))
    Path(workdir, "cats.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(len(data), "files,", sum(x["ok"] for x in data), "with acceptable licence")


def search(workdir, name, queries):
    titles = []
    for q in queries:
        d = api({"action": "query", "list": "search", "srsearch": f"filetype:bitmap {q}", "srnamespace": 6, "srlimit": 15})
        titles += [x["title"] for x in d.get("query", {}).get("search", [])]
        time.sleep(0.3)
    data = info(list(dict.fromkeys(titles)))
    Path(workdir, f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    for i, c in enumerate(data):
        print(i, "✓" if c["ok"] else "✗", c["license"][:12].ljust(12), c["title"][5:90])


def sheet(workdir, cands, out, rx=None):
    data = json.loads(Path(cands).read_text())
    pat = re.compile(rx, re.I) if rx else None
    sel = [(i, c) for i, c in enumerate(data) if c["ok"] and c.get("thumb") and (not pat or pat.search(c["title"] + " " + c["desc"]))]
    cols, cw, ch = 4, 300, 250
    rows = (len(sel) + cols - 1) // cols or 1
    S = Image.new("RGB", (cols * cw, rows * ch), "white"); dr = ImageDraw.Draw(S)
    for k, (i, c) in enumerate(sel):
        try:
            raw = urllib.request.urlopen(urllib.request.Request(c["thumb"], headers=UA), timeout=60).read()
            im = Image.open(io.BytesIO(raw)); im.thumbnail((cw - 6, ch - 30)); im = im.convert("RGB")
            x, y = (k % cols) * cw, (k // cols) * ch
            S.paste(im, (x + 3, y + 3)); dr.text((x + 4, y + ch - 25), f"#{i} {c['title'][5:40]}", fill="black")
        except Exception as e:
            print("thumb fail", i, e)
        time.sleep(0.2)
    S.save(out); print("sheet", out, len(sel), "images:", [i for i, _ in sel])


if __name__ == "__main__":
    cmd, wd = sys.argv[1], sys.argv[2]
    Path(wd).mkdir(parents=True, exist_ok=True)
    if cmd == "cats":
        cats(wd, sys.argv[3:])
    elif cmd == "search":
        search(wd, sys.argv[3], sys.argv[4:])
    elif cmd == "sheet":
        sheet(wd, sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else None)
