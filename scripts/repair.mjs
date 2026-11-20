#!/usr/bin/env node
// Auto-repair: applies the fixes from the last render report that are deterministic and safe.
//
// Usage: npx @opency/cli repair <piece id | path> [--brand slug] [--dry-run] [--json]
//
// Fixes (only these; see lib/repair.mjs):
//   headline_orphan     adds `text-wrap: balance` to the headline
//   logo_low_contrast   switches the logo to the variant for the slide's surface (brand.json → logos)
//   material_drift      unifies data-texture to the brand default (brand.json → defaults.texture)
//   pager_numbering     renumbers <span id="pager">NN/TT</span> from file order   (not a render code)
//   html_lang           sets <html lang> to piece.json → language                  (not a render code)
//
// Never touched: wording, hashtags, figures, alt text, colors, layout, images, type sizes. Those findings are
// listed as skipped with what to do. A version is saved first ("before auto-repair"). Does not render.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, PKG, parseArgs, readJSON, readText, loadBrand, brandOf, brandDir, resolvePiece } from "./lib/project.mjs";
import { planRepairs, relativeSrc } from "./lib/repair.mjs";

const args = parseArgs(process.argv.slice(2));
const json = !!args.json, dryRun = !!args["dry-run"];
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const USAGE = "Usage: npx @opency/cli repair <piece id | path> [--brand slug] [--dry-run] [--json]";

let pieceDir;
try { pieceDir = await resolvePiece(args._[0], args); } catch (e) { fail(`${e.message}\n${USAGE}`); }
const pieceRef = args._[0];

const report = await readJSON(path.join(pieceDir, "render/report.json"), null);
if (!report || !Array.isArray(report.slides)) fail(`No render report for this piece (render/report.json). Render first: npx @opency/cli render ${pieceRef}`);

const piece = await readJSON(path.join(pieceDir, "piece.json"), {});
const brandSlug = brandOf(pieceDir);
const brand = await loadBrand(brandSlug);
const bdir = brandDir(brandSlug);

const files = (await readdir(pieceDir)).filter((f) => /^slide-\d+\.html$/.test(f)).sort();
const slides = await Promise.all(files.map(async (file) => ({ file, html: await readFile(path.join(pieceDir, file), "utf8") })));
const baseCss = (await readText(path.join(ROOT, "templates/base/base.css"))) || (await readText(path.join(PKG, "templates/base/base.css")));

const plan = planRepairs({
  report, piece, brand, slides, baseCss,
  logoSrc: (logo) => ({ src: relativeSrc(pieceDir, bdir, logo), exists: existsSync(path.join(bdir, logo)) }),
});
const changedFiles = Object.keys(plan.files).sort();

if (changedFiles.length && !dryRun) {
  // Save the current state first, so the repair can be undone with `version restore`.
  const version = path.join(path.dirname(fileURLToPath(import.meta.url)), "version.mjs");
  const saved = spawnSync(process.execPath, [version, pieceDir, "save", "before auto-repair"], { encoding: "utf8" });
  if (saved.status !== 0) fail(`Could not save a version before repairing; nothing was changed.\n${(saved.stderr || saved.stdout || "").trim()}`);
  for (const file of changedFiles) {
    if (path.basename(file) !== file || !/^slide-\d+\.html$/.test(file)) fail(`Refusing to write outside the piece: ${file}`);
    await writeFile(path.join(pieceDir, file), plan.files[file]);
  }
}

const id = piece.id ?? report.piece ?? path.basename(pieceDir);
if (json) {
  console.log(JSON.stringify({ piece: id, fixed: plan.fixed, skipped: plan.skipped, changedFiles }, null, 2));
} else {
  const slide = (s) => (typeof s === "number" ? `slide ${String(s).padStart(2, "0")}` : String(s));
  const head = (i) => [slide(i.slide), i.code, i.where].filter(Boolean).join(" ");
  for (const f of plan.fixed) console.log(`${dryRun ? "→" : "✓"} ${head(f)} — ${dryRun ? "would have " : ""}${f.action}`);
  for (const s of plan.skipped) console.log(`· ${head(s)} — skipped: ${s.reason}`);
  if (!plan.fixed.length && !plan.skipped.length) console.log("Nothing to repair: the report has no findings.");
  const n = plan.fixed.length, m = plan.skipped.length;
  console.log(`\n${n} fix(es) ${dryRun ? "would be applied" : "applied"} in ${changedFiles.length} file(s) · ${m} finding(s) left for you.`);
  if (dryRun) console.log(changedFiles.length ? "Dry run: nothing was written. Run again without --dry-run to apply." : "Dry run: nothing to write.");
  else if (changedFiles.length) console.log(`Saved the previous state as a version ("before auto-repair"). Render again to confirm: npx @opency/cli render ${pieceRef}`);
  else console.log(`No file changed.${m ? ` Fix what is left by hand, then render again: npx @opency/cli render ${pieceRef}` : ""}`);
}
