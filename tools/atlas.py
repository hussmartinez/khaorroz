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

REGIONS = {  # file -> (English label, no accents, display order)
    "provincial_valencia.md": ("Valencia", 1),
    "provincial_alicante.md": ("Alicante (incl. La Vega Baja)", 2),
    "provincial_castellon.md": ("Castellon", 3),
    "provincial_murcia.md": ("Murcia", 4),
    "provincial_catalunya.md": ("Catalonia", 5),
    "provincial_baleares.md": ("Balearic Islands", 6),
    "provincial_andalucia.md": ("Andalusia", 7),
    "provincial_aragon_navarra_rioja.md": ("Aragon, Navarre & La Rioja", 8),
    "provincial_castilla_la_mancha_extremadura.md": ("Castilla-La Mancha & Extremadura", 9),
    "provincial_castilla_y_leon.md": ("Castile and Leon", 10),
    "provincial_madrid.md": ("Madrid", 11),
    "provincial_norte.md": ("Northern Spain (Galicia, Asturias, Cantabria, Basque Country)", 12),
    "provincial_canarias.md": ("Canary Islands", 13),
    "provincial_palestine.md": ("Palestine", 20),
    "provincial_lebanon.md": ("Lebanon", 21),
    "provincial_jordan.md": ("Jordan", 22),
    "provincial_syria.md": ("Syria", 23),
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
         "arros_de_peix_balear", "arroz_marinero_andaluz", "arros_de_ribera_delta_ebre", "arroz_y_gatet", "fideua", "sayadieh", "hbari_u_ruz"]),
    "Cephalopod & ink rices": (
        "Cuttlefish, squid, choco and octopus, with or without their ink.",
        ["arroz_negro", "arros_negre_catala", "arroz_con_choco", "arroz_meloso_de_pulpo", "arroz_con_sepia_y_alcachofas",
         "arrocito_del_grau", "arroz_con_chipirones_y_ajos_tiernos", "arros_de_sepia_i_coliflor", "chipirones_en_su_tinta_con_arroz", "hbari_u_ruz"]),
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
        ["arroz_al_horno", "arroz_con_costra", "arroz_empedrado", "arroz_con_pava", "arros_al_forn_amb_panses_i_cigrons", "arros_al_forn_amb_pesols", "arros_al_forn_d_anguiles_i_bajoques", "arros_al_forn_de_fesols_i_naps", "qidreh", "ouzi", "maqluba", "rabiya"]),
    "Empedrado ('cobbled') rices": (
        "Rice studded with beans like cobblestones; Valencian and Murcian versions differ.",
        ["arroz_empedrado", "arroz_empedrao_murciano"]),
    "Winter pot & matanza rices": (
        "Olla-style pots of legumes, pork and offal with the rice cooked in.",
        ["arroz_con_fesols_i_naps", "olla_de_benicarlo", "arroz_con_pata_de_ternera", "arros_de_matances_eivissa",
         "arros_brut", "arros_amb_fava_pela", "arroz_con_higado_de_toro", "arroz_con_colas_de_cordero", "arros_col_i_fesols", "arroz_y_habichuelas_murciano", "paella_de_costelletes_i_coliflor", "arros_al_forn_de_fesols_i_naps", "arroz_a_la_zamorana", "chanfaina_salmantina", "txuritabeltz", "arroz_clarico", "fasoulia_w_riz", "ghammeh", "fawaregh"]),
    "Lent & vigil rices": (
        "Meatless rices of Cuaresma and fast days: legumes, greens and salt cod.",
        ["arroz_de_los_tres_punaos", "arroz_con_acelgas", "arroz_empedrado", "arroz_empedrao_murciano",
         "arroz_con_bacalao_y_coliflor", "arroz_de_ayuno_calasparra", "arroz_con_bacalao_de_vigilia", "cardillos_con_arroz", "arroz_de_boquerones_y_espinacas", "arroz_y_habichuelas_murciano", "arroz_con_boquerones_y_pava_murciano", "arroz_y_verduras_con_bacalao_murciano", "arros_al_forn_amb_panses_i_cigrons", "paella_de_ceba_i_bacalla", "potaje_banezano", "mujaddara", "warak_enab", "yalanji", "mehshi_selek", "musluaa"]),
    "Huerta & artichoke rices": (
        "Irrigated-garden vegetables: artichoke, broad beans, chard and peppers lead the dish.",
        ["arroz_de_verduras_vega_baja", "paella_de_verduras", "arroz_con_alcachofas_benicarlo",
         "arroz_con_galeras_y_alcachofas", "arroz_con_sepia_y_alcachofas", "arroz_con_costillejas_y_verduras_murcia",
         "arros_de_la_plana", "arroz_con_acelgas", "arroz_campero_andaluz", "arroz_de_boquerones_y_espinacas", "arroz_con_boquerones_y_pava_murciano", "arroz_y_pollo_con_alcaciles", "arroz_y_verduras_con_bacalao_murciano", "arros_de_les_riberes_del_turia"]),
    "Festive poultry rices": (
        "Turkey, duck and free-range cockerel for holidays.",
        ["arroz_con_pava", "arroz_con_pitu_de_caleya", "arroz_con_pato", "arros_de_les_riberes_del_turia", "riz_a_djej", "ruz_bi_djaj_hashweh", "maqluba"]),
    "Sweet rices": (
        "Desserts: rice cooked in milk or honey.",
        ["arroz_con_leche", "arroz_con_miel_bogarra", "escudella_d_angel", "riz_bi_haleeb", "muhallabiyeh", "meghli", "mufattaka", "aruzz_khatuni", "muhallabiyya_medieval", "khao_niao_mamuang", "khao_tom_mat", "khao_niao_sangkhaya", "khao_mak", "bua_loy", "khanom_krok", "khanom_chan", "khao_mathu_payat", "khao_lam"]),
    "Home-style & country rices": (
        "Everyday and cortijo rices of the Canaries and Andalusia: rice 'con cosas', whatever the house had.",
        ["arroz_amarillo_canario", "arroz_a_la_cubana_canario", "arroz_a_la_sevillana", "arroz_campero_andaluz",
         "arroz_cortijero_jaen", "perol_cordobes", "arroz_a_la_asturiana", "riz_bi_foul", "riz_bi_shariyyeh", "ships_w_pasta", "galayet_bandora_bi_ruz", "mlukhiyeh_ma_ruz", "bamyeh_ma_ruz", "bazella_w_ruz", "kibbeh_hamda", "sabanekh_w_riz", "daoud_basha", "mayit_bandora_u_bayd"]),
    "Rice & legumes": (
        "Rice cooked with lentils, beans or fava: the poor-and-sustaining pot from Orihuela to Beirut.",
        ["mujaddara", "arroz_de_los_tres_punaos", "arroz_y_habichuelas_murciano", "potaje_banezano", "arros_amb_fava_pela",
         "riz_bi_foul", "arros_col_i_fesols", "arroz_con_fesols_i_naps", "musluaa", "shurba_al_baghdadi", "mujaddara_medieval"]),
    "Stuffed vegetables & leaves": (
        "Rice used as a filling: vine leaves, zucchini and eggplant simmered in broth.",
        ["mahshi", "mahshi_halabi", "warak_enab", "yalanji", "sheikh_al_mahshi", "mehshi_basal", "yebra", "malfouf_mehshi", "mehshi_selek", "ghammeh", "fawaregh", "mahshi_lift", "lakhneh", "kousa_bi_laban"]),
    "Lamb feast rices": (
        "Celebration platters of lamb over rice: yogurt sauces, sealed pots, pit ovens and pastry domes.",
        ["mansaf", "zarb", "qidreh", "shakriyeh", "ouzi", "sheikh_al_mahshi", "kibbeh_labanieh", "fate_chilena", "fatteh_ghazawiyya", "ruz_w_lahm_al_urs", "aruzz_mufalfal_wusla", "harisat_al_aruzz", "kharuf_mahshi_halabi"]),
    "Rice with noodles": (
        "Rice and toasted vermicelli or noodles cooked together, and the noodle 'paellas'.",
        ["riz_bi_shariyyeh", "shakriyeh", "fasoulia_w_riz", "fideua", "arrossejat", "bamyeh_ma_ruz", "bazella_w_ruz", "arroz_arabe_chileno", "pilav_ottoman_aleppo"]),

    "Fried rices": (
        "Cooked rice tossed in a hot wok or pan.",
        ["khao_phat", "khao_phat_amerikan", "khao_kluk_kapi"]),
    "Rice soups & porridges": (
        "Rice in broth, from Thai khao tom and jok to medieval shurba and Aleppine kibbeh hamda.",
        ["khao_tom", "jok", "shurba_al_baghdadi", "kibbeh_hamda"]),
    "Chicken rices": (
        "Rice built around chicken: Hainanese-Thai khao man kai, Thai-Muslim khao mok, Levantine riz a djej.",
        ["khao_man_kai", "khao_mok_kai", "riz_a_djej", "ruz_bi_djaj_hashweh", "muhallabiyya_medieval"]),
    "Court & royal rices": (
        "Refined palace rices: Siamese khao chae and khao tang, Ayyubid aruzz khatuni, Ottoman Aleppo's stuffed lamb.",
        ["khao_chae", "khao_tang_na_tang", "aruzz_khatuni", "kharuf_mahshi_halabi", "pilav_ottoman_aleppo"]),
    "Rice-and-topping plates": (
        "One plate of rice with something ladled or laid over it.",
        ["khao_kha_mu", "khao_mu_daeng", "khao_rad_kaeng", "arroz_a_la_cubana_canario", "galayet_bandora_bi_ruz", "nasi_dagae"]),

    "Sticky rices": (
        "Glutinous rice: steamed in the huad, roasted in bamboo, grilled, pounded and sweetened.",
        ["khao_niao_nueng", "khao_jee", "khao_puk_nga", "khao_lam", "khao_niao_mamuang", "khao_tom_mat", "khao_niao_sangkhaya", "khao_pradap_din", "khao_tom_luk_yon"]),
    "Leaf & bamboo-wrapped rices": (
        "Rice cooked or carried in leaves and bamboo: Thai parcels and tubes, Levantine stuffed leaves.",
        ["khao_lam", "khao_kan_chin", "khao_tom_mat", "khao_tom_luk_yon", "khao_pradap_din", "warak_enab", "yalanji"]),
    "Ritual & festival rices": (
        "Rices made for gods, ancestors, monks, births and weddings.",
        ["khao_tom_luk_yon", "khanom_la", "khao_mathu_payat", "khao_pradap_din", "khao_jee", "meghli", "mufattaka", "ruz_w_lahm_al_urs"]),
    "Rice crackers & rice-flour sweets": (
        "Rice turned into crisp sheets, lace, pancakes and layered sweets.",
        ["khao_pong", "khao_taen", "khao_phan_phak", "khao_tang_na_tang", "khanom_krok", "khanom_chan", "khanom_la", "bua_loy"]),
    "Tossed & salad rices": (
        "Cooked rice tossed with pastes, herbs, fish sauce or tomato.",
        ["khao_yam", "khao_kluk_kapi", "khao_som_tai_yai"]),
    "Rice as ingredient": (
        "Rice toasted, pounded or ground to season, thicken or bind other dishes.",
        ["khao_kua", "khao_buea", "kibbeh_hamda", "kibbeh_labanieh"]),

}


# Family names/descriptions per language for the site's "Related dishes" (rendered from content/families.json).
FAMILY_I18N = {  # name: {lang: (name, description)}; English description comes from FAMILIES
    "Rabbit & snail rices": {"es": "Arroces de conejo y caracoles", "ca": "Arrossos de conill i caragols", "th": "ข้าวกระต่ายและหอยทาก", "ar": "أرز الأرانب والحلزون"},
    "Mountain & game rices": {"es": "Arroces de montaña y caza", "ca": "Arrossos de muntanya i caça", "th": "ข้าวภูเขาและเนื้อสัตว์ป่า", "ar": "أرز الجبال والصيد"},
    "Duck & wetland rices": {"es": "Arroces de pato y marjal", "ca": "Arrossos d'ànec i marjal", "th": "ข้าวเป็ดและที่ลุ่มน้ำ", "ar": "أرز البط والأهوار"},
    "The paella family": {"es": "La familia de la paella", "ca": "La família de la paella", "th": "ตระกูลปาเอยา", "ar": "عائلة الباييا"},
    "Fishermen's broth rices": {"es": "Arroces marineros de caldo", "ca": "Arrossos mariners de caldo", "th": "ข้าวน้ำซุปของชาวประมง", "ar": "أرز الصيادين بالمرق"},
    "Cephalopod & ink rices": {"es": "Arroces de sepia, calamar y tinta", "ca": "Arrossos de sèpia, calamar i tinta", "th": "ข้าวปลาหมึกและหมึกดำ", "ar": "أرز الحبار والحبر"},
    "Shellfish caldosos & melosos": {"es": "Arroces caldosos y melosos de marisco", "ca": "Arrossos caldosos i melosos de marisc", "th": "ข้าวอาหารทะเลแบบน้ำและแบบครีม", "ar": "أرز المحار بالمرق والقوام الكريمي"},
    "River & freshwater rices": {"es": "Arroces de río y agua dulce", "ca": "Arrossos de riu i aigua dolça", "th": "ข้าวปลาน้ำจืดและแม่น้ำ", "ar": "أرز الأنهار والمياه العذبة"},
    "Cazuela / cassola rices": {"es": "Arroces de cazuela", "ca": "Arrossos de cassola", "th": "ข้าวหม้อดิน", "ar": "أرز الطاجن الفخاري"},
    "Baked & crust rices": {"es": "Arroces al horno y con costra", "ca": "Arrossos al forn i amb crosta", "th": "ข้าวอบและข้าวหน้ากรอบ", "ar": "الأرز المخبوز في الفرن"},
    "Empedrado ('cobbled') rices": {"es": "Arroces empedrados", "ca": "Arrossos empedrats", "th": "ข้าว 'เอมเปดราโด'", "ar": "الأرز «المرصوف» بالبقول"},
    "Winter pot & matanza rices": {"es": "Arroces de olla y matanza", "ca": "Arrossos d'olla i matança", "th": "ข้าวหม้อฤดูหนาวและเทศกาลล้มหมู", "ar": "أرز القدور الشتوية"},
    "Lent & vigil rices": {"es": "Arroces de Cuaresma y vigilia", "ca": "Arrossos de Quaresma i vigília", "th": "ข้าวช่วงถือศีลและงดเนื้อ", "ar": "أرز الصيام بلا لحم"},
    "Huerta & artichoke rices": {"es": "Arroces de huerta y alcachofa", "ca": "Arrossos d'horta i carxofa", "th": "ข้าวผักสวนและอาร์ติโชก", "ar": "أرز الخضار والخرشوف"},
    "Festive poultry rices": {"es": "Arroces festivos de ave", "ca": "Arrossos festius d'aviram", "th": "ข้าวสัตว์ปีกสำหรับงานเลี้ยง", "ar": "أرز الدواجن للمناسبات"},
    "Sweet rices": {"es": "Arroces dulces", "ca": "Arrossos dolços", "th": "ข้าวหวาน", "ar": "الأرز الحلو"},
    "Home-style & country rices": {"es": "Arroces caseros y de campo", "ca": "Arrossos casolans i de camp", "th": "ข้าวบ้านและข้าวชนบท", "ar": "أرز البيوت والأرياف"},
    "Rice & legumes": {"es": "Arroces con legumbres", "ca": "Arrossos amb llegums", "th": "ข้าวกับถั่ว", "ar": "الأرز مع البقول"},
    "Stuffed vegetables & leaves": {"es": "Verduras y hojas rellenas de arroz", "ca": "Verdures i fulles farcides d'arròs", "th": "ผักและใบไม้ยัดไส้ข้าว", "ar": "المحاشي وورق العنب"},
    "Lamb feast rices": {"es": "Arroces de banquete con cordero", "ca": "Arrossos de banquet amb xai", "th": "ข้าวงานเลี้ยงกับเนื้อแกะ", "ar": "أرز الولائم باللحم"},
    "Fried rices": {"es": "Arroces fritos", "ca": "Arrossos fregits", "th": "ข้าวผัด", "ar": "الأرز المقلي"},
    "Rice soups & porridges": {"es": "Sopas y gachas de arroz", "ca": "Sopes i farinetes d'arròs", "th": "ข้าวต้มและโจ๊ก", "ar": "شوربات وعصائد الأرز"},
    "Chicken rices": {"es": "Arroces con pollo", "ca": "Arrossos amb pollastre", "th": "ข้าวกับไก่", "ar": "أرز بالدجاج"},
    "Court & royal rices": {"es": "Arroces de corte y reales", "ca": "Arrossos de cort i reials", "th": "ข้าวราชสำนัก", "ar": "أرز البلاط الملكي"},
    "Rice-and-topping plates": {"es": "Platos de arroz con cobertura", "ca": "Plats d'arròs amb cobertura", "th": "ข้าวราดหน้า", "ar": "أطباق الأرز مع الإضافات"},
    "Sticky rices": {"es": "Arroces glutinosos", "ca": "Arrossos glutinosos", "th": "ข้าวเหนียว", "ar": "الأرز الدبق"},
    "Leaf & bamboo-wrapped rices": {"es": "Arroces en hoja y bambú", "ca": "Arrossos en fulla i bambú", "th": "ข้าวห่อใบไม้และกระบอกไม้ไผ่", "ar": "أرز ملفوف بالأوراق والخيزران"},
    "Ritual & festival rices": {"es": "Arroces rituales y de fiesta", "ca": "Arrossos rituals i de festa", "th": "ข้าวในพิธีกรรมและงานประเพณี", "ar": "أرز الطقوس والمواسم"},
    "Rice crackers & rice-flour sweets": {"es": "Galletas y dulces de harina de arroz", "ca": "Galetes i dolços de farina d'arròs", "th": "ข้าวเกรียบและขนมแป้งข้าว", "ar": "مقرمشات وحلويات طحين الأرز"},
    "Tossed & salad rices": {"es": "Arroces mezclados y en ensalada", "ca": "Arrossos barrejats i en amanida", "th": "ข้าวคลุกและข้าวยำ", "ar": "الأرز المخلوط والسلطات"},
    "Rice as ingredient": {"es": "El arroz como ingrediente", "ca": "L'arròs com a ingredient", "th": "ข้าวในฐานะวัตถุดิบ", "ar": "الأرز كمكوّن"},
    "Rice with noodles": {"es": "Arroces con fideos", "ca": "Arrossos amb fideus", "th": "ข้าวกับเส้น", "ar": "الأرز بالشعيرية"},
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

    # 1a. Machine-readable families for the site (renders a localised "Related dishes" block)
    import json
    missing_i18n = [f for f in FAMILIES if f not in FAMILY_I18N]
    if missing_i18n:
        print("FAMILY_I18N missing:", missing_i18n, file=sys.stderr)
        return 1
    fams = []
    for fam, (desc, members) in FAMILIES.items():
        name = {"en": fam, **{l: v for l, v in FAMILY_I18N[fam].items()}}
        fams.append({"id": re.sub(r"[^a-z0-9]+", "-", fam.lower()).strip("-"), "name": name,
                     "description": {"en": desc}, "members": [recipes[m]["file"] for m in dict.fromkeys(members)]})
    (ROOT / "families.json").write_text(json.dumps(
        {"_comment": "Generated by tools/atlas.py from FAMILIES. Dish families used for cross-region 'Related dishes'.",
         "families": fams}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    # 1b. Legacy: "## 6. Related Dishes" baked into each English recipe (opt-in; editing sources marks translations stale)
    for stem, r in (recipes.items() if "--markdown" in sys.argv else []):
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
