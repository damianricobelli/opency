// Draws the PNG icons in public/ from the same mark as favicon.svg.
// Run after changing the mark: `pnpm icons`.
import { writeFile } from "node:fs/promises";
import { render } from "takumi-js";

const publicDir = new URL("../public/", import.meta.url);
const INK = "#1a1917";
const PAPER = "#faf9f7";
const BRAND = "#e5532d";

/** The mark on an ink square; `inset` leaves the safe zone a maskable icon needs. */
function icon(size, { rounded }) {
  const slideHeight = size * 0.56;
  const slideWidth = slideHeight * 0.78;
  const dot = size * 0.125;
  return `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;background:${INK};border-radius:${rounded ? size * 0.25 : 0}px">
    <div style="display:flex;position:relative;width:${slideWidth}px;height:${slideHeight}px;background:${PAPER};border-radius:${size * 0.09}px">
      <div style="position:absolute;right:${size * 0.06}px;bottom:${size * 0.06}px;width:${dot}px;height:${dot}px;border-radius:9999px;background:${BRAND}"></div>
    </div>
  </div>`;
}

async function png(size, options) {
  return render(icon(size, options), { width: size, height: size, format: "png" });
}

/** A PNG wrapped in the ICO container browsers still ask for at /favicon.ico. */
function ico(image, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(image.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, image]);
}

const files = {
  "favicon-96x96.png": await png(96, { rounded: true }),
  // iOS and maskable icons are cropped by the system: full-bleed squares.
  "apple-touch-icon.png": await png(180, { rounded: false }),
  "web-app-manifest-192x192.png": await png(192, { rounded: false }),
  "web-app-manifest-512x512.png": await png(512, { rounded: false }),
};
files["favicon.ico"] = ico(Buffer.from(await png(48, { rounded: true })), 48);

for (const [name, data] of Object.entries(files)) {
  await writeFile(new URL(name, publicDir), data);
  console.log(`${name}  ${data.length} bytes`);
}
