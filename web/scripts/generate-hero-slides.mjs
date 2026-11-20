// Copies the demo carousel's real renders into public/hero/ as small WebP files.
//   pnpm hero-slides   (after `node ../bin/opency.mjs render example-carousel --brand _demo`)
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const from = path.join(here, "../../brands/_demo/pieces/example-carousel/render");
const to = path.join(here, "../public/hero");

await mkdir(to, { recursive: true });
for (let n = 1; n <= 5; n++) {
  const name = `slide-0${n}`;
  const { size } = await sharp(path.join(from, `${name}.png`))
    .resize({ width: 600 })
    .webp({ quality: 84 })
    .toFile(path.join(to, `${name}.webp`));
  console.log(`${name}.webp ${Math.round(size / 1024)} kB`);
}
