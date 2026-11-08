// Generative top-down "pan portraits": every dish gets an original SVG illustration derived from
// its recipe — the vessel it is cooked in, the colour of its rice, and the ingredients on top.
// Deterministic per slug, so a dish always looks the same.

export type Vessel = "paella" | "cassola" | "caldero" | "olla" | "tray" | "tanjara" | "kratip" | "plate" | "bowl" | "claypot" | "banana";
export type Base = "seco" | "banda" | "negro" | "meloso" | "caldoso" | "caldoso-negro" | "horno" | "costra" | "leche" | "white" | "vermicelli" | "maqluba" | "mujaddara" | "yellow" | "jasmine" | "sticky" | "friedrice" | "porridge" | "khaoyam" | "khaochae";

export interface PanSpec {
  vessel: Vessel;
  base: Base;
  items: { kind: Glyph; n: number }[];
  center?: Glyph; // e.g. a garlic head in the middle of arròs al forn
}

type Glyph =
  | "prawn" | "galera" | "lobster" | "mussel" | "clam" | "ring" | "sepia" | "fish" | "artichoke" | "bean"
  | "garrofo" | "chickpea" | "potato" | "garlic" | "tomato" | "morcilla" | "chorizo" | "meat" | "snail"
  | "pinenut" | "almond" | "eggplant" | "parsley" | "onion"
  | "chili" | "basil" | "lime" | "cucumber" | "mango" | "peanut" | "ice" | "jasmineflower"
  | "egg" | "lemon" | "rosemary" | "pepper" | "chard" | "turnip" | "cauli" | "mushroom" | "pea" | "fava" | "cinnamon" | "peel";

// ---------- deterministic randomness ----------
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = (n: number) => Math.round(n * 10) / 10;

// ---------- recipe → spec ----------
const RULES: [Glyph, RegExp, number][] = [
  // glyph, ingredient-table pattern, how many to scatter
  ["lobster", /lobster|bogavante|llamànt?ol/, 2],
  ["galera", /galera|mantis/, 4],
  ["prawn", /prawn|shrimp|langostin|llagost|gamba|carabiner/, 5],
  ["mussel", /mussel|mejill|musclo/, 6],
  ["clam", /\bclams?\b|almeja|tellina|cockle|berberecho/, 6],
  ["ring", /\bsquid\b|calamar|pota\b|octopus|pulpo/, 6],
  ["sepia", /cuttlefish|sepia|\bchoco\b/, 5],
  ["fish", /monkfish|rape\b|grouper|mero|\bcod\b|bacalao|bacallà|hake|merluza|conger|fish fillet|scorpion|gallineta/, 4],
  ["snail", /snail|caracol|caragol|vaquet|serran/, 7],
  ["meat", /chicken|rabbit|\bpork\b|\bribs?\b|costill|duck|\bpato\b|turkey|\bpava?\b|partridge|perdiz|\bhare\b|liebre|\bliver\b|hígado|\bbeef\b|\bcalf|ternera|\blamb\b|cordero|chicken|pollo|conejo|magro|panceta|bacon|tocino/, 6],
  ["morcilla", /morcilla|blood sausage|botifarra|butifarra|blanquet/, 4],
  ["chorizo", /chorizo|longaniza|sobrasada|salchich/, 4],
  ["artichoke", /artichoke|alcachofa|carxofa/, 5],
  ["bean", /green bean|bajoqueta|ferraura|judía verde|runner bean|flat bean/, 7],
  ["garrofo", /garrof|lima bean|butter bean|white bean|\bfesols?\b|alubia|judión|haricot|navy bean/, 8],
  ["fava", /broad bean|\bfava|\bhabas?\b/, 7],
  ["pea", /\bpeas\b|guisante|pèsol/, 10],
  ["chickpea", /chickpea|garbanzo|cigró|cigron/, 12],
  ["potato", /potato|patata|creïlla/, 4],
  ["turnip", /turnip|\bnabos?\b|\bnaps?\b/, 4],
  ["cauli", /cauliflower|coliflor|colflori/, 4],
  ["chard", /\bchard\b|acelga|bledes|spinach|espinac/, 5],
  ["mushroom", /mushroom|\bsetas?\b|bolets?|níscal|rovell|chanterelle|boletus/, 5],
  ["pepper", /red pepper|bell pepper|pimiento rojo|pimiento morr|roasted pepper|pebrot|piquillo/, 5],
  ["tomato", /tomato(es)?,? halved|halved tomato|tomato halves|whole tomato/, 3],
  ["eggplant", /aubergine|eggplant|batinjan|bādhinjān|berenjena/, 5],
  ["pinenut", /pine nut|pine kernel|snobar|piñon|piñón|pinyon/, 14],
  ["almond", /almond|lawz|almendra|ametlla/, 9],
  ["onion", /crisp(y)? onion|fried onion|caramelis(ed|ized) onion|birista/, 9],
  ["parsley", /chopped parsley|parsley (to|for) garnish|garnish.*parsley/, 8],
  ["chili", /bird'?s?[- ]eye chil|prik|thai chil|chilli|chili/, 6],
  ["basil", /thai basil|holy basil|bai horapha|bai kaprao|kaphrao|basil leaves/, 7],
  ["lime", /\blime\b|manao/, 2],
  ["cucumber", /cucumber|taeng kwa/, 4],
  ["mango", /\bmango\b|mamuang/, 1],
  ["peanut", /peanut|thua lisong/, 10],
  ["egg", /fried egg|huevo frito|ou ferrat|ous ferrats/, 2],
  ["lemon", /lemon|limón|llima/, 2],
  ["rosemary", /rosemary|romero|romer\b/, 1],
];

export function specFrom(opts: { slug: string; title: string; texture: string; vessel: string; recipeText: string; area?: string }): PanSpec {
  const { title, texture } = opts;
  if (opts.area === "sham") return levantSpec(opts);
  if (opts.area === "thai") return thaiSpec(opts);
  const t = opts.recipeText.toLowerCase();
  const name = title.toLowerCase();
  const v = opts.vessel.toLowerCase();

  // Vessel: the first vessel word mentioned in the "Traditional Cooking Vessel" line wins.
  const hits: [Vessel, number][] = [
    ["caldero", v.search(/caldero|caldera|cauldron|iron pot/)],
    ["olla", v.search(/\bolla\b|\bpot\b|puchero/)],
    ["cassola", v.search(/cassola|cazuela|perol|barro|fang|earthenware|clay/)],
    ["paella", v.search(/paella/)],
  ];
  const found = hits.filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
  let vessel: Vessel = found[0]?.[0] ?? (texture === "caldoso" ? "olla" : texture === "meloso" ? "cassola" : "paella");
  if (texture === "seco" && vessel === "olla") vessel = "cassola";

  const ink = /negr|black|tinta|\bink\b/.test(name) || /\b(squid|cuttlefish|sepia) ink\b|tinta de/.test(t);
  const dessert = /con leche|amb llet|\bmilk\b.*\bsugar\b|\bsugar\b.*\bmilk\b/.test(name + " " + t) && /cinnamon|canela|canyella/.test(t);
  let base: Base =
    dessert ? "leche"
    : /costra|crosta/.test(name) ? "costra"
    : /horno|forn|oven/.test(name) ? "horno"
    : ink ? (texture === "caldoso" ? "caldoso-negro" : "negro")
    : texture === "caldoso" ? "caldoso"
    : texture === "meloso" ? "meloso"
    : /banda|senyoret|señorito|ñora|salmorreta/.test(name) ? "banda"
    : "seco";

  const items: PanSpec["items"] = [];
  let center: Glyph | undefined;
  if (dessert) {
    items.push({ kind: "cinnamon", n: 1 }, { kind: "peel", n: 2 });
    return { vessel: "cassola", base, items };
  }
  for (const [g, re, n] of RULES) if (re.test(t)) items.push({ kind: g, n });
  if (/cubana/.test(name) && !items.some((i) => i.kind === "egg")) items.unshift({ kind: "egg", n: 2 });
  // Avoid duplicate seafood families crowding each other
  if (items.some((i) => i.kind === "lobster")) for (const i of items) if (i.kind === "prawn") i.n = 3;
  if (base === "horno" && /head of garlic|whole (garlic )?head|cabeza de ajo|cap d'alls|garlic head/.test(t)) center = "garlic";
  if (base === "horno" && !items.some((i) => i.kind === "tomato") && /tomato/.test(t)) items.push({ kind: "tomato", n: 3 });
  // Arroz a banda / senyoret: mostly plain rice with only a few peeled pieces on top
  if (base === "banda") for (const i of items) i.n = Math.min(i.n, 3);
  if (base === "costra") for (const i of items) i.n = Math.min(i.n, 2); // egg crust hides most things
  return { vessel, base, items, center };
}

// Bilad al-Sham: white rice by default, trays and copper pots, nuts and crisp onions on top.
function levantSpec(opts: { title: string; texture: string; vessel: string; recipeText: string }): PanSpec {
  const t = opts.recipeText.toLowerCase();
  const name = opts.title.toLowerCase();
  const v = opts.vessel.toLowerCase();
  const all = name + " " + t;
  const base: Base =
    /maqlub|maqloub|makloub|مقلوب/.test(all) ? "maqluba"
    : /mujadd|mjadd|mudardar|مجدر|مدردر/.test(all) || /\blentil/.test(t) ? "mujaddara"
    : /vermicelli|sha'?riyy?e|sha'?ariyy?a|شعيري/.test(all) ? "vermicelli"
    : /turmeric|saffron|kurkum|zafaran|qidra|قدرة/.test(all) ? "yellow"
    : opts.texture === "caldoso" ? "caldoso"
    : "white";
  const vessel: Vessel =
    base === "maqluba" || /tray|sedr|siniyy?eh|platter|صينية|سدر/.test(v) ? "tray"
    : /clay|qidra|\bjar\b|فخار|قدرة/.test(v) ? "olla"
    : "tanjara";
  const items: PanSpec["items"] = [];
  for (const [g, re, n] of RULES) if (re.test(t)) items.push({ kind: g, n });
  if (base === "maqluba" && !items.some((i) => i.kind === "eggplant")) items.push({ kind: "eggplant", n: 5 });
  if (base === "mujaddara") { for (const i of items) if (i.kind !== "onion") i.n = Math.min(i.n, 2); if (!items.some((i) => i.kind === "onion")) items.push({ kind: "onion", n: 9 }); }
  return { vessel, base, items };
}

// Thailand: sticky rice in a woven kratip, one-plate dishes on a plate, porridge in a bowl,
// rice salads (blue khao yam), khao chae in iced water, mango sticky rice.
function thaiSpec(opts: { title: string; texture: string; vessel: string; recipeText: string }): PanSpec {
  const t = opts.recipeText.toLowerCase();
  const name = opts.title.toLowerCase();
  const v = opts.vessel.toLowerCase();
  const all = name + " " + t;
  const base: Base =
    /khao chae|ข้าวแช่|iced water|jasmine[- ]scented water/.test(all) ? "khaochae"
    : /khao yam|ข้าวยำ|butterfly pea|anchan/.test(all) ? "khaoyam"
    : /mamuang|mango sticky|ข้าวเหนียวมะม่วง/.test(all) ? "sticky"
    : /khao niao|sticky rice|glutinous|ข้าวเหนียว/.test(all) ? "sticky"
    : /jok|joke|khao tom|porridge|congee|rice soup|โจ๊ก|ข้าวต้ม/.test(all) ? "porridge"
    : /khao pad|khao phat|fried rice|ข้าวผัด/.test(all) ? "friedrice"
    : "jasmine";
  const vessel: Vessel =
    /kratip|กระติ๊บ|basket/.test(v) || (base === "sticky" && !/mango|mamuang/.test(all)) ? "kratip"
    : /banana leaf|bai tong|ใบตอง/.test(v) ? "banana"
    : /clay|mor din|หม้อดิน/.test(v) ? "claypot"
    : base === "porridge" || base === "khaochae" ? "bowl"
    : "plate";
  const items: PanSpec["items"] = [];
  for (const [g, re, n] of RULES) if (re.test(t)) items.push({ kind: g, n });
  if (base === "khaochae") items.push({ kind: "ice", n: 5 }, { kind: "jasmineflower", n: 4 });
  if (/mamuang|mango sticky|ข้าวเหนียวมะม่วง/.test(all) && !items.some((i) => i.kind === "mango")) items.push({ kind: "mango", n: 1 });
  if (base === "friedrice" && !items.some((i) => i.kind === "lime")) items.push({ kind: "lime", n: 1 });
  return { vessel, base, items };
}

// ---------- glyphs (drawn around 0,0, roughly 20 units wide) ----------
const G: Record<Glyph, { r: number; svg: string }> = {
  prawn: { r: 11, svg: `<path d="M-8 3C-11-4-5-11 3-10c6 1 9 6 7 11-1 3-4 4-6 3l1-3c2 0 2-2 1-4-1-3-6-4-9-1-2 2-2 5 0 8z" fill="#ef7f52" stroke="#b9472c" stroke-width="1.1"/><path d="M-4-7l2 3M1-9l0 4M6-6l-2 3" stroke="#f6b08c" stroke-width="1.1" stroke-linecap="round"/><path d="M-8 3l-4 3 5 1z" fill="#d85f3a"/><circle cx="7.3" cy="-2.5" r="1" fill="#2a1a14"/><path d="M9-3c4-2 7-1 9 1M8-1c4 0 6 2 7 4" stroke="#b9472c" stroke-width=".7" fill="none"/>` },
  galera: { r: 11, svg: `<path d="M-11-2c6-3 16-3 22 0 1 2 1 3 0 4-6 3-16 3-22 0-1-1-1-3 0-4z" fill="#d7ad84" stroke="#9c7350" stroke-width="1"/><path d="M-7-3v6M-3-4v8M1-4v8M5-3v6" stroke="#b78a63" stroke-width=".9"/><circle cx="8" cy="0" r="1.6" fill="#7b4fa0"/><circle cx="-8.5" cy="0" r="1.3" fill="#7b4fa0"/>` },
  lobster: { r: 15, svg: `<path d="M-6-3c-6-2-9 2-8 5 1 2 4 3 7 1z" fill="#c8372d"/><path d="M-6 3c-7 0-9 4-7 7 2 2 5 1 7-1z" fill="#c8372d"/><path d="M-6-4c4-3 12-3 17 0 3 2 3 6 0 8-5 3-13 3-17 0-2-2-2-6 0-8z" fill="#d6463a" stroke="#8f241c" stroke-width="1"/><path d="M-1-6v12M4-6v12M8-5v10" stroke="#e98073" stroke-width="1"/><circle cx="-4" cy="-1" r="1" fill="#1d1010"/>` },
  mussel: { r: 9, svg: `<ellipse rx="9" ry="5.3" fill="#1d2230" stroke="#0e1018" stroke-width="1"/><ellipse rx="6.6" ry="3.4" fill="#f1a35a"/><path d="M-5 0c3-2 7-2 10 0" stroke="#d47c33" stroke-width="1" fill="none"/><ellipse cx="-3" cy="-3.2" rx="3" ry=".8" fill="#4a5470" opacity=".7"/>` },
  clam: { r: 7, svg: `<path d="M-7 3a7 7 0 0 1 14 0z" fill="#efe1c7" stroke="#b39a73" stroke-width="1"/><path d="M0 3V-4M-3.5 3l-1.5-5.5M3.5 3l1.5-5.5" stroke="#c5ad87" stroke-width=".8"/><rect x="-2" y="3" width="4" height="1.6" rx=".8" fill="#b39a73"/>` },
  ring: { r: 6, svg: `<circle r="4.6" fill="none" stroke="#f4eee2" stroke-width="3.1"/><circle r="4.6" fill="none" stroke="#c9b8d6" stroke-width=".6" opacity=".9"/>` },
  sepia: { r: 7, svg: `<rect x="-7" y="-4" width="14" height="8" rx="3" fill="#f3ede3" stroke="#d9cdbd" stroke-width=".8"/><path d="M-4-1h8M-3 1.5h6" stroke="#e1d6c6" stroke-width=".8"/>` },
  fish: { r: 9, svg: `<rect x="-9" y="-5.5" width="18" height="11" rx="4" fill="#f5efe4" stroke="#d6c8b3" stroke-width=".9"/><path d="M-5-5c2 3 2 8 0 11M0-5.5c2 3 2 8 0 11M5-5c2 3 2 8 0 11" stroke="#e3d6c2" stroke-width="1" fill="none"/>` },
  artichoke: { r: 9, svg: `<path d="M0-9C7-8 10-2 8 4 6 9 0 10 0 10S-6 9-8 4C-10-2-7-8 0-9z" fill="#6f8f42" stroke="#46612a" stroke-width="1"/><path d="M0-6C4-5 6-1 5 3 4 6 0 7 0 7S-4 6-5 3C-6-1-4-5 0-6z" fill="#a9bf6e"/><path d="M0-3c2 0 3 2 3 4s-1 3-3 3-3-1-3-3 1-4 3-4z" fill="#e3e3a8"/><path d="M-6-3l3 2M6-3l-3 2" stroke="#46612a" stroke-width=".8"/>` },
  bean: { r: 9, svg: `<path d="M-9-1c3-3 15-3 18-1 1 1 1 2 0 3-3 2-15 2-18 0-1-1-1-1 0-2z" fill="#6c9a3c" stroke="#466b23" stroke-width=".9"/><path d="M-7 0h14" stroke="#8fbd5a" stroke-width="1"/><circle cx="-4" cy="0" r=".8" fill="#4f7a2a"/><circle cx="0" cy="0" r=".8" fill="#4f7a2a"/><circle cx="4" cy="0" r=".8" fill="#4f7a2a"/>` },
  garrofo: { r: 5, svg: `<path d="M-5-1c0-3 4-4 6-3 3 1 4 4 3 6-1 3-5 3-7 2-2-1-2-3-2-5z" fill="#ebe6c8" stroke="#b8b088" stroke-width=".9"/><path d="M-2-2c1 1 1 3 0 4" stroke="#cfc79f" stroke-width=".8" fill="none"/>` },
  fava: { r: 4.5, svg: `<ellipse rx="4.4" ry="3.2" fill="#a7cd6c" stroke="#749a3d" stroke-width=".8"/><path d="M-1-3c1 1 1 2 0 3" stroke="#749a3d" stroke-width=".7" fill="none"/>` },
  pea: { r: 2.8, svg: `<circle r="2.6" fill="#7cbd48" stroke="#558a2c" stroke-width=".6"/><circle cx="-.8" cy="-.8" r=".8" fill="#b4e183"/>` },
  chickpea: { r: 3.4, svg: `<circle r="3.2" fill="#e3bf78" stroke="#b88f47" stroke-width=".7"/><circle cx="-1" cy="-1" r="1" fill="#f3d9a4"/><path d="M1.6 1.2l1 1" stroke="#b88f47" stroke-width=".8"/>` },
  potato: { r: 8, svg: `<ellipse rx="8" ry="7" fill="#f0cf73" stroke="#c99a3c" stroke-width="1"/><ellipse rx="5.6" ry="4.8" fill="#f6df98"/><circle cx="2" cy="-2" r=".7" fill="#d9ad55"/>` },
  turnip: { r: 7, svg: `<circle r="6.6" fill="#f4f0e6" stroke="#8b4f8f" stroke-width="1.8"/><circle r="4" fill="#fbf8f1"/><path d="M-3 0h6M0-3v6" stroke="#e7e0d0" stroke-width=".7"/>` },
  cauli: { r: 8, svg: `<circle cx="-3" cy="-1" r="4" fill="#f4edd3" stroke="#d5c79a" stroke-width=".8"/><circle cx="3" cy="-2" r="3.8" fill="#f6efd8" stroke="#d5c79a" stroke-width=".8"/><circle cx="0" cy="3" r="4" fill="#f2e9cb" stroke="#d5c79a" stroke-width=".8"/><path d="M0 4v4" stroke="#b9c48b" stroke-width="2"/>` },
  chard: { r: 9, svg: `<path d="M-9 0C-6-7 5-8 9 0 5 6-5 7-9 0z" fill="#2f6136" stroke="#1d4223" stroke-width=".9"/><path d="M-8 0H8M-3 0l-3-3M2 0l-2-4M2 0l-2 4" stroke="#7fa86a" stroke-width=".9"/>` },
  mushroom: { r: 7, svg: `<path d="M-7 1c0-5 3-7 7-7s7 2 7 7z" fill="#8b5b3a" stroke="#5e3b23" stroke-width=".9"/><path d="M-6 1h12" stroke="#d5b48f" stroke-width="1.4"/><rect x="-1.6" y="1" width="3.2" height="5" rx="1.2" fill="#e8d4b5"/>` },
  pepper: { r: 9, svg: `<path d="M-9 0c3-2 15-3 18-1 1 1 1 2 0 3-4 1-15 1-18 0-1 0-1-1 0-2z" fill="#c93a2e" stroke="#8c2119" stroke-width=".8"/><path d="M-6-.6h11" stroke="#ea7a6d" stroke-width=".9" stroke-linecap="round"/>` },
  tomato: { r: 9, svg: `<circle r="8.5" fill="#d8452f" stroke="#a52d1d" stroke-width="1"/><circle r="6" fill="#ea6a4e"/><path d="M0-5v10M-4.3-2.5l8.6 5M-4.3 2.5l8.6-5" stroke="#f6b49f" stroke-width="1.1"/><circle r="1.6" fill="#f6b49f"/>` },
  morcilla: { r: 5.5, svg: `<circle r="5.3" fill="#3d1818" stroke="#200a0a" stroke-width="1"/><circle cx="-1.6" cy="-1" r=".8" fill="#e9dccb"/><circle cx="1.5" cy="1.2" r=".7" fill="#e9dccb"/><circle cx="1.8" cy="-1.8" r=".6" fill="#e9dccb"/><circle cx="-1" cy="2" r=".6" fill="#e9dccb"/>` },
  chorizo: { r: 5.5, svg: `<circle r="5.3" fill="#b8372a" stroke="#7d1f16" stroke-width="1"/><circle cx="-1.6" cy="-1" r="1" fill="#f0b9a0"/><circle cx="1.5" cy="1.4" r=".9" fill="#f0b9a0"/><circle cx="2" cy="-2" r=".6" fill="#f0b9a0"/>` },
  meat: { r: 9, svg: `<path d="M-8-2c1-5 7-7 11-5 5 2 6 7 3 10-3 4-9 4-12 1-2-2-3-4-2-6z" fill="#a8622c" stroke="#6f3c16" stroke-width="1"/><path d="M-4-3c2-2 6-2 8 0" stroke="#d29152" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M-2 3c2 1 4 0 5-1" stroke="#8a4d20" stroke-width="1" fill="none"/>` },
  snail: { r: 6, svg: `<circle r="5.6" fill="#c9a678" stroke="#7a5a36" stroke-width=".9"/><path d="M0 0c1-1 2 0 2 1 0 2-2 3-3 3-3 0-4-2-4-4 0-3 3-5 5-5 4 0 6 3 6 6" stroke="#7a5a36" stroke-width="1" fill="none"/>` },
  pinenut: { r: 2.6, svg: `<path d="M0-2.8c1.4 0 2 1.6 2 3S1 2.8 0 2.8-2 1.6-2 .2s.6-3 2-3z" fill="#f3e3b5" stroke="#c9ad6a" stroke-width=".5"/>` },
  almond: { r: 4.5, svg: `<path d="M0-4.5C2.6-3 3 1 0 4.5-3 1-2.6-3 0-4.5z" fill="#e9d2a6" stroke="#b8935a" stroke-width=".6"/><path d="M0-3v6" stroke="#f6e7c7" stroke-width=".7"/>` },
  eggplant: { r: 8, svg: `<circle r="7.6" fill="#4a2350" stroke="#2c1230" stroke-width="1"/><circle r="5.8" fill="#e7d6a8"/><circle r="5.8" fill="#c08a3e" opacity=".35"/><g fill="#8a6a3a">${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${f1(3 * Math.cos((a * Math.PI) / 180))}" cy="${f1(3 * Math.sin((a * Math.PI) / 180))}" r=".6"/>`).join("")}</g>` },
  parsley: { r: 3, svg: `<path d="M-3 0c0-2 2-3 3-2 1-1 3 0 3 2-1 1-1 2-3 2s-3-1-3-2z" fill="#3f7d34" stroke="#2c5a24" stroke-width=".4"/>` },
  onion: { r: 4.5, svg: `<path d="M-4 1c1-3 4-4 6-3 2 1 2 3 0 4-1 1-3 0-3-1" fill="none" stroke="#7a3f12" stroke-width="1.8" stroke-linecap="round"/><path d="M-4 1c1-3 4-4 6-3" fill="none" stroke="#b56a24" stroke-width=".8" stroke-linecap="round"/>` },
  chili: { r: 6, svg: `<path d="M-6 1c3-4 8-5 12-3-3 0-6 2-8 4-1 1-3 1-4-1z" fill="#d42a1e" stroke="#9c1a12" stroke-width=".6"/><path d="M6-2l2-2" stroke="#3f7d34" stroke-width="1.4" stroke-linecap="round"/>` },
  basil: { r: 5, svg: `<path d="M-5 0C-3-4 3-4 5 0 3 4-3 4-5 0z" fill="#2f6a2a" stroke="#1e4a1b" stroke-width=".5"/><path d="M-4 0h8" stroke="#6aa25a" stroke-width=".6"/>` },
  lime: { r: 7, svg: `<path d="M-7 2a7 7 0 0 1 14 0z" fill="#7cb342" stroke="#4e7d1f" stroke-width="1"/><path d="M-5 2a5 5 0 0 1 10 0z" fill="#d7ec9a"/><path d="M0 2v-4.6M0 2l-3.4-3.2M0 2l3.4-3.2" stroke="#b5d46a" stroke-width=".7"/>` },
  cucumber: { r: 5.5, svg: `<circle r="5.3" fill="#e8f2d0" stroke="#3f7d34" stroke-width="1.2"/><g fill="#b9d58e">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${f1(2.4 * Math.cos((a * Math.PI) / 180))}" cy="${f1(2.4 * Math.sin((a * Math.PI) / 180))}" r=".7"/>`).join("")}</g>` },
  mango: { r: 26, svg: `<g>${[-16, -5, 6, 17].map((x) => `<path d="M${x - 6} -14c4-3 9-3 12 0v28c-3 3-8 3-12 0z" fill="#f6b51e" stroke="#d48b0b" stroke-width=".9"/>`).join("")}</g>` },
  peanut: { r: 2.4, svg: `<ellipse rx="2.3" ry="1.6" fill="#c98f4f" stroke="#8f5e2a" stroke-width=".4"/>` },
  ice: { r: 7, svg: `<rect x="-6" y="-6" width="12" height="12" rx="2.5" fill="#e9f6fb" stroke="#a8d3e2" stroke-width="1" opacity=".9"/><path d="M-3-3l3 3" stroke="#fff" stroke-width="1.2"/>` },
  jasmineflower: { r: 4, svg: `<g fill="#fffdf5" stroke="#e6dcc4" stroke-width=".4">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${f1(2.2 * Math.cos((a * Math.PI) / 180))}" cy="${f1(2.2 * Math.sin((a * Math.PI) / 180))}" rx="1.9" ry="1.1" transform="rotate(${a} ${f1(2.2 * Math.cos((a * Math.PI) / 180))} ${f1(2.2 * Math.sin((a * Math.PI) / 180))})"/>`).join("")}</g><circle r=".9" fill="#f2d16b"/>` },
  egg: { r: 12, svg: `<path d="M-11-2c0-7 8-10 13-9 7 1 10 6 9 11-1 6-7 10-13 9-6-1-9-5-9-11z" fill="#fbf7ee" stroke="#e8dcc4" stroke-width=".8"/><path d="M-10 4c1 2 3 4 5 4" stroke="#d9a14a" stroke-width="1.3" fill="none" opacity=".7"/><circle cx="1" cy="-.5" r="5" fill="#f5b21c"/><circle cx="-.5" cy="-2" r="1.6" fill="#fde08a"/>` },
  lemon: { r: 9, svg: `<path d="M-9 2a9 9 0 0 1 18 0z" fill="#f5d33c" stroke="#d9a915" stroke-width="1.2"/><path d="M-6.6 2a6.6 6.6 0 0 1 13.2 0z" fill="#fbe98a"/><path d="M0 2V-4.6M0 2l-4.6-4.6M0 2l4.6-4.6" stroke="#f6dc5c" stroke-width=".9"/>` },
  rosemary: { r: 12, svg: `<path d="M-12 4C-4 1 4-1 12-5" stroke="#4d6a37" stroke-width="1.3" fill="none"/>${Array.from({ length: 9 }, (_, i) => { const x = -10 + i * 2.6, y = 3.4 - i * 1.0; return `<path d="M${f1(x)} ${f1(y)}l-1.5-3.5M${f1(x)} ${f1(y)}l1.6 3.4" stroke="#6d8f4f" stroke-width="1.1" stroke-linecap="round"/>`; }).join("")}` },
  garlic: { r: 14, svg: `<circle r="13.5" fill="#f4ecdc" stroke="#cbb998" stroke-width="1.2"/>${[0, 60, 120, 180, 240, 300].map((a) => `<path d="M0 0L${f1(13 * Math.cos((a * Math.PI) / 180))} ${f1(13 * Math.sin((a * Math.PI) / 180))}" stroke="#d9c9ab" stroke-width="1"/>`).join("")}<circle r="4" fill="#efe2c9" stroke="#b9a07c" stroke-width=".8"/><path d="M-8-7c2 1 3 3 3 5M7-8c-1 2-1 4 0 6" stroke="#b07fa6" stroke-width=".8" fill="none" opacity=".6"/>` },
  cinnamon: { r: 0, svg: `` },
  peel: { r: 10, svg: `<path d="M-10 2c4-5 14-6 20-2-5 0-13 1-20 2z" fill="#f2c94c" stroke="#d6a51c" stroke-width=".9"/>` },
};

// ---------- palettes ----------
interface Pal { bg: string; grainA: string; grainB: string; edge: string; gloss: number; tile: number; grains: number }
const PAL: Record<Base, Pal> = {
  seco: { bg: "#e5ae45", grainA: "#f7d98a", grainB: "#d39232", edge: "#8f4f17", gloss: 0.1, tile: 9, grains: 4 },
  banda: { bg: "#d98a35", grainA: "#f4c27a", grainB: "#c46d26", edge: "#8a3f14", gloss: 0.1, tile: 9, grains: 4 },
  negro: { bg: "#2b2729", grainA: "#4a4446", grainB: "#171415", edge: "#0b0909", gloss: 0.18, tile: 9, grains: 4 },
  meloso: { bg: "#e4bd73", grainA: "#f6e2b0", grainB: "#d6a95a", edge: "#b98a45", gloss: 0.28, tile: 10, grains: 4 },
  caldoso: { bg: "#c4622c", grainA: "#f3d79e", grainB: "#e2a660", edge: "#8a3a17", gloss: 0.42, tile: 13, grains: 3 },
  "caldoso-negro": { bg: "#262224", grainA: "#5a5254", grainB: "#3a3335", edge: "#0b0909", gloss: 0.4, tile: 13, grains: 3 },
  horno: { bg: "#c9772f", grainA: "#eab26a", grainB: "#a95a22", edge: "#6e3510", gloss: 0.12, tile: 9, grains: 4 },
  costra: { bg: "#e7b149", grainA: "#f3cf73", grainB: "#d29436", edge: "#9a5a1a", gloss: 0.2, tile: 9, grains: 0 },
  white: { bg: "#f2ead7", grainA: "#fffbf1", grainB: "#e6dcc4", edge: "#c9b994", gloss: 0.3, tile: 9, grains: 4 },
  vermicelli: { bg: "#efe5cf", grainA: "#fffaf0", grainB: "#b77a3a", edge: "#b99d6c", gloss: 0.25, tile: 9, grains: 5 },
  yellow: { bg: "#e9c159", grainA: "#f7dc8e", grainB: "#d7a33a", edge: "#a9781f", gloss: 0.15, tile: 9, grains: 4 },
  maqluba: { bg: "#c98a45", grainA: "#e8b874", grainB: "#a8682a", edge: "#7c4516", gloss: 0.2, tile: 9, grains: 4 },
  mujaddara: { bg: "#b89a72", grainA: "#e2cfac", grainB: "#5c4630", edge: "#6f5435", gloss: 0.12, tile: 8, grains: 5 },
  jasmine: { bg: "#f6f1e6", grainA: "#ffffff", grainB: "#e7e0d0", edge: "#d3c9b2", gloss: 0.25, tile: 8, grains: 5 },
  sticky: { bg: "#f2ecdc", grainA: "#fffdf6", grainB: "#ddd4bd", edge: "#c8bb98", gloss: 0.4, tile: 7, grains: 6 },
  friedrice: { bg: "#d9a65a", grainA: "#ecc584", grainB: "#b57a32", edge: "#8a5520", gloss: 0.15, tile: 8, grains: 5 },
  porridge: { bg: "#efe8d6", grainA: "#fbf7ee", grainB: "#e0d6bf", edge: "#cfc3a5", gloss: 0.45, tile: 12, grains: 3 },
  khaoyam: { bg: "#6f78c9", grainA: "#a9b0ea", grainB: "#4c55a8", edge: "#3a4290", gloss: 0.2, tile: 8, grains: 5 },
  khaochae: { bg: "#dceff4", grainA: "#ffffff", grainB: "#c6e2ea", edge: "#a9cfdb", gloss: 0.5, tile: 12, grains: 3 },
  leche: { bg: "#f5ead2", grainA: "#fffaf0", grainB: "#eadcc0", edge: "#d9c6a0", gloss: 0.35, tile: 10, grains: 4 },
};

let uidCounter = 0;
const SCALE = 1.45; // glyph size relative to the pan


export function panSVG(spec: PanSpec, slug: string, opts: { label?: string; steam?: boolean; cls?: string } = {}) {
  const uid = `p${hashStr(slug).toString(36)}${(uidCounter++).toString(36)}`;
  const rand = rng(hashStr(slug));
  const pal = { ...PAL[spec.base] };
  if (spec.base === "caldoso") {
    const has = (...k: Glyph[]) => spec.items.some((i) => k.includes(i.kind));
    pal.bg = has("prawn", "lobster", "galera", "clam", "mussel", "ring", "sepia", "fish") ? "#c55a2b"
      : has("meat", "morcilla", "chorizo", "snail") ? "#a5602f"
      : "#c99a3e";
  }
  const C = 100;
  const R = { olla: 66, caldero: 72, tray: 74, tanjara: 70, kratip: 64, plate: 62, bowl: 64, claypot: 66, banana: 64 }[spec.vessel as string] ?? 80; // food radius

  // grain tile
  const grains = Array.from({ length: pal.grains }, (_, i) => {
    const x = f1(rand() * pal.tile), y = f1(rand() * pal.tile), a = Math.round(rand() * 180);
    return `<ellipse cx="${x}" cy="${y}" rx="2.2" ry=".95" transform="rotate(${a} ${x} ${y})" fill="${i % 3 === 2 ? pal.grainB : pal.grainA}"/>`;
  }).join("");

  // --- vessel back layer ---
  let back = "", rimTop = "";
  if (spec.vessel === "paella") {
    const handle = (side: 1 | -1) => {
      const x = C + side * 88;
      return `<g><path d="M${C + side * 78} ${C - 13}C${x + side * 22} ${C - 18} ${x + side * 22} ${C + 18} ${C + side * 78} ${C + 13}" fill="none" stroke="url(#steel${uid})" stroke-width="7" stroke-linecap="round"/><circle cx="${C + side * 80}" cy="${C - 9}" r="2.2" fill="#2d3035"/><circle cx="${C + side * 80}" cy="${C + 9}" r="2.2" fill="#2d3035"/></g>`;
    };
    back = handle(-1) + handle(1) + `<circle cx="${C}" cy="${C}" r="${R + 6}" fill="url(#steel${uid})"/><circle cx="${C}" cy="${C}" r="${R + 2}" fill="#3a3d42"/>`;
    rimTop = `<circle cx="${C}" cy="${C}" r="${R + 4}" fill="none" stroke="#9aa0a8" stroke-width="1" opacity=".55"/>`;
  } else if (spec.vessel === "cassola") {
    back = `<circle cx="${C}" cy="${C}" r="${R + 9}" fill="url(#clay${uid})"/><circle cx="${C}" cy="${C}" r="${R + 3}" fill="#6d3518"/>`
      + [-1, 1].map((s) => `<path d="M${C + s * (R + 6)} ${C - 9}q${s * 10} 9 0 18" fill="#9c4f27" stroke="#6d3518" stroke-width="1.5"/>`).join("");
    rimTop = `<circle cx="${C}" cy="${C}" r="${R + 6}" fill="none" stroke="#d98b5a" stroke-width="1.2" opacity=".5"/>`;
  } else if (spec.vessel === "caldero") {
    back = `<path d="M${C - R - 10} ${C}C${C - R - 14} ${C - R - 36} ${C + R + 14} ${C - R - 36} ${C + R + 10} ${C}" fill="none" stroke="#1d1b1a" stroke-width="3.5"/>`
      + `<circle cx="${C}" cy="${C}" r="${R + 11}" fill="url(#iron${uid})"/><circle cx="${C}" cy="${C}" r="${R + 3}" fill="#121110"/>`
      + [-1, 1].map((s) => `<circle cx="${C + s * (R + 10)}" cy="${C}" r="4" fill="#2a2725"/>`).join("");
    rimTop = `<circle cx="${C}" cy="${C}" r="${R + 8}" fill="none" stroke="#5a5550" stroke-width="1" opacity=".7"/>`;
  } else if (spec.vessel === "kratip") {
    // woven bamboo sticky-rice basket, seen from above: woven rim + lid-band
    back = `<circle cx="${C}" cy="${C}" r="${R + 22}" fill="#c9a46a"/>`
      + Array.from({ length: 36 }, (_, i) => { const a = (i * Math.PI) / 18; return `<path d="M${f1(C + Math.cos(a) * (R + 4))} ${f1(C + Math.sin(a) * (R + 4))}L${f1(C + Math.cos(a + 0.09) * (R + 21))} ${f1(C + Math.sin(a + 0.09) * (R + 21))}" stroke="${i % 2 ? "#a47c3f" : "#dcbb83"}" stroke-width="5"/>`; }).join("")
      + `<circle cx="${C}" cy="${C}" r="${R + 22}" fill="none" stroke="#7a5826" stroke-width="2"/><circle cx="${C}" cy="${C}" r="${R + 4}" fill="#8a6430"/>`;
    rimTop = `<circle cx="${C}" cy="${C}" r="${R + 1}" fill="none" stroke="#5e421b" stroke-width="1" opacity=".5"/>`;
  } else if (spec.vessel === "plate") {
    // white plate with a blue rim (one-plate rice: khao man kai, khao pad …)
    back = `<circle cx="${C}" cy="${C}" r="${R + 26}" fill="#fdfcf8" stroke="#d9d6cc" stroke-width="1.2"/><circle cx="${C}" cy="${C}" r="${R + 22}" fill="none" stroke="#2f5fa8" stroke-width="2.4"/><circle cx="${C}" cy="${C}" r="${R + 10}" fill="#f4f2ec"/>`;
    rimTop = "";
  } else if (spec.vessel === "bowl") {
    back = `<circle cx="${C}" cy="${C}" r="${R + 18}" fill="#fbfaf6" stroke="#cfcac0" stroke-width="1.2"/>`
      + Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8; return `<circle cx="${f1(C + Math.cos(a) * (R + 11))}" cy="${f1(C + Math.sin(a) * (R + 11))}" r="2.2" fill="#2f5fa8" opacity=".8"/>`; }).join("")
      + `<circle cx="${C}" cy="${C}" r="${R + 5}" fill="#e9e6de"/>`;
    rimTop = `<circle cx="${C}" cy="${C}" r="${R + 2}" fill="none" stroke="#bdb8ad" stroke-width="1" opacity=".6"/>`;
  } else if (spec.vessel === "claypot") {
    back = [-1, 1].map((s) => `<path d="M${C + s * (R + 12)} ${C - 8}q${s * 10} 8 0 16" fill="none" stroke="#3b2418" stroke-width="5" stroke-linecap="round"/>`).join("")
      + `<circle cx="${C}" cy="${C}" r="${R + 14}" fill="#5a3825"/><circle cx="${C}" cy="${C}" r="${R + 5}" fill="#2e1b11"/>`;
    rimTop = `<circle cx="${C}" cy="${C}" r="${R + 10}" fill="none" stroke="#8a5d40" stroke-width="1.2" opacity=".6"/>`;
  } else if (spec.vessel === "banana") {
    // banana-leaf parcel opened flat (veins clipped to the leaf)
    const leaf = `M${C} ${C - R - 26}C${C + R + 34} ${C - R - 10} ${C + R + 34} ${C + R + 10} ${C} ${C + R + 26}C${C - R - 34} ${C + R + 10} ${C - R - 34} ${C - R - 10} ${C} ${C - R - 26}z`;
    back = `<clipPath id="leaf${uid}"><path d="${leaf}"/></clipPath><path d="${leaf}" fill="#3f8a3a" stroke="#2a6127" stroke-width="2"/><g clip-path="url(#leaf${uid})">`
      + Array.from({ length: 9 }, (_, i) => { const y = C - R - 10 + i * ((2 * R + 20) / 8); return `<path d="M${C} ${f1(y)}L${C + R + 30} ${f1(y - 14)}M${C} ${f1(y)}L${C - R - 30} ${f1(y - 14)}" stroke="#5aa64f" stroke-width="1" opacity=".7"/>`; }).join("")
      + `</g><path d="M${C} ${C - R - 24}V${C + R + 24}" stroke="#2a6127" stroke-width="2.5"/>`;
    rimTop = "";
  } else if (spec.vessel === "tray") {
    // round brass serving tray (siniyyeh / sedr) with a chased rim
    back = `<circle cx="${C}" cy="${C}" r="${R + 20}" fill="url(#brass${uid})"/><circle cx="${C}" cy="${C}" r="${R + 13}" fill="none" stroke="#8a6418" stroke-width="1.2"/>`
      + Array.from({ length: 24 }, (_, i) => { const a = (i * Math.PI) / 12; return `<circle cx="${f1(C + Math.cos(a) * (R + 16.5))}" cy="${f1(C + Math.sin(a) * (R + 16.5))}" r="1.3" fill="#f3d48a" opacity=".8"/>`; }).join("")
      + `<circle cx="${C}" cy="${C}" r="${R + 8}" fill="#b98f3e"/>`;
    rimTop = `<circle cx="${C}" cy="${C}" r="${R + 2}" fill="none" stroke="#6e4f12" stroke-width="1" opacity=".5"/>`;
  } else if (spec.vessel === "tanjara") {
    // hammered copper pot with two handles
    back = [-1, 1].map((s) => `<path d="M${C + s * (R + 9)} ${C - 10}q${s * 13} 10 0 20" fill="none" stroke="#7a3a1c" stroke-width="5" stroke-linecap="round"/>`).join("")
      + `<circle cx="${C}" cy="${C}" r="${R + 12}" fill="url(#copper${uid})"/><circle cx="${C}" cy="${C}" r="${R + 4}" fill="#5b2a12"/>`;
    rimTop = `<circle cx="${C}" cy="${C}" r="${R + 9}" fill="none" stroke="#f0b48a" stroke-width="1" opacity=".5"/>`;
  } else {
    back = `<circle cx="${C}" cy="${C}" r="${R + 16}" fill="url(#clay${uid})"/><circle cx="${C}" cy="${C}" r="${R + 8}" fill="#5c2b12"/><circle cx="${C}" cy="${C}" r="${R + 3}" fill="#3e1c0b"/>`
      + [-1, 1].map((s) => `<path d="M${C + s * (R + 13)} ${C - 12}q${s * 14} 12 0 24" fill="none" stroke="#8f4520" stroke-width="5" stroke-linecap="round"/>`).join("");
    rimTop = `<circle cx="${C}" cy="${C}" r="${R + 12}" fill="none" stroke="#d98b5a" stroke-width="1.2" opacity=".45"/>`;
  }

  // --- food placement (Poisson-ish rejection sampling inside the disc) ---
  const placed: { x: number; y: number; r: number }[] = [];
  const out: string[] = [];
  const put = (g: Glyph, x: number, y: number, rot: number, s: number) => {
    out.push(`<g transform="translate(${f1(x)} ${f1(y)}) rotate(${Math.round(rot)}) scale(${f1(s)})">${G[g].svg}</g>`);
  };
  if (spec.center) {
    put(spec.center, C, C, rand() * 360, 1.25);
    placed.push({ x: C, y: C, r: G[spec.center].r * 1.25 });
  }
  const queue: Glyph[] = [];
  const crowd = spec.items.length > 4 ? 0.6 : spec.items.length > 2 ? 0.75 : 1;
  for (const it of spec.items) for (let i = 0; i < Math.max(1, Math.round(it.n * crowd)); i++) queue.push(it.kind);
  // big things first so small ones fill the gaps
  queue.sort((a, b) => G[b].r - G[a].r);
  for (const g of queue) {
    if (g === "cinnamon") continue;
    const gr = G[g].r;
    const s = (0.9 + rand() * 0.25) * SCALE;
    for (let tries = 0; tries < 60; tries++) {
      const ang = rand() * Math.PI * 2;
      const maxD = R - gr * s - 4;
      // lemons sit near the rim; others anywhere
      const d = g === "lemon" ? maxD - rand() * 6 : Math.sqrt(rand()) * maxD;
      const x = C + Math.cos(ang) * d, y = C + Math.sin(ang) * d;
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + gr * s * 0.92)) {
        placed.push({ x, y, r: gr * s });
        const rot = g === "lemon" ? (ang * 180) / Math.PI + 90 : rand() * 360;
        put(g, x, y, rot, s);
        break;
      }
    }
  }

  // costra: puffed egg crust with browned blotches
  let crust = "";
  if (spec.base === "costra") {
    crust = `<circle cx="${C}" cy="${C}" r="${R}" fill="url(#crust${uid})"/>` + Array.from({ length: 14 }, () => {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (R - 12);
      return `<ellipse cx="${f1(C + Math.cos(a) * d)}" cy="${f1(C + Math.sin(a) * d)}" rx="${f1(5 + rand() * 9)}" ry="${f1(3 + rand() * 6)}" transform="rotate(${Math.round(rand() * 180)} ${f1(C + Math.cos(a) * d)} ${f1(C + Math.sin(a) * d)})" fill="#b86f22" opacity="${f1(0.18 + rand() * 0.25)}"/>`;
    }).join("");
  }
  // arroz con leche: cinnamon dusting
  let dust = "";
  if (spec.items.some((i) => i.kind === "cinnamon")) {
    dust = Array.from({ length: 70 }, () => {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (R - 20);
      return `<circle cx="${f1(C + Math.cos(a) * d)}" cy="${f1(C + Math.sin(a) * d)}" r="${f1(0.6 + rand() * 1.4)}" fill="#8b4a1f" opacity="${f1(0.35 + rand() * 0.4)}"/>`;
    }).join("");
  }
  // broth: a few floating glints
  let broth = "";
  if (spec.base.startsWith("caldoso")) {
    broth = Array.from({ length: 7 }, () => {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * (R - 10);
      return `<ellipse cx="${f1(C + Math.cos(a) * d)}" cy="${f1(C + Math.sin(a) * d)}" rx="${f1(3 + rand() * 5)}" ry="${f1(1 + rand() * 1.5)}" fill="#fff" opacity=".18"/>`;
    }).join("");
  }

  const steam = opts.steam === false ? "" : `<g class="pan-steam" aria-hidden="true">${[0, 1, 2].map((i) => {
    const x = C - 26 + i * 26 + Math.round(rand() * 8);
    return `<path d="M${x} ${C + 24}c-9-14 9-22 0-36s9-22 0-36" style="--d:${i}"/>`;
  }).join("")}</g>`;

  return `<svg class="pan pan-${spec.vessel} base-${spec.base}${opts.cls ? " " + opts.cls : ""}" viewBox="-14 -14 228 228" role="img"${opts.label ? ` aria-label="${opts.label.replace(/"/g, "&quot;")}"` : ' aria-hidden="true"'}>
<defs>
<pattern id="gr${uid}" width="${pal.tile}" height="${pal.tile}" patternUnits="userSpaceOnUse" patternTransform="rotate(${Math.round(rand() * 90)})">${grains}</pattern>
<radialGradient id="soc${uid}"><stop offset="62%" stop-color="${pal.edge}" stop-opacity="0"/><stop offset="100%" stop-color="${pal.edge}" stop-opacity=".75"/></radialGradient>
<radialGradient id="gl${uid}" cx="35%" cy="30%" r="60%"><stop offset="0%" stop-color="#fff" stop-opacity="${pal.gloss}"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="steel${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9ced4"/><stop offset=".5" stop-color="#6f757d"/><stop offset="1" stop-color="#3b3f45"/></linearGradient>
<linearGradient id="clay${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d27a45"/><stop offset=".6" stop-color="#a24e24"/><stop offset="1" stop-color="#6f3216"/></linearGradient>
<linearGradient id="iron${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#57524d"/><stop offset=".5" stop-color="#2b2826"/><stop offset="1" stop-color="#121110"/></linearGradient>
<linearGradient id="brass${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1cf7a"/><stop offset=".55" stop-color="#c9963a"/><stop offset="1" stop-color="#8a6418"/></linearGradient>
<linearGradient id="copper${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6956a"/><stop offset=".5" stop-color="#b5552c"/><stop offset="1" stop-color="#6e2d12"/></linearGradient>
<radialGradient id="crust${uid}" cx="45%" cy="40%"><stop offset="0" stop-color="#f6d27a"/><stop offset=".7" stop-color="#e2a646"/><stop offset="1" stop-color="#a8641e"/></radialGradient>
<clipPath id="cl${uid}"><circle cx="${C}" cy="${C}" r="${R}"/></clipPath>
</defs>
<g class="pan-vessel">${back}</g>
<g class="pan-spin">
<g clip-path="url(#cl${uid})">
<circle cx="${C}" cy="${C}" r="${R}" fill="${pal.bg}"/>
${pal.grains ? `<rect x="${C - R}" y="${C - R}" width="${2 * R}" height="${2 * R}" fill="url(#gr${uid})"/>` : ""}
${crust}${broth}
<circle cx="${C}" cy="${C}" r="${R}" fill="url(#soc${uid})"/>
<g class="pan-food">${out.join("")}</g>
${dust}
</g>
</g>
<circle cx="${C}" cy="${C}" r="${R}" fill="url(#gl${uid})" pointer-events="none"/>
${rimTop}
${steam}
</svg>`;
}
