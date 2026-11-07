#!/usr/bin/env python3
"""Search Wikimedia Commons for freely licensed photos of a dish. Prints candidates with license + author.
Usage: python3 tools/commons_search.py "paella valenciana" [limit]"""
import json, sys, urllib.parse, urllib.request, re
API = "https://commons.wikimedia.org/w/api.php"
OK = re.compile(r"^(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)", re.I)
def get(params):
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params),
                                 headers={"User-Agent": "Khaorroz-atlas/1.0 (https://github.com/hussmartinez/khaorroz)"})
    return json.load(urllib.request.urlopen(req, timeout=30))
def search(q, limit=8):
    d = get({"action": "query", "format": "json", "generator": "search", "gsrsearch": f"filetype:bitmap {q}",
             "gsrnamespace": 6, "gsrlimit": limit, "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 800})
    out = []
    for p in (d.get("query", {}).get("pages", {}) or {}).values():
        ii = p["imageinfo"][0]; m = ii.get("extmetadata", {})
        lic = m.get("LicenseShortName", {}).get("value", "")
        artist = re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", "")).strip()
        out.append({"title": p["title"], "license": lic, "ok": bool(OK.match(lic)), "artist": artist[:60],
                    "w": ii.get("width"), "h": ii.get("height"), "thumb": ii.get("thumburl"),
                    "page": ii.get("descriptionurl"), "licenseUrl": m.get("LicenseUrl", {}).get("value", "")})
    return out
if __name__ == "__main__":
    for c in search(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 8):
        print(("✓" if c["ok"] else "✗"), c["license"][:14].ljust(14), f'{c["w"]}x{c["h"]}'.ljust(10), c["title"][5:80], "|", c["artist"])
