// Areas: the level above regions (Spain, Bilad al-Sham, later Thailand …). Data-driven from
// content/glosses.json "areas" ({ name, regions, theme?, hero? }); copy below is the built-in default
// per area id and can be overridden from glosses.json without code changes.
import { AREAS, areaOf, type Lang, type Page } from "@arros/content";
import { UI } from "./i18n";

export interface AreaCopy { heroTitle: string; heroLede: string }
const COPY: Record<string, Partial<Record<Lang, AreaCopy>>> = {
  spain: {
    "en": {
      "heroTitle": "The rice of Spain,<br>town by town.",
      "heroLede": "Rice came to the Iberian Peninsula with the irrigation channels of al-Andalus. Over the centuries it turned into hundreds of local dishes, each with its own pan, fire and broth. Here they are, with the history behind each one and a detailed recipe to cook it."
    },
    "es": {
      "heroTitle": "El arroz de España,<br>pueblo a pueblo.",
      "heroLede": "El arroz llegó a la península ibérica con las acequias de al-Ándalus. Con los siglos se convirtió en cientos de platos locales, cada uno con su paella, su fuego y su caldo. Aquí están todos, con la historia de cada uno y una receta detallada para cocinarlo."
    },
    "ca": {
      "heroTitle": "L'arròs d'Espanya,<br>poble a poble.",
      "heroLede": "L'arròs va arribar a la península Ibèrica amb les séquies d'al-Àndalus. Amb els segles es va convertir en centenars de plats locals, cadascun amb la seua paella, el seu foc i el seu brou. Ací els teniu tots, amb la història de cadascun i una recepta detallada per a cuinar-lo."
    },
    "th": {
      "heroTitle": "ข้าวแห่งสเปน<br>เมืองต่อเมือง",
      "heroLede": "ข้าวเข้ามาสู่คาบสมุทรไอบีเรียพร้อมกับคลองชลประทานของอัล-อันดะลุส ตลอดหลายศตวรรษ ข้าวได้กลายเป็นอาหารท้องถิ่นนับร้อยชนิด แต่ละจานมีกระทะ ไฟ และน้ำซุปเป็นของตัวเอง ที่นี่รวบรวมไว้ทั้งหมด พร้อมประวัติของแต่ละจานและสูตรละเอียดสำหรับทำเอง"
    },
    "ar": {
      "heroTitle": "أرز إسبانيا،<br>بلدةً بلدة.",
      "heroLede": "وصل الأرز إلى شبه الجزيرة الإيبيرية مع قنوات الري في الأندلس. وعلى مرّ القرون صار مئات الأطباق المحلية، لكلٍّ منها مقلاته وناره ومرقه. ستجدها هنا، مع تاريخ كل طبق ووصفة مفصّلة لطهوه."
    }
  },
  sham: {
    "en": {
      "heroTitle": "The rice of Bilad al-Sham,<br>village by village.",
      "heroLede": "In the Levant rice is the dish of gathering: turned out of the pot in one piece, heaped over bread with lamb and yoghurt, or cooked with lentils and crowned with crisp onions. Here are the region's rice dishes, with the history behind each one and a detailed recipe to cook it."
    },
    "es": {
      "heroTitle": "El arroz de Bilad al-Sham,<br>aldea a aldea.",
      "heroLede": "En el Levante, el arroz es el plato de las reuniones: se vuelca de la olla de una sola pieza, se sirve sobre pan con cordero y yogur, o se guisa con lentejas y se corona con cebolla crujiente. Aquí están los arroces de la región, con la historia de cada uno y una receta detallada para cocinarlo."
    },
    "ca": {
      "heroTitle": "L'arròs de Bilad al-Xam,<br>poble a poble.",
      "heroLede": "Al Llevant, l'arròs és el plat de les trobades: es bolca de l'olla d'una sola peça, se servix sobre pa amb xai i iogurt, o es cuina amb llenties i es corona amb ceba cruixent. Ací teniu els arrossos de la regió, amb la història de cadascun i una recepta detallada per a cuinar-lo."
    },
    "th": {
      "heroTitle": "ข้าวแห่งบิลาดอัชชาม<br>หมู่บ้านต่อหมู่บ้าน",
      "heroLede": "ในดินแดนลิแวนต์ ข้าวคืออาหารแห่งการรวมตัว ทั้งคว่ำออกจากหม้อทั้งก้อน กองบนขนมปังพร้อมเนื้อแกะและโยเกิร์ต หรือหุงกับถั่วเลนทิลแล้วโรยหอมทอดกรอบ ที่นี่รวบรวมอาหารข้าวของภูมิภาคนี้ พร้อมประวัติของแต่ละจานและสูตรละเอียดสำหรับทำเอง"
    },
    "ar": {
      "heroTitle": "أرز بلاد الشام،<br>قريةً قرية.",
      "heroLede": "في بلاد الشام، الأرز طبقُ اللمّة: يُقلَب من القدر قطعةً واحدة، أو يُكوَّم على الخبز مع لحم الضأن واللبن، أو يُطهى مع العدس ويُتوَّج بالبصل المقرمش. هنا أطباق الأرز في المنطقة، مع تاريخ كل طبق ووصفة مفصّلة لطهوه."
    }
  },
};

/** Visual theme per area (CSS: [data-theme="…"]). Spain is the original look. */
const THEME: Record<string, string> = { spain: "spain", sham: "sham" };

export interface AreaView { id: string; name: string; theme: string; regions: string[]; copy: AreaCopy }
export function areaView(id: string, lang: Lang): AreaView | undefined {
  const a = AREAS.find((x) => x.id === id);
  if (!a) return undefined;
  const name = a.name(lang);
  const copy = (a as any).hero?.[lang] ?? COPY[id]?.[lang] ?? COPY[id]?.en
    ?? { heroTitle: name, heroLede: UI[lang].heroLede };
  return { id, name, theme: (a as any).theme ?? THEME[id] ?? "default", regions: a.regions, copy };
}
export const areaIds = () => AREAS.map((a) => a.id);
/** Area of a recipe = area of its first region. */
export const recipeArea = (p: Page) => p.provinces.map((x) => areaOf(x.file)).find(Boolean);
export const regionArea = (file: string) => areaOf(file);
export { AREAS };

/** schema.org recipeCuisine labels: area-level plus a regional one where it adds meaning. */
const AREA_CUISINE: Record<string, string> = { spain: "Spanish", sham: "Levantine" };
const REGION_CUISINE: Record<string, string> = {
  "provincial_valencia.md": "Valencian", "provincial_alicante.md": "Valencian", "provincial_castellon.md": "Valencian",
  "provincial_catalunya.md": "Catalan", "provincial_baleares.md": "Balearic", "provincial_murcia.md": "Murcian",
  "provincial_andalucia.md": "Andalusian", "provincial_canarias.md": "Canarian", "provincial_madrid.md": "Madrilenian",
  "provincial_aragon_navarra_rioja.md": "Aragonese", "provincial_castilla_la_mancha_extremadura.md": "Manchegan",
  "provincial_castilla_y_leon.md": "Castilian", "provincial_norte.md": "Northern Spanish",
  "provincial_palestine.md": "Palestinian", "provincial_lebanon.md": "Lebanese", "provincial_jordan.md": "Jordanian", "provincial_syria.md": "Syrian",
};
export const cuisinesOf = (p: Page) => {
  const a = recipeArea(p);
  return [...new Set([a && AREA_CUISINE[a], ...p.provinces.map((x) => REGION_CUISINE[x.file])].filter(Boolean) as string[])];
};
