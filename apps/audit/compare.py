#!/usr/bin/env python3
"""Compare two audit runs: python3 compare.py <before/report.json> <after/report.json>"""
import json, sys
b = json.load(open(sys.argv[1])); a = json.load(open(sys.argv[2]))
def idx(d): return {(r['vp'], r['scheme'], r['name']): r for r in d['results'] if not r.get('fatal')}
B, A = idx(b), idx(a)
print(f"{'page':28} {'screens':>15} {'small tgts':>12} {'contrast':>12} {'nodes':>13} {'kb':>13}")
tot = {'cb': 0, 'ca': 0}
def contrast(r): return sum(x['n'] for x in r.get('axe', []) if x['id'] == 'color-contrast')
for k in sorted(set(B) | set(A)):
    if k[1] != 'light': continue
    rb, ra = B.get(k, {}), A.get(k, {})
    cb, ca = contrast(rb), contrast(ra); tot['cb'] += cb; tot['ca'] += ca
    f = lambda r, f: r.get(f, '—')
    print(f"{k[0][:3]+' '+k[2]:28} {str(f(rb,'docHeightScreens'))+' → '+str(f(ra,'docHeightScreens')):>15} {str(f(rb,'smallTargets'))+'→'+str(f(ra,'smallTargets')):>12} {str(cb)+'→'+str(ca):>12} {str(f(rb,'nodes'))+'→'+str(f(ra,'nodes')):>13} {str(f(rb,'kb'))+'→'+str(f(ra,'kb')):>13}")
print(f"\ncolour-contrast failures (light, all pages): {tot['cb']} → {tot['ca']}")
for label, d in (("before", b), ("after", a)):
    other = {}
    for r in d['results']:
        for x in r.get('axe', []):
            if x['id'] != 'color-contrast': other[x['id']] = other.get(x['id'], 0) + x['n']
    errs = sum(len(r.get('consoleErrors', [])) for r in d['results'] if r.get('name') != 'notfound')
    print(f"{label}: other axe violations {other or 0}; console errors (excl. 404 page) {errs}")
print("\njourneys after:")
for j in a['journeys']:
    print(("  OK  " if j.get('ok') else "  FAIL") + " " + json.dumps({k: v for k, v in j.items() if k != 'ok'}, ensure_ascii=False)[:330])
