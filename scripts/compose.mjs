#!/usr/bin/env node
// Compose and edit pieces with data instead of HTML.
//
//   npx @opency/cli compose layouts [--json]                         every layout with its slots, budgets and sample copy
//   npx @opency/cli compose new <slug> --spec piece.json [--json]    creates the piece and fills every slide
//   npx @opency/cli compose edit <piece> --spec edits.json [--json]  changes texts, photos or metadata of an existing piece
//   npx @opency/cli compose slots <piece> [--json]                   the current text of every slot (to translate or review)
//   All of them: --brand <slug>.
//
// A spec for `new`:
//   { "title": "…", "format": "4:5", "date": "2026-12-01", "campaign": "winter", "intent": "teach",
//     "direction": { "thesis": "…", "signatureMove": "…", "avoid": ["…"] }, "hook": "…",
//     "captions": { "instagram": "…", "linkedin": "…" }, "sources": [ { "claim": "…", "source": "…" } ],
//     "slides": [ { "layout": "cover-type", "slots": { "kicker": "…", "headline": "A *sharp* promise", "support": "…" },
//                   "alt": "…", "claim": "…", "image": { "asset": "id" }, "bars": [22, 66] } ] }
// A slot set to null is removed (with its row or list item). `*word*` highlights one word in the accent color.
// For `edit`, each slide is { "n": 2, "slots": {…} } and only what you send changes.
//
// Texts that exceed a slot's budget, unknown slots and sample copy left in place are reported right away,
// before any render.

import { spawnSync } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, FORMATS, parseArgs, readJSON, writeJSON, resolveBrand, brandDir, resolvePiece, loadAssets, brandOf, slugify, today } from "./lib/project.mjs";
import { describeSlide, fillSlide } from "./lib/compose.mjs";

const args = parseArgs(process.argv.slice(2));
const [cmd, target] = args._;
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const out = (data, text) => console.log(args.json ? JSON.stringify(data, null, 2) : text);
const here = path.dirname(fileURLToPath(import.meta.url));
const LAYOUTS = path.join(ROOT, "templates/layouts");
const pad = (n) => String(n).padStart(2, "0");

async function library() {
  const lib = await readJSON(path.join(LAYOUTS, "piece.json"), { slides: [] });
  const rows = [];
  for (const s of lib.slides) {
    const html = await readFile(path.join(LAYOUTS, `slide-${pad(s.n)}.html`), "utf8").catch(() => null);
    if (html) rows.push({ layout: s.layout, ...describeSlide(html) });
  }
  return rows;
}
const sampleOf = (lib, layout) => Object.fromEntries((lib.find((l) => l.layout === layout)?.slots ?? []).map((s) => [s.id, s.text]));

async function readSpec() {
  if (typeof args.spec !== "string") fail("Missing --spec <file.json>");
  const spec = await readJSON(path.resolve(args.spec), null);
  if (!spec || typeof spec !== "object") fail(`Could not read ${args.spec} as JSON`);
  return spec;
}

function applyMeta(piece, spec) {
  for (const key of ["title", "hook", "category", "language"]) if (typeof spec[key] === "string") piece[key] = spec[key];
  if (spec.direction) piece.direction = { ...piece.direction, ...spec.direction };
  if (spec.captions) piece.captions = { ...piece.captions, ...spec.captions };
  if (Array.isArray(spec.sources)) piece.sources = spec.sources;
}

function summarize(piece, dir, slides, issues) {
  const errors = issues.filter((i) => i.severity === "error").length;
  return {
    piece: piece.id, dir: path.relative(ROOT, dir), format: piece.format, slides, issues,
    summary: { errors, warnings: issues.length - errors },
    next: errors ? "Fix the errors above with `compose edit` (or change the layout), then render." : `Render it: npx @opency/cli render ${piece.id}`,
  };
}
const human = (r) => [
  `${r.summary.errors ? "✗" : "✓"} ${r.dir} · ${r.format} · ${r.slides.length} slide(s)`,
  ...r.slides.map((s) => `  ${pad(s.n)} ${String(s.layout).padEnd(14)} filled: ${s.filled.join(", ") || "—"}`),
  ...r.issues.map((i) => `  ${i.severity === "error" ? "ERROR" : "warning"} ${i.code} slide ${pad(i.slide)} ${i.where} — ${i.msg}`),
  `→ ${r.next}`,
].join("\n");

try {
  if (cmd === "layouts") {
    const lib = await library();
    out(lib, lib.map((l) => `${l.layout}${l.photo ? "  (photo)" : ""}${l.bars ? `  (${l.bars} bars)` : ""}\n${l.slots.map((s) => `    ${s.id.padEnd(14)} ${String(s.max ?? "—").padStart(3)}  ${s.text}`).join("\n")}`).join("\n\n") + "\n\nEach line: slot id · character budget · sample copy (always replace it).");
  } else if (cmd === "new") {
    if (!target) fail("Usage: npx @opency/cli compose new <slug> --spec piece.json");
    const spec = await readSpec();
    if (!Array.isArray(spec.slides) || !spec.slides.length) fail("The spec needs a `slides` list with at least one slide.");
    const lib = await library();
    const names = new Set(lib.map((l) => l.layout));
    spec.slides.forEach((s, i) => { if (!names.has(s.layout)) fail(`Slide ${i + 1}: unknown layout "${s.layout}". Layouts: ${[...names].join(", ")}`); });
    if (spec.format && !FORMATS[spec.format]) fail(`Invalid format "${spec.format}". Options: ${Object.keys(FORMATS).join(", ")}`);
    if (spec.slides.length > 1 && new Set(spec.slides.map((s) => s.layout)).size === 1) console.error("  ⚠ every slide uses the same layout: vary the structure.");

    const brand = await resolveBrand(args);
    const date = spec.date ?? today();
    const flags = Object.entries({ format: spec.format, campaign: spec.campaign, intent: spec.intent ?? spec.direction?.intent, category: spec.category }).filter(([, v]) => typeof v === "string" && v).flatMap(([k, v]) => [`--${k}`, v]);
    const made = spawnSync(process.execPath, [path.join(here, "new-piece.mjs"), target, "--layouts", spec.slides.map((s) => s.layout).join(","), "--date", date, "--brand", brand, ...flags], { encoding: "utf8", env: { ...process.env, OPENCY_HOME: ROOT } });
    if (made.status !== 0) fail((made.stderr || made.stdout).replace(/^✗ /, "").trim());

    const dir = path.join(brandDir(brand), "pieces", `${date}-${slugify(target)}`);
    const assets = await loadAssets(brand);
    const piece = await readJSON(path.join(dir, "piece.json"));
    const slides = [], issues = [];
    for (const [i, s] of spec.slides.entries()) {
      const n = i + 1, file = path.join(dir, `slide-${pad(n)}.html`);
      const r = fillSlide(await readFile(file, "utf8"), s, { n, sample: sampleOf(lib, s.layout), assets });
      await writeFile(file, r.html);
      issues.push(...r.issues);
      slides.push({ n, layout: s.layout, filled: r.filled, left: r.left });
      const meta = piece.slides[i];
      meta.written = r.filled; // slots that already carry the brand's copy, even when it matches the sample
      for (const key of ["role", "claim", "alt"]) if (typeof s[key] === "string") meta[key] = s[key];
    }
    applyMeta(piece, spec);
    await writeJSON(path.join(dir, "piece.json"), piece);
    const result = summarize(piece, dir, slides, issues);
    out(result, human(result));
  } else if (cmd === "edit") {
    const dir = await resolvePiece(target, args);
    const spec = await readSpec();
    const lib = await library();
    const piece = await readJSON(path.join(dir, "piece.json"));
    const assets = await loadAssets(brandOf(dir));
    const slides = [], issues = [];
    for (const s of spec.slides ?? []) {
      const meta = piece.slides.find((x) => x.n === s.n);
      if (!meta) fail(`The piece has no slide ${s.n} (it has ${piece.slides.length}).`);
      const file = path.join(dir, meta.file ?? `slide-${pad(s.n)}.html`);
      const r = fillSlide(await readFile(file, "utf8"), s, { n: s.n, sample: sampleOf(lib, meta.layout), assets, written: meta.written ?? [] });
      await writeFile(file, r.html);
      issues.push(...r.issues);
      slides.push({ n: s.n, layout: meta.layout, filled: r.filled, left: r.left });
      meta.written = [...new Set([...(meta.written ?? []), ...r.filled])];
      for (const key of ["role", "claim", "alt"]) if (typeof s[key] === "string") meta[key] = s[key];
    }
    applyMeta(piece, spec);
    piece.version = (piece.version ?? 1) + 1;
    piece.history = [...(piece.history ?? []), { version: piece.version, date: today(), change: typeof spec.change === "string" ? spec.change : "edited copy", by: "agente" }];
    await writeJSON(path.join(dir, "piece.json"), piece);
    const result = summarize(piece, dir, slides, issues);
    out(result, human(result));
  } else if (cmd === "slots") {
    const dir = await resolvePiece(target, args);
    const piece = await readJSON(path.join(dir, "piece.json"));
    const files = (await readdir(dir)).filter((f) => /^slide-\d+\.html$/.test(f)).sort();
    const slides = [];
    for (const [i, f] of files.entries()) slides.push({ n: i + 1, layout: piece.slides?.[i]?.layout ?? null, alt: piece.slides?.[i]?.alt ?? "", ...describeSlide(await readFile(path.join(dir, f), "utf8")) });
    const data = { piece: piece.id, language: piece.language, title: piece.title, hook: piece.hook, captions: piece.captions, slides };
    out(data, slides.map((s) => `slide ${pad(s.n)} · ${s.layout ?? "custom"}\n${s.slots.map((x) => `    ${x.id.padEnd(14)} ${x.text}`).join("\n")}`).join("\n\n"));
  } else {
    console.log((await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  }
} catch (e) { fail(e.message); }
