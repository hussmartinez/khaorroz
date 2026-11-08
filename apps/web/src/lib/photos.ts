// Dish photos (content/images.json + content/images/*), resolved to astro:assets ImageMetadata so
// they are resized/re-encoded into hashed, immutable files.
import type { ImageMetadata } from "astro";
import { photoFor, type Lang } from "@arros/content";

const IMAGES = import.meta.glob<{ default: ImageMetadata }>("../../../../content/images/*.{webp,jpg,jpeg,png}", { eager: true });

export function dishPhoto(file: string, lang: Lang, fallbackAlt: string) {
  const photo = photoFor(file);
  if (!photo) return undefined;
  const name = "/" + photo.file.split("/").pop();
  const meta = Object.entries(IMAGES).find(([k]) => k.endsWith(name))?.[1].default;
  if (!meta) return undefined;
  return { meta, photo, alt: photo.alt?.[lang] ?? photo.alt?.en ?? fallbackAlt };
}
