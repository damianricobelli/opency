// Shared utilities: paths, formats, brands, asset registry, browser.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// PKG = where opency is installed (scripts, stock templates, skill).
// ROOT = the user's workspace: the folder that holds brands/ and templates/.
//   Resolved from OPENCY_HOME, or by walking up from the current directory until brands/ is found.
export const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Where opency keeps brands when the current folder is not a workspace. */
export const DEFAULT_HOME = path.join(os.homedir(), "opency");
function findWorkspace() {
  if (process.env.OPENCY_HOME) return path.resolve(process.env.OPENCY_HOME);
  let dir = process.cwd();
  for (;;) {
    if (existsSync(path.join(dir, "brands"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return DEFAULT_HOME;
    dir = up;
  }
}
export const ROOT = findWorkspace();
// Keys the user saved for this workspace (e.g. their own Unsplash Access Key) live in ROOT/.env.
// Real environment variables win; nothing is ever written back from here.
try {
  for (const line of readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
} catch { /* no .env: fine */ }
export const hasWorkspace = () => existsSync(path.join(ROOT, "brands")) && existsSync(path.join(ROOT, "templates/base/base.css"));
export const BRANDS = path.join(ROOT, "brands");

// critical = bottom strip reserved for chrome (brand mark, pager).
// display = width in pt at which the post is seen on a current phone (390 = iPhone 12–16). 16:9 is measured wider.
export const FORMATS = {
  "4:5":  { w: 1080, h: 1350, safe: { top: 80, right: 80, bottom: 80, left: 80 }, critical: 250, display: 390 },
  "1:1":  { w: 1080, h: 1080, safe: { top: 80, right: 80, bottom: 80, left: 80 }, critical: 80, display: 390 },
  "9:16": { w: 1080, h: 1920, safe: { top: 250, right: 80, bottom: 340, left: 80 }, critical: 340, display: 390 },
  "16:9": { w: 1920, h: 1080, safe: { top: 96, right: 120, bottom: 96, left: 120 }, critical: 150, display: 600 },
};

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

export async function readJSON(file, fallback = null) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
}
export async function writeJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n");
}
export async function readText(file) {
  try { return await readFile(file, "utf8"); } catch { return ""; }
}
export const today = () => new Date().toISOString().slice(0, 10);
export const slugify = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------- Brands ----------
/**
 * Nobody should have to "set up a workspace" before the first piece: if there is none, one is created
 * at ROOT (the default home unless OPENCY_HOME or a parent folder says otherwise). Returns true when it
 * had to create it.
 */
export function ensureWorkspace({ quiet = false } = {}) {
  if (hasWorkspace()) {
    // Layouts and base.css belong to opency: after an upgrade the workspace copy is refreshed, so
    // pieces get the new layouts. The package's own checkout is its workspace and needs no copy.
    if (path.resolve(ROOT) !== PKG) {
      let current = ""; try { current = readFileSync(path.join(ROOT, "templates/.opency-version"), "utf8").trim(); } catch { /* older workspace */ }
      const installed = JSON.parse(readFileSync(path.join(PKG, "package.json"), "utf8")).version;
      if (current !== installed) spawnSync(process.execPath, [path.join(PKG, "scripts/init.mjs"), ROOT, "--sync"], { encoding: "utf8" });
    }
    return false;
  }
  const made = spawnSync(process.execPath, [path.join(PKG, "scripts/init.mjs"), ROOT], { encoding: "utf8" });
  if (made.status !== 0) throw new Error(`Could not create the workspace at ${ROOT}: ${(made.stderr || made.stdout).trim()}`);
  if (!quiet) console.error(`· No workspace here: created one at ${ROOT} (set OPENCY_HOME or run \`opency init <folder>\` to use another).`);
  return true;
}

export async function listBrands({ includeDemo = false } = {}) {
  const dirs = await readdir(BRANDS, { withFileTypes: true }).catch(() => []);
  return dirs.filter((d) => d.isDirectory() && (includeDemo || !d.name.startsWith("_"))).map((d) => d.name);
}

/** Active brand: --brand, the BRAND env var, brands/.active, or the only brand that exists. */
export async function resolveBrand(args = {}) {
  ensureWorkspace();
  let slug = typeof args.brand === "string" ? args.brand : process.env.BRAND;
  if (!slug && existsSync(path.join(BRANDS, ".active"))) slug = readFileSync(path.join(BRANDS, ".active"), "utf8").trim();
  if (!slug) { const all = await listBrands(); if (all.length === 1) slug = all[0]; }
  if (!slug) throw new Error("No brand selected. Use --brand <slug> or `npx @opency/cli brand use <slug>`. Brands: " + ((await listBrands()).join(", ") || "(none: npx @opency/cli brand new <slug>)"));
  if (!existsSync(path.join(BRANDS, slug))) throw new Error(`brands/${slug} does not exist. Brands: ${(await listBrands({ includeDemo: true })).join(", ")}`);
  return slug;
}
export const brandDir = (slug) => path.join(BRANDS, slug);

/** Brand a path belongs to (brands/<slug>/…). Shared templates use _demo. */
export function brandOf(p) {
  const rel = path.relative(BRANDS, path.resolve(p)).split(path.sep);
  return rel[0] && !rel[0].startsWith("..") ? rel[0] : "_demo";
}

/** Accepts "pieces/<id>", "<id>", or a full path; returns the piece folder. */
export async function resolvePiece(arg, args = {}) {
  if (!arg) throw new Error("Missing piece.");
  const direct = path.resolve(arg);
  if (existsSync(path.join(direct, "piece.json"))) return direct;
  const slug = await resolveBrand(args);
  const id = arg.replace(/^pieces\//, "").replace(/\/$/, "");
  const inBrand = path.join(brandDir(slug), "pieces", id);
  if (existsSync(inBrand)) return inBrand;
  throw new Error(`Piece "${arg}" not found (looked in ${path.relative(ROOT, direct)} and brands/${slug}/pieces/${id}).`);
}

// Structured brand data (brand.json). The prose (voice, rules) lives in brand-kit.md.
export async function loadBrand(slug) {
  const dir = brandDir(slug);
  const b = await readJSON(path.join(dir, "brand.json"), null);
  const voice = await readText(path.join(dir, "voice-samples.md"));
  if (!b) return { slug, dir, loaded: false, name: "", address: null, usesEmoji: false, usesDashes: false, voiceSamples: voice, verified: [], pillars: [] };
  return {
    slug, dir, loaded: !!b.name && !/\{\{/.test(b.name),
    name: b.name ?? "", handle: b.handle ?? "", language: b.language ?? "en", country: b.country ?? "",
    address: ["vos", "tú", "usted"].includes(b.address) ? b.address : null,
    usesEmoji: !!b.usesEmoji, usesDashes: !!b.usesDashes,
    voiceSamples: voice, verified: b.verified ?? [], pillars: b.pillars ?? [], raw: b,
  };
}

// ---------- Assets ----------
export const assetsFile = (slug) => path.join(brandDir(slug), "assets/assets.json");
export async function loadAssets(slug) {
  return (await readJSON(assetsFile(slug), { assets: [] })).assets ?? [];
}
export async function saveAssets(slug, assets) {
  await writeJSON(assetsFile(slug), { assets });
}

// ---------- Browser ----------
export async function launchBrowser() {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { throw new Error("Playwright is missing. Run: npx @opency/cli setup"); }
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  try { return await chromium.launch(); }
  catch {
    // Any Chromium already on the machine will do: Chrome first, then Edge.
    for (const channel of ["chrome", "msedge", "chrome-beta"]) {
      try { return await chromium.launch({ channel }); } catch { /* try the next one */ }
    }
    throw new Error("No browser found to render with. Run `npx @opency/cli setup` (downloads Chromium), install Google Chrome, or set CHROME_PATH.");
  }
}
