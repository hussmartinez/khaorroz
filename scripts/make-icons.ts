import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
const pub = process.cwd() + "/public/"  // run from apps/web: bun ../../scripts/make-icons.ts;
const svg = readFileSync(pub + "favicon.svg", "utf8").trim();
const png = (size: number, pad = 0, bg?: string) => {
  const inner = svg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">', "").replace(/<\/svg>$/, "");
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${64 + 2 * pad} ${64 + 2 * pad}" width="${size}" height="${size}">${bg ? `<rect x="${-pad}" y="${-pad}" width="${64 + 2 * pad}" height="${64 + 2 * pad}" fill="${bg}"/>` : ""}${inner}</svg>`;
  return new Resvg(s, { fitTo: { mode: "width", value: size } }).render().asPng();
};
writeFileSync(pub + "apple-touch-icon.png", png(180, 8, "#fbf5ea"));
writeFileSync(pub + "icons/icon-192.png", png(192, 6, "#fbf5ea"));
writeFileSync(pub + "icons/icon-512.png", png(512, 6, "#fbf5ea"));
// favicon.ico = ICO container with one embedded 32×32 PNG
const p32 = png(32);
const ico = Buffer.alloc(22 + p32.length);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(p32.length, 14); ico.writeUInt32LE(22, 18);
Buffer.from(p32).copy(ico, 22);
writeFileSync(pub + "favicon.ico", ico);
console.log("icons written");
