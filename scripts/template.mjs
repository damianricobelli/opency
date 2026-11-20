#!/usr/bin/env node
// Brand templates: approved pieces saved to start the next one from.
//
//   npx @opency/cli template save <piece> <name> [--note "what it is for"]
//   npx @opency/cli template list
//   Both: --brand <slug>   ·   --json
//
// A template is the piece's slides and piece.json under brands/<brand>/templates/<name>/, with a short
// README. Use it with `npx @opency/cli new <slug> --template <name>`.

import { readFile, writeFile, readdir, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ROOT, parseArgs, readJSON, writeJSON, resolveBrand, resolvePiece, brandDir, brandOf, slugify } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const [cmd, target, rawName] = args._;
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const out = (data, text) => console.log(args.json ? JSON.stringify(data, null, 2) : text);

try {
  if (cmd === "save") {
    if (!target || !rawName) fail("Usage: npx @opency/cli template save <piece> <name> [--note \"…\"]");
    const dir = await resolvePiece(target, args);
    const brand = brandOf(dir);
    if (brand.startsWith("_")) fail("Demo brands take no templates: create your own brand.");
    const name = slugify(rawName);
    const tdir = path.join(brandDir(brand), "templates", name);
    if (existsSync(tdir) && !args.force) fail(`Template "${name}" already exists. Pass --force to replace it.`);
    const piece = await readJSON(path.join(dir, "piece.json"));
    const slides = (await readdir(dir)).filter((f) => /^slide-\d+\.html$/.test(f)).sort();
    await mkdir(tdir, { recursive: true });
    for (const f of slides) await copyFile(path.join(dir, f), path.join(tdir, f));
    // The template keeps the structure and the direction, not the life of the piece it came from.
    const { results, feedback, history, campaign, status, plannedDate, ...keep } = piece;
    await writeJSON(path.join(tdir, "piece.json"), { ...keep, status: "template", templateOf: piece.id });
    const note = typeof args.note === "string" ? args.note : (piece.direction?.intent ? `For pieces that ${piece.direction.intent}.` : "Saved from an approved piece.");
    await writeFile(path.join(tdir, "README.md"), `# ${name}\n\n${note}\n\n- ${slides.length} slide(s), ${piece.format}: ${(piece.slides ?? []).map((s) => s.layout).join(" → ")}\n- Saved from \`${piece.id}\`. Keep the structure and the material; replace every text.\n`);
    out({ brand, template: name, dir: path.relative(ROOT, tdir), slides: slides.length }, `✓ ${path.relative(ROOT, tdir)}/ · ${slides.length} slide(s)\n  Use it: npx @opency/cli new <slug> --template ${name}`);
  } else if (cmd === "list") {
    const brand = await resolveBrand(args);
    const tdir = path.join(brandDir(brand), "templates");
    const rows = [];
    for (const d of (await readdir(tdir, { withFileTypes: true }).catch(() => [])).filter((x) => x.isDirectory())) {
      const p = await readJSON(path.join(tdir, d.name, "piece.json"), {});
      rows.push({ name: d.name, format: p.format, slides: p.slides?.length ?? 0, layouts: (p.slides ?? []).map((s) => s.layout), from: p.templateOf ?? null });
    }
    out(rows, rows.length ? rows.map((r) => `${r.name.padEnd(24)} ${String(r.format).padEnd(5)} ${r.slides} slide(s) · ${r.layouts.join(" → ")}`).join("\n") : `(${brand} has no templates yet: npx @opency/cli template save <piece> <name>)`);
  } else {
    console.log((await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  }
} catch (e) { fail(e.message); }
