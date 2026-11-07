#!/usr/bin/env python3
"""Maintain cross-links in the rice atlas.

- Appends/replaces a "## 6. Related Dishes" section in every recipe_*.md,
  based on the dish FAMILIES below.
- Regenerates README.md (region index, directory by region, families, quick
  matrix), keeping the hand-written detailed matrix, glossary and methodology.

Run from anywhere:  python3 tools/atlas.py
Add a new recipe to at least one family; the script lists orphans.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "content"  # content moved to content/ (monorepo)

REGIONS = {  # file -> (label, display order)
    "provincial_valencia.md": ("València", 1),
    "provincial_alicante.md": ("Alicante (incl. La Vega Baja)", 2),
    "provincial_castellon.md": ("Castellón", 3),
    "provincial_murcia.md": ("Región de Murcia", 4),
    "provincial_catalunya.md": ("Catalunya", 5),
    "provincial_baleares.md": ("Illes Balears", 6),
    "provincial_andalucia.md": ("Andalucía", 7),
    "provincial_aragon_navarra_rioja.md": ("Aragón, Navarra & La Rioja", 8),
    "provincial_castilla_la_mancha_extremadura.md": ("Castilla-La Mancha & Extremadura", 9),
    "provincial_castilla_y_leon.md": ("Castilla y León", 10),
    "provincial_madrid.md": ("Madrid", 10),
    "provincial_norte.md": ("Northern Spain (Galicia, Asturias, Cantabria, País Vasco)", 11),
    "provincial_canarias.md": ("Canarias", 12),
}

# family name -> (one-line description, [recipe stems without "recipe_"])
FAMILIES = {
    "Rabbit & snail rices": (
        "Rabbit, mountain snails (serranas/vaquetas) and herbs, mostly seco over a hot wood fire.",
        ["arroz_conejo_y_caracoles", "arroz_conejo_caracoles_murciano", "arroz_con_conejo_y_caracoles_aragones",
         "arroz_con_conejo", "arros_de_renda", "arros_de_batre", "paella_valenciana", "arros_amb_conill_i_cargols_catala"]),
    "Mountain & game rices": (
        "Upland rices built on game, farmyard birds and wild mushrooms.",
        ["arroz_de_montana_castellon", "arros_de_muntanya_catala", "arroz_con_liebre", "arroz_con_perdiz",
         "arroz_con_pitu_de_caleya", "arroz_con_conejo", "arroz_conejo_y_caracoles"]),
    "Duck & wetland rices": (
        "Rices of the great rice marshes: Albufera, Ebro Delta, Guadalquivir.",
        ["arroz_con_pato", "arroz_caldoso_con_pato_marismas", "arros_de_ribera_delta_ebre", "arroz_con_cangrejos_isla_mayor", "arros_al_forn_d_anguiles_i_bajoques"]),
    "The paella family": (
        "Wide shallow pan, thin layer, seco, and the debate over what counts as 'valenciana'.",
        ["paella_valenciana", "paella_de_marisco", "paella_mixta", "paella_de_verduras", "arros_de_la_plana", "fideua", "arroz_a_la_alicantina", "paella_de_costelletes_i_coliflor", "paella_amb_mandonguilles", "paella_a_la_riojana"]),
    "Fishermen's broth rices": (
        "Unsaleable catch boiled into broth; fish often eaten first, rice cooked in what remains.",
        ["arroz_a_banda", "caldero_santa_pola_tabarca", "caldero_del_mar_menor", "arroz_del_senyoret", "arrossejat",
         "arros_de_peix_balear", "arroz_marinero_andaluz", "arros_de_ribera_delta_ebre", "arroz_y_gatet", "fideua"]),
    "Cephalopod & ink rices": (
        "Cuttlefish, squid, choco and octopus, with or without their ink.",
        ["arroz_negro", "arros_negre_catala", "arroz_con_choco", "arroz_meloso_de_pulpo", "arroz_con_sepia_y_alcachofas",
         "arrocito_del_grau", "arroz_con_chipirones_y_ajos_tiernos", "arros_de_sepia_i_coliflor", "chipirones_en_su_tinta_con_arroz"]),
    "Shellfish caldosos & melosos": (
        "Lobster, prawns, mantis shrimp and clams, usually soupy or creamy.",
        ["arroz_caldoso_con_bogavante", "arroz_con_bogavante_norte", "arros_de_llagosta_menorca",
         "arroz_caldoso_langostinos_vinaros", "arroz_con_galeras_y_alcachofas", "arroz_con_almejas",
         "arroz_caldoso_isla_cristina", "arroz_con_borrajas_y_almejas", "arroz_con_cangrejos_isla_mayor", "arroz_con_rape_y_gamba_roja", "arroz_con_mariscos_candamo"]),
    "River & freshwater rices": (
        "Crayfish, eel and lamprey from inland rivers, lagoons and the Miño.",
        ["arroz_con_cangrejos_banezano", "arroz_del_pedron_de_parayo", "lamprea_a_la_bordelesa_con_arroz",
         "arroz_con_cangrejos_isla_mayor", "arros_al_forn_d_anguiles_i_bajoques"]),
    "Cazuela / cassola rices": (
        "Rices cooked and served in an earthenware casserole rather than a paella.",
        ["arros_a_la_cassola", "arros_a_la_cassola_de_pals", "arroz_a_la_sevillana", "arroz_a_la_zaragozana",
         "arrocito_del_grau", "perol_cordobes"]),
    "Baked & crust rices": (
        "Finished in the oven (or under embers): the leftover-cocido logic, sometimes sealed with egg.",
        ["arroz_al_horno", "arroz_con_costra", "arroz_empedrado", "arroz_con_pava", "arros_al_forn_amb_panses_i_cigrons", "arros_al_forn_amb_pesols", "arros_al_forn_d_anguiles_i_bajoques", "arros_al_forn_de_fesols_i_naps"]),
    "Empedrado ('cobbled') rices": (
        "Rice studded with beans like cobblestones; Valencian and Murcian versions differ.",
        ["arroz_empedrado", "arroz_empedrao_murciano"]),
    "Winter pot & matanza rices": (
        "Olla-style pots of legumes, pork and offal with the rice cooked in.",
        ["arroz_con_fesols_i_naps", "olla_de_benicarlo", "arroz_con_pata_de_ternera", "arros_de_matances_eivissa",
         "arros_brut", "arros_amb_fava_pela", "arroz_con_higado_de_toro", "arroz_con_colas_de_cordero", "arros_col_i_fesols", "arroz_y_habichuelas_murciano", "paella_de_costelletes_i_coliflor", "arros_al_forn_de_fesols_i_naps", "arroz_a_la_zamorana", "chanfaina_salmantina", "txuritabeltz", "arroz_clarico"]),
    "Lent & vigil rices": (
        "Meatless rices of Cuaresma and fast days: legumes, greens and salt cod.",
        ["arroz_de_los_tres_punaos", "arroz_con_acelgas", "arroz_empedrado", "arroz_empedrao_murciano",
         "arroz_con_bacalao_y_coliflor", "arroz_de_ayuno_calasparra", "arroz_con_bacalao_de_vigilia", "cardillos_con_arroz", "arroz_de_boquerones_y_espinacas", "arroz_y_habichuelas_murciano", "arroz_con_boquerones_y_pava_murciano", "arroz_y_verduras_con_bacalao_murciano", "arros_al_forn_amb_panses_i_cigrons", "paella_de_ceba_i_bacalla", "potaje_banezano"]),
    "Huerta & artichoke rices": (
        "Irrigated-garden vegetables: artichoke, broad beans, chard and peppers lead the dish.",
        ["arroz_de_verduras_vega_baja", "paella_de_verduras", "arroz_con_alcachofas_benicarlo",
         "arroz_con_galeras_y_alcachofas", "arroz_con_sepia_y_alcachofas", "arroz_con_costillejas_y_verduras_murcia",
         "arros_de_la_plana", "arroz_con_acelgas", "arroz_campero_andaluz", "arroz_de_boquerones_y_espinacas", "arroz_con_boquerones_y_pava_murciano", "arroz_y_pollo_con_alcaciles", "arroz_y_verduras_con_bacalao_murciano", "arros_de_les_riberes_del_turia"]),
    "Festive poultry rices": (
        "Turkey, duck and free-range cockerel for holidays.",
        ["arroz_con_pava", "arroz_con_pitu_de_caleya", "arroz_con_pato", "arros_de_les_riberes_del_turia"]),
    "Sweet rices": (
        "Desserts: rice cooked in milk or honey.",
        ["arroz_con_leche", "arroz_con_miel_bogarra", "escudella_d_angel"]),
    "Home-style & country rices": (
        "Everyday and cortijo rices of the Canaries and Andalusia: rice 'con cosas', whatever the house had.",
        ["arroz_amarillo_canario", "arroz_a_la_cubana_canario", "arroz_a_la_sevillana", "arroz_campero_andaluz",
         "arroz_cortijero_jaen", "perol_cordobes", "arroz_a_la_asturiana"]),
}

REL_HEADING = "## 6. Related Dishes"


def parse(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    h1 = lines[0][2:].strip() if lines and lines[0].startswith("# ") else path.stem
    nav = next((l for l in lines if l.startswith("> ⬅")), "")
    regions = [r for r in re.findall(r"\((provincial_[a-z_]+\.md)\)", nav) if r in REGIONS]
    m = re.search(r"Liquid & Texture Profile:\*\*\s*\*\*(Seco|Meloso|Caldoso)", text)
    return {
        "file": path.name, "stem": path.stem[len("recipe_"):], "h1": h1, "regions": regions,
        "texture": m.group(1) if m else "?",
        "flag": "Source-confidence" in text or "source-confidence" in text,
        "text": text,
    }


def short(h1: str) -> str:
    return h1.split(" / ")[0].strip()


def region_label(r: dict) -> str:
    return REGIONS[r["regions"][0]][0].split(" (")[0] if r["regions"] else "—"


def main() -> int:
    recipes = {p.stem[len("recipe_"):]: parse(p) for p in sorted(ROOT.glob("recipe_*.md"))}

    missing = [s for _, (_, ss) in FAMILIES.items() for s in ss if s not in recipes]
    if missing:
        print("Unknown stems in FAMILIES:", sorted(set(missing)), file=sys.stderr)
        return 1
    fam_of = {s: [f for f, (_, ss) in FAMILIES.items() if s in ss] for s in recipes}
    orphans = [s for s, fs in fam_of.items() if not fs]

    # 1. Related Dishes section in each recipe
    for stem, r in recipes.items():
        body = r["text"].split("\n" + REL_HEADING)[0].rstrip() + "\n"
        out = ["", REL_HEADING]
        if not fam_of[stem]:
            continue
        for fam in fam_of[stem]:
            desc, members = FAMILIES[fam]
            others = [recipes[m] for m in members if m != stem]
            if not others:
                continue
            out += ["", f"**{fam}:** {desc}", ""]
            for o in others:
                out.append(f"*   [{short(o['h1'])}]({o['file']}): {region_label(o)} · {o['texture']}")
        new = body + "\n".join(out) + "\n"
        if new != r["text"]:
            (ROOT / r["file"]).write_text(new, encoding="utf-8")

    # 2. README
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    def section(title_prefix: str) -> str:
        m = re.search(rf"^## \d+\. {re.escape(title_prefix)}.*?(?=^## |\Z)", readme, re.S | re.M)
        return m.group(0).split("\n", 1)[1].strip() if m else ""

    detailed = (section("Master Comparison Matrix") or section("Detailed Comparison Matrix")).split("### Texture summary")[0].strip()
    glossary = section("Shared Technique Glossary")
    method = section("Methodology")

    by_region: dict[str, list] = {}
    for r in recipes.values():
        key = r["regions"][0] if r["regions"] else "—"
        by_region.setdefault(key, []).append(r)

    n = len(recipes)
    tex = {t: sum(1 for r in recipes.values() if r["texture"] == t) for t in ("Seco", "Meloso", "Caldoso")}
    L = [
        "# Arrossos d'Espanya: A Field Atlas of Spanish Rice",
        "",
        "A granular, multilingual (Castellano / Valencià / Català / English) atlas of Spain's rice traditions. "
        "It is rooted in the **Valencian Community** (València, Alacant/Alicante, Castelló/Castellón) and extends to "
        f"every other rice-cooking region of Spain. **{n} recipes** document **town-by-town variations** wherever "
        "the sources support them, plus forgotten and endangered village rices. For the long story see "
        "[A History of Rice in Spain](history.md).",
        "",
        "## 1. How to Use This Atlas",
        "*   **Region pages** describe cultural sub-regions and link to their recipes.",
        "*   **Recipe files** follow a fixed layout: Geographic & Texture Profile → Historical & Cultural Context → "
        "Town-by-Town Variations → 4-Person Master Recipe → Authority Links → **Related Dishes** (cousins in other "
        "towns and regions, grouped by dish family).",
        "*   **Nomenclature:** each dish carries its Spanish and local names (*Arroz* / *Arròs*, *Paella*, *Caldero*).",
        "*   **⚠️ Confidence flags:** poorly documented dishes carry an explicit note; reconstructed variations are "
        "labelled as such. Verify them locally before citing them as canonical.",
        "*   **Quantities** are for 4 people. Liquid ratios depend on the variety: Bomba absorbs ~15–20 % more than "
        "Senia/Bahía.",
        "",
        "## 2. Region Index",
        "| Region | Recipes |",
        "|---|---|",
    ]
    for f, (label, _) in sorted(REGIONS.items(), key=lambda kv: kv[1][1]):
        if (ROOT / f).exists():
            L.append(f"| [{label}]({f}) | {sum(1 for r in recipes.values() if f in r['regions'])} |")
    L += ["", "## 3. Master Directory of Recipes"]
    for f, (label, _) in sorted(REGIONS.items(), key=lambda kv: kv[1][1]):
        rs = by_region.get(f)
        if not rs:
            continue
        L += ["", f"### {label}"]
        for r in sorted(rs, key=lambda r: short(r["h1"]).lower()):
            L.append(f"*   [{r['h1']}]({r['file']}){' ⚠️' if r['flag'] else ''} · {r['texture']}")
    L += ["", "## 4. Dish Families (cross-regional cousins)",
          "The same idea is cooked differently from town to town and region to region. Each recipe's "
          "**Related Dishes** section links its cousins.", ""]
    for fam, (desc, members) in FAMILIES.items():
        links = ", ".join(f"[{short(recipes[m]['h1'])}]({recipes[m]['file']})" for m in members)
        L.append(f"*   **{fam}:** {desc} {links}")
    L += ["", "## 5. Quick Matrix (all recipes)",
          f"Texture totals: **Seco {tex['Seco']}** · **Meloso {tex['Meloso']}** · **Caldoso {tex['Caldoso']}**.",
          "", "| Dish | Region | Texture | Families | ⚠️ |", "|---|---|---|---|---|"]
    for r in sorted(recipes.values(), key=lambda r: (REGIONS.get(r["regions"][0], ("", 99))[1] if r["regions"] else 99,
                                                     short(r["h1"]).lower())):
        L.append(f"| [{short(r['h1'])}]({r['file']}) | {region_label(r)} | {r['texture']} | "
                 f"{'; '.join(fam_of[r['stem']])} | {'⚠️' if r['flag'] else ''} |")
    if detailed:
        L += ["", "## 6. Detailed Comparison Matrix: Valencian Community Core", detailed]
    if glossary:
        L += ["", "## 7. Shared Technique Glossary", glossary]
    if method:
        L += ["", "## 8. Methodology & Limitations", method]
    (ROOT / "README.md").write_text("\n".join(L).rstrip() + "\n", encoding="utf-8")

    print(f"{n} recipes, {len(FAMILIES)} families; orphans: {orphans or 'none'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
