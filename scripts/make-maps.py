#!/usr/bin/env python3
"""Build compact SVG map data for each rice tradition from geoBoundaries GeoJSON.

Usage: python3 -I scripts/make-maps.py <geojson-dir> apps/web/src/data/maps.json
Inputs (gbOpen, simplified): ESP-ADM2, THA-ADM1, and ADM0 for LBN SYR JOR PSE ISR PRT FRA AND MAR DZA
TUR IRQ EGY SAU CYP MMR LAO KHM MYS. Sources/licences are listed in the output's "attribution".
Output per area: viewBox, faint context outlines, one or more SVG paths per region file, and a
label point per region (centre of its largest polygon)."""
import json, math, sys, os

SRC, OUT = sys.argv[1], sys.argv[2]
W = 1000  # viewBox width

SPAIN = {
    "provincial_valencia.md": ["Valencia"], "provincial_alicante.md": ["Alicante"], "provincial_castellon.md": ["Castellon"],
    "provincial_murcia.md": ["Murcia"], "provincial_catalunya.md": ["Barcelona", "Girona", "Lleida", "Tarragona"],
    "provincial_baleares.md": ["Balears, Illes"], "provincial_canarias.md": ["Palmas, Las", "Santa Cruz de Tenerife"],
    "provincial_madrid.md": ["Madrid"],
    "provincial_andalucia.md": ["Almeria", "Cadiz", "Cordoba", "Granada", "Huelva", "Jaen", "Malaga", "Sevilla"],
    "provincial_aragon_navarra_rioja.md": ["Huesca", "Zaragoza", "Teruel", "Navarra", "Rioja, La"],
    "provincial_castilla_la_mancha_extremadura.md": ["Albacete", "Ciudad Real", "Cuenca", "Guadalajara", "Toledo", "Badajoz", "Caceres"],
    "provincial_castilla_y_leon.md": ["Avila", "Burgos", "Leon", "Palencia", "Salamanca", "Segovia", "Soria", "Valladolid", "Zamora"],
    "provincial_norte.md": ["Coruna", "Lugo", "Ourense", "Pontevedra", "Asturias", "Cantabria", "Alava", "Bizkaia", "Gipuzkoa"],
}
LANNA = ["Chiang Mai", "Chiang Rai", "Lampang", "Lamphun", "Mae Hong Son", "Nan", "Phayao", "Phrae"]
ISAN = ["Amnat Charoen", "Bueng Kan", "Buri Ram", "Chaiyaphum", "Kalasin", "Khon Kaen", "Loei", "Maha Sarakham", "Mukdahan",
        "Nakhon Phanom", "Nakhon Ratchasima", "Nong Bua Lam Phu", "Nong Khai", "Roi Et", "Sakon Nakhon", "Si Sa Ket", "Surin",
        "Ubon Ratchathani", "Udon Thani", "Yasothon"]
SOUTH = ["Chumphon", "Krabi", "Nakhon Si Thammarat", "Narathiwat", "Pattani", "Phangnga", "Phatthalung", "Phuket", "Ranong",
         "Satun", "Songkhla", "Surat Thani", "Trang", "Yala"]

def load(name):
    with open(os.path.join(SRC, name + ".geojson")) as f: return json.load(f)["features"]

def rings(geom):
    if geom["type"] == "Polygon": return [geom["coordinates"][0]]
    if geom["type"] == "MultiPolygon": return [p[0] for p in geom["coordinates"]]
    return []

def dp(pts, eps):  # Douglas–Peucker
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1; L = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L
        if d > dmax: dmax, idx = d, i
    if dmax > eps:
        return dp(pts[: idx + 1], eps)[:-1] + dp(pts[idx:], eps)
    return [pts[0], pts[-1]]

class Proj:
    def __init__(self, lon0, lon1, lat0, lat1):
        self.lon0, self.lat1 = lon0, lat1
        self.k = math.cos(math.radians((lat0 + lat1) / 2))
        self.s = W / ((lon1 - lon0) * self.k)
        self.h = (lat1 - lat0) * self.s
    def __call__(self, lon, lat, dx=0, dy=0):
        return ((lon - self.lon0) * self.k * self.s + dx, (self.lat1 - lat) * self.s + dy)

def path(ring, P, eps, min_area=6, dx=0, dy=0):
    pts = [P(lon, lat, dx, dy) for lon, lat in ring]
    # closed ring: split at the point farthest from the start, simplify both halves
    if len(pts) > 3:
        far = max(range(len(pts)), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
        pts = dp(pts[: far + 1], eps)[:-1] + dp(pts[far:], eps)
    if len(pts) < 4: return None, 0, (0, 0)
    area = abs(sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1] for i in range(len(pts) - 1))) / 2
    if area < min_area: return None, 0, (0, 0)
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    d = "M" + "L".join(f"{x:.0f} {y:.0f}" for x, y in pts) + "Z"
    return d, area, (cx, cy)

try:  # optional: merge each region's provinces into one outline (run with: uv run --with shapely …)
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union
    def merged(feats):
        u = unary_union([shape(f["geometry"]).buffer(0) for f in feats]).buffer(0.002).buffer(-0.002)
        return [{"geometry": mapping(u)}]
except ImportError:
    def merged(feats): return feats

# Hand-placed label anchors (lon, lat) where the shape-centre guess collides
LABEL_AT = {
    "provincial_norte.md": (-6.4, 43.15), "provincial_castilla_y_leon.md": (-4.9, 41.75), "provincial_aragon_navarra_rioja.md": (-1.0, 41.75),
    "provincial_catalunya.md": (1.55, 41.95), "provincial_madrid.md": (-3.75, 40.45), "provincial_castilla_la_mancha_extremadura.md": (-4.6, 39.2),
    "provincial_castellon.md": (-0.25, 40.25), "provincial_valencia.md": (-0.75, 39.35), "provincial_alicante.md": (-0.45, 38.5),
    "provincial_murcia.md": (-1.5, 38.0), "provincial_andalucia.md": (-4.7, 37.45), "provincial_baleares.md": (2.95, 39.85),
}

def build(P, regions, context, eps, inset=None):
    out = {"viewBox": f"0 0 {W} {P.h:.0f}", "context": [], "regions": {}, "labels": {}, "other": []}
    for feats in context:
        for f in feats:
            for r in rings(f["geometry"]):
                d, _, _ = path(r, P, eps * 3.5, 60)
                if d: out["context"].append(d)
    for key, feats in regions.items():
        best = (0, None)
        if key and feats:
            shift0 = feats[0][1]
            feats = [(g, shift0) for g in merged([f for f, _ in feats])]
        for f, shift in feats:
            for r in rings(f["geometry"]):
                d, a, c = path(r, P, eps, 8, *(shift or (0, 0)))
                if not d: continue
                if key: out["regions"].setdefault(key, []).append(d)
                else: out["other"].append(d)
                if a > best[0]: best = (a, c)
        if key and key in LABEL_AT and key != "provincial_canarias.md":
            x, y = P(*LABEL_AT[key]); out["labels"][key] = [round(x, 1), round(y, 1)]
        elif key and best[1]: out["labels"][key] = [round(best[1][0], 1), round(best[1][1], 1)]
    if inset: out["inset"] = inset
    return out

maps = {}
# ---- Spain (peninsula + Balearics; Canaries moved into an inset at bottom-left) ----
esp = load("ESP-ADM2")
P = Proj(-9.6, 4.6, 35.6, 44.0)
# Canaries: lon -18.3…-13.3, lat 27.6…29.5 → place in the lower-left corner
cx0, cy0 = P(-18.3, 29.5); tx, ty = 15 - cx0, (P.h - 120) - cy0
by_name = {f["properties"]["shapeName"]: f for f in esp}
regs = {}
for key, names in SPAIN.items():
    regs[key] = [(by_name[n], (tx, ty) if key == "provincial_canarias.md" else None) for n in names]
assigned = {n for names in SPAIN.values() for n in names}
regs[None] = [(f, None) for f in esp if f["properties"]["shapeName"] not in assigned and f["properties"]["shapeName"] not in ("Ceuta", "Melilla")]
cw = P(-13.2, 27.5)[0] + tx + 15
maps["spain"] = build(P, regs, [load(n + "-ADM0") for n in ("PRT", "FRA", "AND", "MAR", "DZA")], 1.6,
                      inset={"x": 5, "y": round(P.h - 130), "w": round(cw), "h": 120})

# ---- Bilad al-Sham (countries; standard geoBoundaries ADM0) ----
P = Proj(33.6, 42.6, 29.0, 37.6)
regs = {"provincial_lebanon.md": [(f, None) for f in load("LBN-ADM0")], "provincial_syria.md": [(f, None) for f in load("SYR-ADM0")],
        "provincial_jordan.md": [(f, None) for f in load("JOR-ADM0")], "provincial_palestine.md": [(f, None) for f in load("PSE-ADM0")]}
maps["sham"] = build(P, regs, [load(n + "-ADM0") for n in ("ISR", "TUR", "IRQ", "EGY", "SAU", "CYP")], 1.2)

# ---- Thailand (provinces grouped into the atlas regions) ----
tha = load("THA-ADM1")
P = Proj(97.2, 106.0, 5.4, 20.6)
def base(n): return n.replace(" Province", "")
regs = {"provincial_lanna.md": [], "provincial_isan.md": [], "provincial_southern_thailand.md": [], "provincial_central_thailand.md": []}
for f in tha:
    n = base(f["properties"]["shapeName"])
    k = "provincial_lanna.md" if n in LANNA else "provincial_isan.md" if n in ISAN else "provincial_southern_thailand.md" if n in SOUTH else "provincial_central_thailand.md"
    regs[k].append((f, None))
maps["thai"] = build(P, regs, [load(n + "-ADM0") for n in ("MMR", "LAO", "KHM", "MYS")], 2.0)

maps["attribution"] = ("Boundaries: geoBoundaries (Runfola et al. 2020, CC BY 4.0) — Spain: INE (Instituto Nacional de Estadística); "
                       "other countries per geoBoundaries source licences (public domain, CC0, CC BY 4.0, ODbL). Simplified.")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f: json.dump(maps, f, separators=(",", ":"))
for k in ("spain", "sham", "thai"):
    m = maps[k]; n = sum(len(v) for v in m["regions"].values())
    print(f"{k}: viewBox {m['viewBox']}, {len(m['regions'])} regions / {n} paths, {len(m['context'])} context paths")
print(f"{OUT}: {os.path.getsize(OUT) // 1024} KB")
