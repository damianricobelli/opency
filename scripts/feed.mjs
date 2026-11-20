#!/usr/bin/env node
// Reviews the whole feed and builds the profile preview.
//
// Usage: npx opentcy feed [-- --from 2026-11-01] [--candidate pieces/<id>]
//
// Rules (over pieces with a plannedDate, sorted by date; folders starting with _ are excluded):
//   · never 3 pieces in a row with a flat background, nor 3 in a row with a photo
//   · a cover hook is not repeated (nor nearly repeated) within 30 days
//   · a cover photo is never reused; no photo comes back within 21 days
//   · no more than 2 pieces in a row from the same category
// Every piece needs to be rendered (it reads render/report.json).
// Writes feed-preview.png: a 3-column grid with the 3:4 crop the Instagram profile shows.

import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ROOT, parseArgs, readJSON, resolveBrand, brandDir } from "./lib/project.mjs";
import { jaccard } from "./lib/copy-lint.mjs";

const args = parseArgs(process.argv.slice(2));
let BRAND; try { BRAND = await resolveBrand(args); } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
const BDIR = brandDir(BRAND);
const dirs = (await readdir(path.join(BDIR, "pieces"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory() && !d.name.startsWith("_"));

const items = [];
for (const d of dirs) {
  const dir = path.join(BDIR, "pieces", d.name);
  const piece = await readJSON(path.join(dir, "piece.json"), null);
  const report = await readJSON(path.join(dir, "render/report.json"), null);
  if (!piece?.plannedDate) continue;
  if (["idea"].includes(piece.status)) continue;
  items.push({
    id: d.name, dir, date: piece.plannedDate, status: piece.status, category: piece.category,
    hook: piece.hook || report?.cover?.hook || "", mode: report?.summary?.mode ?? null,
    coverImages: report?.cover?.images ?? [], images: [...new Set((report?.slides ?? []).flatMap((s) => s.images))],
    rendered: !!report,
  });
}
items.sort((a, b) => a.date.localeCompare(b.date));
const days = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
const issues = [];
const add = (code, ids, msg) => issues.push({ code, ids, msg });

for (const it of items) if (!it.rendered) add("not_rendered", [it.id], "not rendered: run npx opentcy render " + it.id);

for (let i = 2; i < items.length; i++) {
  const w = items.slice(i - 2, i + 1);
  if (w.every((x) => x.mode && x.mode === w[0].mode)) add("feed_rhythm", w.map((x) => x.id), `3 pieces in a row with a ${w[0].mode === "flat" ? "flat" : "photo"} background: alternate`);
  if (w.every((x) => x.category && x.category === w[0].category)) add("category_streak", w.map((x) => x.id), `3 pieces in a row in category "${w[0].category}"`);
}
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
  const a = items[i], b = items[j];
  const d = days(a.date, b.date);
  if (a.hook && b.hook && d <= 30 && jaccard(a.hook, b.hook) >= 0.5) add("hook_reused", [a.id, b.id], `nearly identical hooks ${d} days apart: "${a.hook}" / "${b.hook}"`);
  for (const img of b.coverImages) if (a.coverImages.includes(img)) add("cover_photo_reused", [a.id, b.id], `same cover photo: ${img}`);
  if (d < 21) for (const img of b.images) if (a.images.includes(img)) add("photo_too_soon", [a.id, b.id], `${img} comes back after ${d} days (min. 21)`);
}

// --- Profile preview (most recent at the top left) ---
const show = items.filter((x) => x.rendered).slice(-12).reverse();
if (show.length) {
  const tw = 360, th = 480, gap = 3;
  const tiles = [];
  for (const [i, it] of show.entries()) {
    const src = path.join(it.dir, "render/slide-01.png");
    try {
      const m = await sharp(src).metadata();
      const cropW = Math.min(m.width, Math.round(m.height * 0.75)), cropH = Math.min(m.height, Math.round(cropW / 0.75));
      const input = await sharp(src).extract({ left: Math.round((m.width - cropW) / 2), top: Math.round((m.height - cropH) / 2), width: cropW, height: cropH }).resize(tw, th, { kernel: "lanczos3" }).png().toBuffer();
      tiles.push({ input, left: (i % 3) * (tw + gap), top: Math.floor(i / 3) * (th + gap) });
    } catch {}
  }
  const rows = Math.ceil(show.length / 3);
  await sharp({ create: { width: 3 * tw + 2 * gap, height: rows * th + (rows - 1) * gap, channels: 3, background: "#ffffff" } }).composite(tiles).png().toFile(path.join(BDIR, "feed-preview.png"));
}

console.log(`${BRAND}: ${items.length} dated piece(s).`);
for (const it of items) console.log(`  ${it.date}  ${(it.mode ?? "—").padEnd(5)}  ${(it.category ?? "").padEnd(14)}  ${it.id}  "${it.hook}"`);
console.log(issues.length ? "\nFindings:" : "\nNo rhythm or repetition findings.");
for (const i of issues) console.log(`  ⚠ ${i.code} — ${i.msg} [${i.ids.join(", ")}]`);
if (show.length) console.log(`\n→ brands/${BRAND}/feed-preview.png (profile grid, 3:4 crop)`);
