// About page copy (Markdown) per language. {recipes}, {spain}, {sham}, {thai}, {photos} are filled at build time.
import type { Lang } from "@arros/content";
export const ABOUT: Record<Lang, string> = {
  en: `Khaorroz is a free, multilingual atlas of traditional rice dishes — their history, their town-by-town variations and a detailed recipe for each. The name joins Thai *khao* (rice, and a meal) and Spanish *arroz*, itself from Arabic *ar-ruzz*: three kitchens, one grain.

## Three rice traditions
- **Spain** ({spain} dishes): from the paellas and baked rices of Valencia to the cassolas of Catalonia, the calderos of Murcia and the rices of the north.
- **Bilad al-Sham** ({sham} dishes): Palestine, Lebanon, Syria and Jordan — upside-down maqluba, mansaf, mujaddara, stuffed vegetables, festive and sweet rices, and the diaspora kitchens of Latin America.
- **Thailand** ({thai} dishes): sticky rice of the north and Isan, jasmine rice of the central plains, court and ritual rices, porridges, fried rices and rice desserts.

## How dishes are researched
Every page is built from published sources — cookbooks, academic work, heritage and municipal projects, press archives and, for historical dishes, medieval and Ottoman-era texts. The sources are listed on each recipe under **Sources**. Where the evidence is thin, a ⚠️ note says so; town-level differences often come from cooks' own accounts and are reported as such. Historical recipes are marked as reconstructions with an honest modern adaptation. Contested origins are described, not decided.

## Languages, photos and illustrations
The atlas is written in English and translated into Spanish, Catalan/Valencian, Thai and Arabic. Dish photos ({photos} so far) come from Wikimedia Commons under free licences and are credited on every page and on the [photo credits](credits) page; dishes without a correct free photo show an illustration of the dish in its traditional vessel, drawn from its recipe.

## Corrections
Found a mistake, a missing variation or a better source? Please [open an issue](https://github.com/hussmartinez/khaorroz/issues). The full research notes are on the [research notes](notes) page.`,
  es: `Khaorroz es un atlas libre y multilingüe de los arroces tradicionales: su historia, sus variantes pueblo a pueblo y una receta detallada de cada uno. El nombre une el tailandés *khao* (arroz, y también comida) y el español *arroz*, que viene del árabe *ar-ruzz*: tres cocinas, un mismo grano.

## Tres tradiciones del arroz
- **España** ({spain} platos): de las paellas y los arroces al horno valencianos a las cazuelas catalanas, los calderos murcianos y los arroces del norte.
- **Bilad al-Sham** ({sham} platos): Palestina, Líbano, Siria y Jordania — maqluba, mansaf, mujaddara, verduras rellenas, arroces de fiesta y dulces, y las cocinas de la diáspora en América Latina.
- **Tailandia** ({thai} platos): el arroz glutinoso del norte y de Isan, el arroz jazmín de las llanuras centrales, arroces de corte y rituales, gachas, arroces fritos y postres de arroz.

## Cómo se investiga cada plato
Cada página se basa en fuentes publicadas: recetarios, trabajos académicos, proyectos patrimoniales y municipales, hemerotecas y, para los platos históricos, textos medievales y otomanos. Las fuentes aparecen en cada receta, en **Fuentes**. Cuando la documentación es escasa, una nota ⚠️ lo indica; las diferencias entre pueblos suelen venir del testimonio de cocineros y se presentan como tales. Las recetas históricas se marcan como reconstrucciones con una adaptación moderna honesta. Los orígenes discutidos se describen, no se deciden.

## Idiomas, fotos e ilustraciones
El atlas se escribe en inglés y se traduce al español, al catalán/valenciano, al tailandés y al árabe. Las fotos ({photos} por ahora) proceden de Wikimedia Commons con licencias libres y se acreditan en cada página y en la página de [créditos fotográficos](credits); los platos sin una foto libre correcta muestran una ilustración del plato en su recipiente tradicional, dibujada a partir de la receta.

## Correcciones
¿Has encontrado un error, una variante que falta o una fuente mejor? [Abre una incidencia](https://github.com/hussmartinez/khaorroz/issues). Las notas completas de investigación están en [notas de investigación](notes).`,
  ca: `Khaorroz és un atles lliure i multilingüe dels arrossos tradicionals: la seua història, les variants poble a poble i una recepta detallada de cadascun. El nom uneix el tai *khao* (arròs, i també menjar) i l'espanyol *arroz*, que ve de l'àrab *ar-ruzz*: tres cuines, un mateix gra.

## Tres tradicions de l'arròs
- **Espanya** ({spain} plats): de les paelles i els arrossos al forn valencians a les cassoles catalanes, els calders murcians i els arrossos del nord.
- **Bilad al-Xam** ({sham} plats): Palestina, el Líban, Síria i Jordània — maqluba, mansaf, mujaddara, verdures farcides, arrossos de festa i dolços, i les cuines de la diàspora a l'Amèrica Llatina.
- **Tailàndia** ({thai} plats): l'arròs glutinós del nord i d'Isan, l'arròs jasmí de les planes centrals, arrossos de cort i rituals, farinetes, arrossos fregits i postres d'arròs.

## Com s'investiga cada plat
Cada pàgina es basa en fonts publicades: receptaris, treballs acadèmics, projectes patrimonials i municipals, hemeroteques i, per als plats històrics, textos medievals i otomans. Les fonts apareixen en cada recepta, a **Fonts**. Quan la documentació és escassa, una nota ⚠️ ho indica; les diferències entre pobles solen vindre del testimoni de cuiners i es presenten com a tals. Les receptes històriques es marquen com a reconstruccions amb una adaptació moderna honesta. Els orígens discutits es descriuen, no es decidixen.

## Llengües, fotos i il·lustracions
L'atles s'escriu en anglés i es traduïx a l'espanyol, al català/valencià, al tai i a l'àrab. Les fotos ({photos} per ara) provenen de Wikimedia Commons amb llicències lliures i s'acrediten en cada pàgina i en la pàgina de [crèdits fotogràfics](credits); els plats sense una foto lliure correcta mostren una il·lustració del plat en el seu recipient tradicional, dibuixada a partir de la recepta.

## Correccions
Heu trobat un error, una variant que falta o una font millor? [Obriu una incidència](https://github.com/hussmartinez/khaorroz/issues). Les notes completes de recerca són a [notes de recerca](notes).`,
  th: `Khaorroz คือแผนที่อาหารข้าวดั้งเดิมแบบหลายภาษาที่เปิดให้ใช้ฟรี รวบรวมประวัติ ความแตกต่างของแต่ละท้องถิ่น และสูตรละเอียดของแต่ละจาน ชื่อนี้รวมคำไทย *ข้าว* (ทั้งเมล็ดข้าวและมื้ออาหาร) กับคำสเปน *arroz* ซึ่งมาจากภาษาอาหรับ *ar-ruzz* สามครัว หนึ่งเมล็ดข้าว

## สามวัฒนธรรมข้าว
- **สเปน** ({spain} จาน): ตั้งแต่ปาเอยาและข้าวอบของบาเลนเซีย ไปจนถึงข้าวหม้อดินของกาตาลุญญา ข้าวหม้อเหล็กของมูร์เซีย และข้าวของภาคเหนือ
- **บิลาดอัชชาม** ({sham} จาน): ปาเลสไตน์ เลบานอน ซีเรีย และจอร์แดน — มักลูบา มันซัฟ มุญัดดะเราะห์ ผักยัดไส้ ข้าวงานเลี้ยงและข้าวหวาน รวมถึงครัวของชาวพลัดถิ่นในละตินอเมริกา
- **ไทย** ({thai} จาน): ข้าวเหนียวภาคเหนือและอีสาน ข้าวหอมมะลิภาคกลาง ข้าวในราชสำนักและพิธีกรรม ข้าวต้ม ข้าวผัด และขนมจากข้าว

## วิธีค้นคว้าแต่ละจาน
ทุกหน้าอ้างอิงจากแหล่งข้อมูลที่ตีพิมพ์ ได้แก่ ตำราอาหาร งานวิชาการ โครงการด้านมรดกวัฒนธรรมและท้องถิ่น คลังหนังสือพิมพ์ และสำหรับอาหารโบราณ ใช้ตำรายุคกลางและยุคออตโตมัน แหล่งอ้างอิงแสดงไว้ในแต่ละสูตรที่หัวข้อ **แหล่งอ้างอิง** หากหลักฐานมีน้อยจะมีหมายเหตุ ⚠️ บอกไว้ ความต่างระดับหมู่บ้านมักมาจากคำบอกเล่าของผู้ปรุงและระบุไว้เช่นนั้น สูตรโบราณระบุว่าเป็นการสร้างขึ้นใหม่พร้อมวิธีทำแบบปัจจุบัน ส่วนที่มาที่ยังถกเถียงกันจะอธิบายไว้โดยไม่ตัดสิน

## ภาษา ภาพถ่าย และภาพวาด
เนื้อหาเขียนเป็นภาษาอังกฤษและแปลเป็นภาษาสเปน กาตาลา/บาเลนเซีย ไทย และอาหรับ ภาพถ่ายอาหาร (ขณะนี้ {photos} ภาพ) มาจาก Wikimedia Commons ภายใต้สัญญาอนุญาตแบบเสรี และให้เครดิตไว้ทุกหน้าและที่หน้า[เครดิตภาพถ่าย](credits) อาหารที่ไม่มีภาพเสรีที่ถูกต้องจะแสดงภาพวาดของอาหารในภาชนะดั้งเดิม ซึ่งวาดขึ้นจากสูตร

## แจ้งแก้ไข
พบข้อผิดพลาด สูตรท้องถิ่นที่ขาดไป หรือแหล่งข้อมูลที่ดีกว่า? โปรด[แจ้งที่นี่](https://github.com/hussmartinez/khaorroz/issues) บันทึกการค้นคว้าฉบับเต็มอยู่ที่หน้า[บันทึกการค้นคว้า](notes)`,
  ar: `خاوروز أطلس مجاني متعدد اللغات لأطباق الأرز التقليدية: تاريخها، واختلافاتها من بلدة إلى أخرى، ووصفة مفصّلة لكل طبق. يجمع الاسم بين الكلمة التايلاندية *خاو* (الأرز، والوجبة أيضًا) والإسبانية *أروث* المأخوذة من العربية *الرُّز*: ثلاثة مطابخ وحبّة واحدة.

## ثلاثة تقاليد للأرز
- **إسبانيا** ({spain} طبقًا): من البايلا والأرز المخبوز في بلنسية إلى طواجن كتالونيا وقدور مرسية وأرز الشمال.
- **بلاد الشام** ({sham} طبقًا): فلسطين ولبنان وسوريا والأردن — المقلوبة والمنسف والمجدرة والمحاشي وأرز الولائم والحلويات، ومطابخ المهجر في أمريكا اللاتينية.
- **تايلاند** ({thai} طبقًا): الأرز الدبق في الشمال وإيسان، وأرز الياسمين في السهول الوسطى، وأرز البلاط والطقوس، والعصائد، والأرز المقلي، وحلويات الأرز.

## كيف يُبحث كل طبق
تعتمد كل صفحة على مصادر منشورة: كتب الطبخ، والأعمال الأكاديمية، ومشاريع التراث والبلديات، وأرشيف الصحف، ولأطباق التاريخ نصوص من العصور الوسطى والعهد العثماني. تُدرج المصادر في كل وصفة تحت **المصادر**. وحين تكون الأدلة قليلة تشير إلى ذلك ملاحظة ⚠️، وغالبًا ما تأتي الاختلافات بين البلدات من روايات الطهاة وتُعرض بوصفها كذلك. وتُوسم الوصفات التاريخية بأنها إعادة بناء مع تكييف حديث أمين. أما الأصول المتنازع عليها فتُوصف ولا يُحسم فيها.

## اللغات والصور والرسوم
يُكتب الأطلس بالإنجليزية ويُترجم إلى الإسبانية والكتالانية/البلنسية والتايلاندية والعربية. صور الأطباق ({photos} حتى الآن) من ويكيميديا كومنز بتراخيص حرّة، وتُنسب في كل صفحة وفي صفحة [حقوق الصور](credits)؛ والأطباق التي لا توجد لها صورة حرّة صحيحة تظهر برسم للطبق في إنائه التقليدي مرسوم انطلاقًا من وصفته.

## التصحيحات
هل وجدت خطأً أو اختلافًا ناقصًا أو مصدرًا أفضل؟ [افتح بلاغًا](https://github.com/hussmartinez/khaorroz/issues). ملاحظات البحث الكاملة في صفحة [ملاحظات البحث](notes).`,
};
