#!/usr/bin/env node
// Asset library with quality control.
//
//   npx @opency/cli assets add <file|url> --kind photo|logo|texture|stock --desc "…" [--id x] [--credit "…"] [--license "…"]
//   npx @opency/cli assets stock "<search query in English>" [--provider auto|unsplash|openverse] [--orientation portrait|landscape|square] [--n 12] [--page 2] [--json]
//   npx @opency/cli assets stock-import <unsplash|openverse>:<id> --desc "…"
//   npx @opency/cli assets analyze <id> [--focal 0.5,0.35] [--protect "face:0.42,0.18,0.16,0.2"]… [--crop-safe 0,0.1,1,0.8] [--done]
//   npx @opency/cli assets veto <id> [--reason "…"]   ·   npx @opency/cli assets unveto <id>
//   npx @opency/cli assets info <id>   ·   npx @opency/cli assets list [--kind photo]
//   All commands: --brand <slug> (defaults to the active brand).
//
// On import: fixes EXIF orientation, converts to sRGB, strips metadata (including GPS location),
// keeps the original resolution and computes: size, brightness, dominant colors and the largest format
// it covers without upscaling (full-bleed 4:5 at 1080 and at 2K).
// Stock: Openverse works without a key. Unsplash is added when the user connects their own key: npx @opency/cli stock connect unsplash.
// "auto" queries every available library in parallel and interleaves the results.

import { mkdir, writeFile, readFile, copyFile, access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fetchBuffer, searchStock, fetchStock, missingKeys } from "./lib/stock.mjs";
import { ROOT, parseArgs, loadAssets as _load, saveAssets as _save, FORMATS, resolveBrand, brandDir } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const [cmd, target] = args._;
let BRAND; try { BRAND = await resolveBrand(args); } catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
const ADIR = path.join(brandDir(BRAND), "assets");
const loadAssets = () => _load(BRAND), saveAssets = (a) => _save(BRAND, a);
const DIRS = { photo: "photos", logo: "logos", texture: "textures", stock: "stock", font: "fonts" };
const today = () => new Date().toISOString().slice(0, 10);
const slugify = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

// Largest size it can be shown at without upscaling (full-bleed = covering the whole canvas)
function coverage(w, h) {
  const fits = (fw, fh) => w >= fw && h >= fh;
  const out = {};
  for (const [name, f] of Object.entries(FORMATS)) {
    out[name] = fits(f.w * 2, f.h * 2) ? "2K" : fits(f.w, f.h) ? "1080" : `${Math.round(Math.min(w / f.w, h / f.h) * 100)}%`;
  }
  return out;
}

async function analyzeImage(buf) {
  const img = sharp(buf, { failOn: "none" });
  const meta = await img.metadata();
  const oriented = sharp(buf).rotate();
  const { width, height } = await oriented.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const stats = await oriented.clone().stats();
  const small = await oriented.clone().resize(64, 64, { fit: "inside" }).removeAlpha().raw().toBuffer();
  // mean brightness (simple relative luminance)
  let sum = 0; for (let i = 0; i < small.length; i += 3) sum += 0.2126 * small[i] + 0.7152 * small[i + 1] + 0.0722 * small[i + 2];
  const brightness = sum / (small.length / 3) / 255;
  // palette: simple quantization into buckets of 32
  const buckets = new Map();
  for (let i = 0; i < small.length; i += 3) {
    const k = [small[i], small[i + 1], small[i + 2]].map((c) => Math.min(255, Math.round(c / 32) * 32));
    const key = k.join(","); buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const palette = [...buckets].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => "#" + k.split(",").map((c) => Number(c).toString(16).padStart(2, "0")).join(""));
  return {
    width, height, format: meta.format, hasAlpha: !!meta.hasAlpha, space: meta.space,
    sharpness: Number((stats.sharpness ?? 0).toFixed(2)),
    brightness: Number(brightness.toFixed(2)), tone: brightness < 0.35 ? "oscura" : brightness > 0.7 ? "clara" : "media",
    palette, coverage: coverage(width, height),
  };
}

async function normalizeAndSave(buf, kind, id) {
  const dir = path.join(ADIR, DIRS[kind] ?? "photos");
  await mkdir(dir, { recursive: true });
  const meta = await sharp(buf, { failOn: "none" }).metadata();
  if (meta.format === "svg") { const file = path.join(dir, `${id}.svg`); await writeFile(file, buf); return file; }
  const keepAlpha = meta.hasAlpha && (kind === "logo" || meta.format === "png" || meta.format === "webp");
  const pipeline = sharp(buf, { failOn: "none" }).rotate().toColourspace("srgb");
  const file = path.join(dir, `${id}.${keepAlpha ? "png" : "jpg"}`);
  if (keepAlpha) await pipeline.png({ compressionLevel: 9 }).toFile(file);
  else await pipeline.flatten({ background: "#ffffff" }).withIccProfile("srgb").jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true }).toFile(file);
  return file;
}

function warnQuality(a) {
  const w = [];
  if (a.kind === "photo" || a.kind === "stock") {
    if (!["1080", "2K"].includes(a.quality.coverage["4:5"])) w.push(`not large enough for a full 4:5 background (${a.quality.coverage["4:5"]}): use it in a smaller block`);
    if (a.quality.sharpness && a.quality.sharpness < 0.3) w.push(`soft image (sharpness ${a.quality.sharpness}; a sharp photo scores ~1 or more): motion blur, out of focus or heavily compressed`);
  }
  if (a.kind === "logo" && !a.file.endsWith(".svg") && a.quality.width < 1000) w.push("small bitmap logo: ask for the SVG");
  return w;
}

async function register({ buf, kind, desc, id, credit, license, source }) {
  if (!desc) throw new Error("--desc is required: describe what the image shows (the agent uses it to choose)");
  const assets = await loadAssets();
  id = id ? slugify(id) : slugify(`${kind}-${desc}`);
  let unique = id, i = 2; while (assets.some((a) => a.id === unique)) unique = `${id}-${i++}`;
  const file = await normalizeAndSave(buf, kind, unique);
  const quality = (await sharp(buf).metadata()).format === "svg" ? { format: "svg", vector: true } : await analyzeImage(await readFile(file));
  const entry = {
    id: unique, kind, file: path.relative(ADIR, file), description: desc,
    source: source ?? "propio", credit: credit ?? null, license: license ?? (kind === "stock" ? "ver proveedor" : "propio"),
    addedAt: today(), vetoed: false, quality,
    analysis: { complete: false, focalPoint: null, protectedRegions: [], cropSafe: null },
    usage: [],
  };
  assets.push(entry);
  await saveAssets(assets);
  console.log(`✓ ${entry.id} → brands/${BRAND}/assets/${entry.file}`);
  if (quality.width) console.log(`  ${quality.width}×${quality.height} · ${quality.tone} · palette ${quality.palette.join(" ")} · 4:5 full-bleed: ${quality.coverage["4:5"]}`);
  for (const w of warnQuality(entry)) console.log(`  ⚠ ${w}`);
  if (kind === "photo" || kind === "stock") console.log(`  → Look at the image and complete the analysis: npx @opency/cli assets analyze ${entry.id} --focal x,y --protect "face:x,y,w,h" --done`);
  return entry;
}

// ---------- Stock ----------
async function stockImport(ref) {
  const f = await fetchStock(ref);
  if (f.attributionRequired) console.log("  ⚠ CC BY license: credit is required when publishing (stored in assets.json → credit).");
  return register({ buf: f.buf, kind: "stock", desc: typeof args.desc === "string" ? args.desc : f.desc, id: args.id, credit: f.credit, license: f.license, source: f.source });
}

// ---------- Commands ----------
const find = (assets, id) => { const a = assets.find((x) => x.id === id); if (!a) throw new Error(`Asset "${id}" does not exist`); return a; };
const parseRect = (s) => s.split(",").map(Number);

try {
  if (cmd === "add") {
    if (!target) throw new Error("Missing file or URL");
    const kind = args.kind ?? "photo";
    if (!DIRS[kind]) throw new Error(`--kind must be ${Object.keys(DIRS).join(" | ")}`);
    let buf;
    if (/^https?:\/\//.test(target)) buf = (await fetchBuffer(target)).buf;
    else { await access(path.resolve(target)); buf = await readFile(path.resolve(target)); }
    await register({ buf, kind, desc: args.desc, id: args.id, credit: args.credit, license: args.license, source: /^https?:/.test(target) ? target : undefined });
  } else if (cmd === "stock") {
    if (!target) throw new Error('Missing search query: npx @opency/cli assets stock "runner track morning"');
    const { results, providers, errors } = await searchStock(target, { provider: args.provider ?? "auto", orientation: args.orientation, n: Number(args.n ?? 12), page: Number(args.page ?? 1) });
    const res = results.map((r) => ({ ...r, coverage: coverage(r.w, r.h) }));
    if (args.json) { console.log(JSON.stringify({ query: target, providers, errors, missingKeys: missingKeys(), results: res }, null, 2)); }
    else {
      console.log(`Libraries queried: ${providers.join(", ")}`);
      for (const e of errors) console.log(`  ⚠ ${e.provider}: ${e.error}`);
      for (const r of res) console.log(`${r.ref.padEnd(46)} ${String(r.w).padStart(5)}×${String(r.h).padEnd(5)} ${r.coverage["4:5"].padEnd(5)} ${r.license} · ${r.by} — ${r.alt ?? ""}\n${"".padEnd(4)}${r.preview}`);
      if (!res.length) console.log("(no results: try another search, in English and more specific)");
      for (const k of missingKeys()) console.log(`  · To add ${k.provider}: set ${k.env} (free at ${k.signup})`);
      console.log("\nLook at the previews, pick one and import it: npx @opency/cli assets stock-import <ref> --desc \"…\"");
    }
  } else if (cmd === "stock-import") {
    await stockImport(target);
  } else if (cmd === "analyze") {
    const assets = await loadAssets(); const a = find(assets, target);
    if (args.focal) { const [x, y] = parseRect(args.focal); a.analysis.focalPoint = { x, y }; }
    const prot = process.argv.slice(2).flatMap((v, i, arr) => (arr[i - 1] === "--protect" ? [v] : []));
    if (prot.length) a.analysis.protectedRegions = prot.map((p) => { const [kind, rect] = p.split(":"); const [x, y, w, h] = parseRect(rect); return { kind, x, y, w, h }; });
    if (args["crop-safe"]) { const [x, y, w, h] = parseRect(args["crop-safe"]); a.analysis.cropSafe = { x, y, w, h }; }
    if (args.clear) a.analysis = { complete: false, focalPoint: null, protectedRegions: [], cropSafe: null };
    if (args.done) a.analysis.complete = true;
    a.analysis.updatedAt = today();
    await saveAssets(assets);
    const f = a.analysis.focalPoint;
    console.log(`✓ ${a.id}: ${a.analysis.protectedRegions.length} protected region(s)${f ? ` · focal point ${f.x},${f.y} → style="--fx:${Math.round(f.x * 100)}%;--fy:${Math.round(f.y * 100)}%"` : ""}`);
  } else if (cmd === "veto" || cmd === "unveto") {
    const assets = await loadAssets(); const a = find(assets, target);
    a.vetoed = cmd === "veto"; a.vetoReason = cmd === "veto" ? (args.reason ?? null) : undefined;
    await saveAssets(assets); console.log(`✓ ${a.id} ${a.vetoed ? "vetoed" : "enabled"}`);
  } else if (cmd === "info") {
    console.log(JSON.stringify(find(await loadAssets(), target), null, 2));
  } else if (cmd === "list") {
    const assets = (await loadAssets()).filter((a) => !args.kind || a.kind === args.kind);
    for (const a of assets) console.log(`${a.vetoed ? "✗" : a.analysis?.complete ? "✓" : "·"} ${a.id.padEnd(32)} ${a.kind.padEnd(8)} ${(a.quality?.width ? `${a.quality.width}×${a.quality.height}` : "svg").padEnd(11)} ${(a.quality?.coverage?.["4:5"] ?? "").padEnd(5)} ${a.description}`);
    if (!assets.length) console.log("(no assets)");
  } else {
    console.log(await readFile(new URL(import.meta.url), "utf8").then((s) => s.split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n")));
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
