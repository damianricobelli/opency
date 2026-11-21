#!/usr/bin/env node
// Compose and edit pieces with data instead of HTML.
//
//   npx @opency/cli compose layouts [--json]                         every layout with its slots, budgets and sample copy
//   npx @opency/cli compose new <slug> --spec piece.json [--json]    creates the piece and fills every slide
//   npx @opency/cli compose edit <piece> --spec edits.json [--json]  changes texts, photos or metadata of an existing piece
//   npx @opency/cli compose slots <piece> [--json]                   the current text of every slot (to translate or review)
//   npx @opency/cli compose recipes [--json]                         every recipe of the compositor: what it shows and what it needs
//   npx @opency/cli compose design <slug> --spec intent.json [--dry] [--json]   from intent: the compositor picks the layout of every slide
//   npx @opency/cli compose variant <piece> [--slide N] [--json]     "another version": same words, another recipe (saved as a new version)
//   All of them: --brand <slug>.
//
// An intent for `design` says what each slide has to say, not how it looks:
//   { "title": "…", "format": "4:5", "direction": { "thesis": "…", "dominantMode": "type|photo|data|artifact|mixed",
//       "density": "airy|balanced|dense", "variance": "calm|varied", "continuityDevice": "pattern", "pattern": "grid|dots|rings|rays|glow",
//       "signatureMove": "…", "avoid": ["recipe, layout or family"] },
//     "slides": [ { "role": "hook", "kicker": "…", "claim": "…", "emphasis": "word", "support": "…", "labels": ["…", "…"], "alt": "…" },
//                 { "role": "proof", "claim": "…", "proof": { "kind": "number", "value": "38", "unit": "%" } },
//                 { "role": "close", "claim": "…", "cta": "…" } ] }
// The answer names the recipe chosen for every slide and why. When no recipe can show a slide's content,
// nothing is created and the answer says what does not fit (COMPOSITION_UNRESOLVED).
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
import { resolvePiece as resolveRecipes, describeRecipes, PROOF_SHAPES, RECIPES } from "./lib/recipes.mjs";
import { prepareSlide, readLayout, accentLegibility } from "./lib/piece.mjs";
import { loadTaste } from "./lib/taste.mjs";
import { loadBrand } from "./lib/project.mjs";
import { ensureWorkspace } from "./lib/project.mjs";

ensureWorkspace();

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

/** layout → { slotId: { max, role } }: the budgets the compositor checks copy against. */
async function budgets() {
  return Object.fromEntries((await library()).map((l) => [l.layout, Object.fromEntries(l.slots.map((x) => [x.id, { max: x.max, role: x.role }]))]));
}
const accentOk = async (brand) => accentLegibility(await readFile(path.join(brandDir(brand), "tokens.css"), "utf8").catch(() => ""));
const planText = (slides, pattern) => [
  ...slides.map((x) => `  ${pad(x.n)} ${x.recipe.padEnd(16)} ${String(x.surface ?? "photo").padEnd(13)} ${x.reason}${x.notes.length ? `\n     ⚠ ${x.notes.join("; ")}` : ""}${x.alternatives.length ? `\n     also possible: ${x.alternatives.slice(0, 4).map((a) => a.recipe).join(", ")}` : ""}`),
  pattern ? `  pattern: ${pattern}` : null,
].filter(Boolean).join("\n");

/** Creates the piece from a layout spec (each slide: layout + slots) and fills every slide. */
async function createPiece(target, spec) {
  if (!Array.isArray(spec.slides) || !spec.slides.length) fail("The spec needs a `slides` list with at least one slide.");
  const lib = await library();
  const names = new Set(lib.map((l) => l.layout));
  spec.slides.forEach((s, i) => { if (!names.has(s.layout)) fail(`Slide ${i + 1}: unknown layout "${s.layout}". Layouts: ${[...names].join(", ")}`); });
  if (spec.format && !FORMATS[spec.format]) fail(`Invalid format "${spec.format}". Options: ${Object.keys(FORMATS).join(", ")}`);
  if (spec.slides.length > 1 && new Set(spec.slides.map((s) => s.layout)).size === 1) console.error("  ⚠ every slide uses the same layout: vary the structure.");

  const brand = await resolveBrand(args);
  const date = spec.date ?? today();
  const flags = Object.entries({ format: spec.format, campaign: spec.campaign, intent: spec.intent ?? spec.direction?.intent, category: spec.category, pattern: spec.pattern, surfaces: spec.surfaces?.some(Boolean) ? spec.surfaces.map((x) => x || "-").join(",") : null }).filter(([, v]) => typeof v === "string" && v).flatMap(([k, v]) => [`--${k}`, v]);
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
  return { result: summarize(piece, dir, slides, issues), dir };
}

try {
  if (cmd === "layouts") {
    const lib = await library();
    out(lib, lib.map((l) => `${l.layout}${l.photo ? "  (photo)" : ""}${l.bars ? `  (${l.bars} bars)` : ""}\n${l.slots.map((s) => `    ${s.id.padEnd(14)} ${String(s.max ?? "—").padStart(3)}  ${s.text}`).join("\n")}`).join("\n\n") + "\n\nEach line: slot id · character budget · sample copy (always replace it).");
  } else if (cmd === "new") {
    if (!target) fail("Usage: npx @opency/cli compose new <slug> --spec piece.json");
    const spec = await readSpec();
    const { result } = await createPiece(target, spec);
    out(result, human(result));
  } else if (cmd === "recipes") {
    const rows = describeRecipes(await budgets());
    out({ recipes: rows, proof: PROOF_SHAPES }, rows.map((r) => `${r.recipe.padEnd(16)} ${r.family.padEnd(10)} ${r.layout.padEnd(14)} ${r.proof ? `proof: ${r.proof}` : `shows: ${r.shows.join(", ")}`}${r.photo ? "  (photo)" : ""}\n    ${r.what}`).join("\n") + "\n\nProof shapes:\n" + Object.values(PROOF_SHAPES).map((x) => `  ${x}`).join("\n"));
  } else if (cmd === "design") {
    if (!target) fail("Usage: npx @opency/cli compose design <slug> --spec intent.json [--dry]");
    const intent = await readSpec();
    if (!Array.isArray(intent.slides) || !intent.slides.length) fail("The intent needs a `slides` list: one entry per slide with its role and claim.");
    if (intent.format && !FORMATS[intent.format]) fail(`Invalid format "${intent.format}". Options: ${Object.keys(FORMATS).join(", ")}`);
    const brand = await resolveBrand(args);
    const plan = resolveRecipes(intent, { budgets: await budgets(), assets: await loadAssets(brand), format: intent.format ?? "4:5", taste: await loadTaste(brand), accentOk: await accentOk(brand) });
    const chosen = plan.slides.map(({ spec, key, ...rest }) => rest);
    if (plan.unresolved.length) {
      const data = { error: "COMPOSITION_UNRESOLVED", unresolved: plan.unresolved, resolved: chosen, hint: "Nothing was created. Shorten the copy, split the slide, drop the field that does not fit, or pick another proof kind. `compose recipes` lists what each recipe holds." };
      out(data, `✗ COMPOSITION_UNRESOLVED\n${plan.unresolved.map((u) => `  slide ${pad(u.n)}${u.role ? ` (${u.role})` : ""}\n${u.reasons.map((r) => `    ${r.recipe}: ${r.why}`).join("\n")}`).join("\n")}`);
      process.exit(1);
    }
    if (args.dry) { out({ dry: true, pattern: plan.pattern, slides: chosen }, planText(chosen, plan.pattern)); process.exit(0); }
    const { intent: _i, slides: _s, ...meta } = intent;
    const spec = { ...meta, slides: plan.slides.map((x) => x.spec), surfaces: plan.slides.map((x) => x.surface ?? ""), pattern: plan.pattern };
    const { result, dir } = await createPiece(target, spec);
    const piece = await readJSON(path.join(dir, "piece.json"));
    piece.intent = { direction: intent.direction ?? {}, slides: intent.slides, tried: plan.slides.map((x) => [x.key]) };
    piece.direction = { ...piece.direction, ...(intent.direction ?? {}), ...(plan.pattern ? { pattern: plan.pattern } : {}) };
    plan.slides.forEach((x, i) => Object.assign(piece.slides[i], { recipe: x.recipe, family: x.family, surface: x.surface, reason: x.reason }));
    await writeJSON(path.join(dir, "piece.json"), piece);
    const data = { ...result, pattern: plan.pattern, recipes: chosen };
    out(data, `${planText(chosen, plan.pattern)}\n${human(result)}`);
  } else if (cmd === "variant") {
    const dir = await resolvePiece(target, args);
    let piece = await readJSON(path.join(dir, "piece.json"));
    if (!piece.intent?.slides?.length) { out({ error: "RECOMPOSE_UNAVAILABLE", hint: "Only pieces made with `compose design` keep their intent. Change this one with `compose edit` or by hand." }, "✗ RECOMPOSE_UNAVAILABLE: this piece was not composed from intent."); process.exit(1); }
    const brandSlug = brandOf(dir), assets = await loadAssets(brandSlug);
    const only = args.slide ? Number(args.slide) : null;
    // What was already shown for a slide is pushed down; the slides that are not being changed keep their recipe.
    const tried = piece.intent.tried ?? piece.slides.map(() => []);
    const before = piece.slides.map((x) => `${x.recipe}@${x.surface ?? ""}`);
    let plan = resolveRecipes(piece.intent, { budgets: await budgets(), assets, format: piece.format, taste: await loadTaste(brandSlug), tried, accentOk: await accentOk(brandSlug) });
    const changed = plan.slides.filter((x) => x.key !== before[x.n - 1] && (!only || x.n === only) && !tried[x.n - 1]?.includes(x.key));
    if (!changed.length) { out({ error: "NO_ALTERNATIVE", hint: "No other recipe shows exactly this content. Change the copy or the proof to open more options." }, "✗ NO_ALTERNATIVE: no other recipe shows exactly this content."); process.exit(1); }
    const saved = spawnSync(process.execPath, [path.join(here, "version.mjs"), dir, "save", "before another version (variant)"], { encoding: "utf8", env: { ...process.env, OPENCY_HOME: ROOT } });
    if (saved.status !== 0) fail((saved.stderr || saved.stdout).trim());
    piece = await readJSON(path.join(dir, "piece.json"));
    const brand = await loadBrand(brandSlug), lib = await library();
    const slides = [], issues = [];
    for (const x of changed) {
      const meta = piece.slides[x.n - 1];
      const html = prepareSlide(await readLayout(x.layout), { brand, id: piece.id, n: x.n, total: piece.slides.length, format: piece.format, layout: x.layout, language: piece.language, surface: x.surface, pattern: piece.direction?.pattern ?? null });
      const r = fillSlide(html, x.spec, { n: x.n, sample: sampleOf(lib, x.layout), assets });
      await writeFile(path.join(dir, meta.file ?? `slide-${pad(x.n)}.html`), r.html);
      issues.push(...r.issues);
      slides.push({ n: x.n, layout: x.layout, filled: r.filled, left: r.left });
      Object.assign(meta, { layout: x.layout, recipe: x.recipe, family: x.family, surface: x.surface, reason: x.reason, written: r.filled });
      tried[x.n - 1] = [...new Set([...(tried[x.n - 1] ?? []), x.key])];
    }
    piece.intent.tried = tried;
    piece.history = [...(piece.history ?? []), { version: piece.version, date: today(), change: `another version: ${changed.map((x) => `slide ${x.n} → ${x.recipe}`).join(", ")}`, by: "agente" }];
    await writeJSON(path.join(dir, "piece.json"), piece);
    const result = { ...summarize(piece, dir, slides, issues), changed: changed.map(({ spec, key, ...rest }) => ({ ...rest, was: before[rest.n - 1].split("@")[0] })), restore: `npx @opency/cli version ${piece.id} restore ${piece.version - 1}` };
    out(result, `${changed.map((x) => `  ${pad(x.n)} ${before[x.n - 1].split("@")[0]} → ${x.recipe}${x.surface ? ` on ${x.surface}` : ""}: ${x.reason}`).join("\n")}\n${human(result)}`);
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
