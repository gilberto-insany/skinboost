// Code-native brand assets: original vector wordmark and monogram, no redrawing.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const media = resolve(root, "public/media/figma-final");
const output = resolve(root, "public");
const orb = await readFile(resolve(media, "orb-glass.svg"), "utf8");
const mark = orb.match(/<!-- Exact second o path[\s\S]*?<path d="([^"]+)"/)[1];
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>SkinBoost</title><rect width="64" height="64" rx="16" fill="#0e2820"/><g transform="translate(32 32) scale(.84) translate(-301.394 -58.811)" fill="#c7df84"><path d="${mark}"/></g></svg>`;
await writeFile(resolve(output, "favicon.svg"), favicon);
const icon = await sharp(Buffer.from(favicon)).resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = 32;
ico[7] = 32;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(icon.length, 14);
ico.writeUInt32LE(22, 18);
await writeFile(resolve(output, "favicon.ico"), Buffer.concat([ico, icon]));
await sharp(Buffer.from(favicon))
  .resize(180, 180)
  .png()
  .toFile(resolve(output, "apple-touch-icon.png"));

const logo = (await readFile(resolve(media, "header-logo-light.svg"), "utf8"))
  .replace(/<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "");
const photo = (
  await sharp(resolve(media, "hero2-2.webp")).png().toBuffer()
).toString("base64");
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="shade"><stop stop-color="#0e2820"/><stop offset=".46" stop-color="#0e2820"/><stop offset=".72" stop-color="#0e2820" stop-opacity="0"/></linearGradient></defs>
  <rect width="1200" height="630" fill="#0e2820"/>
  <image href="data:image/png;base64,${photo}" x="490" y="0" width="710" height="630" preserveAspectRatio="xMidYMid slice"/>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <g transform="translate(64 54) scale(1.28)">${logo}</g>
  <g font-family="Arial, Helvetica, sans-serif" fill="#e3ece4">
    <text x="64" y="208" font-size="14" letter-spacing="2">CIÊNCIA SENSÍVEL. CUIDADO PESSOAL.</text>
    <text x="60" y="298" font-size="66" font-weight="600" letter-spacing="-2">Sua pele.</text>
    <text x="60" y="374" font-size="66" font-weight="600" letter-spacing="-2">Seu próximo passo.</text>
    <text x="64" y="438" font-size="22" fill="#c7d8c9">Uma rotina que começa por entender você.</text>
    <text x="64" y="576" font-size="15" fill="#c7d8c9">skinboost.insany.chatgpt.site</text>
  </g>
</svg>`;
await mkdir(resolve(output, "social"), { recursive: true });
await sharp(Buffer.from(card))
  .jpeg({ quality: 90, mozjpeg: true })
  .toFile(resolve(output, "social/skinboost-share.jpg"));
console.log("Brand icons and 1200×630 social card generated.");
