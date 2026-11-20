// Utilidades compartidas: rutas, formatos, marcas, registro de assets, navegador.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// PKG = donde está instalado opentcy (scripts, plantillas de fábrica, skill).
// ROOT = el workspace de la persona: la carpeta que tiene brands/ y templates/.
//   Se resuelve con OPENTCY_HOME, o subiendo desde el directorio actual hasta encontrar brands/.
export const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
function findWorkspace() {
  if (process.env.OPENTCY_HOME) return path.resolve(process.env.OPENTCY_HOME);
  let dir = process.cwd();
  for (;;) {
    if (existsSync(path.join(dir, "brands"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return process.cwd();
    dir = up;
  }
}
export const ROOT = findWorkspace();
export const hasWorkspace = () => existsSync(path.join(ROOT, "brands")) && existsSync(path.join(ROOT, "templates/base/base.css"));
export const BRANDS = path.join(ROOT, "brands");

// critical = franja inferior donde solo va chrome (marca, paginador).
// display = ancho en pt al que se ve el post en un teléfono actual (390 = iPhone 12–16). 16:9 se mide más ancho.
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

// ---------- Marcas ----------
export async function listBrands({ includeDemo = false } = {}) {
  const dirs = await readdir(BRANDS, { withFileTypes: true }).catch(() => []);
  return dirs.filter((d) => d.isDirectory() && (includeDemo || !d.name.startsWith("_"))).map((d) => d.name);
}

/** Marca activa: --brand, variable BRAND, brands/.active, o la única marca que exista. */
export async function resolveBrand(args = {}) {
  let slug = typeof args.brand === "string" ? args.brand : process.env.BRAND;
  if (!slug && existsSync(path.join(BRANDS, ".active"))) slug = readFileSync(path.join(BRANDS, ".active"), "utf8").trim();
  if (!slug) { const all = await listBrands(); if (all.length === 1) slug = all[0]; }
  if (!slug) throw new Error("No sé con qué marca trabajar. Usá --brand <slug> o `npx opentcy brand use <slug>`. Marcas: " + ((await listBrands()).join(", ") || "(ninguna: npx opentcy brand new <slug>)"));
  if (!existsSync(path.join(BRANDS, slug))) throw new Error(`No existe brands/${slug}. Marcas: ${(await listBrands({ includeDemo: true })).join(", ")}`);
  return slug;
}
export const brandDir = (slug) => path.join(BRANDS, slug);

/** Marca a la que pertenece una ruta (brands/<slug>/…). Las plantillas compartidas usan _demo. */
export function brandOf(p) {
  const rel = path.relative(BRANDS, path.resolve(p)).split(path.sep);
  return rel[0] && !rel[0].startsWith("..") ? rel[0] : "_demo";
}

/** Acepta "pieces/<id>", "<id>", o una ruta completa; devuelve la carpeta de la pieza. */
export async function resolvePiece(arg, args = {}) {
  if (!arg) throw new Error("Falta la pieza.");
  const direct = path.resolve(arg);
  if (existsSync(path.join(direct, "piece.json"))) return direct;
  const slug = await resolveBrand(args);
  const id = arg.replace(/^pieces\//, "").replace(/\/$/, "");
  const inBrand = path.join(brandDir(slug), "pieces", id);
  if (existsSync(inBrand)) return inBrand;
  throw new Error(`No encontré la pieza "${arg}" (busqué en ${path.relative(ROOT, direct)} y brands/${slug}/pieces/${id}).`);
}

// Datos estructurados de la marca (brand.json). La prosa (voz, reglas) vive en brand-kit.md.
export async function loadBrand(slug) {
  const dir = brandDir(slug);
  const b = await readJSON(path.join(dir, "brand.json"), null);
  const voice = await readText(path.join(dir, "voice-samples.md"));
  if (!b) return { slug, dir, loaded: false, name: "", address: null, usesEmoji: false, usesDashes: false, voiceSamples: voice, verified: [], pillars: [] };
  return {
    slug, dir, loaded: !!b.name && !/\{\{/.test(b.name),
    name: b.name ?? "", handle: b.handle ?? "", language: b.language ?? "es", country: b.country ?? "",
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

// ---------- Navegador ----------
export async function launchBrowser() {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch { throw new Error("Falta Playwright. Corré: npx opentcy setup"); }
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH });
  try { return await chromium.launch(); }
  catch {
    try { return await chromium.launch({ channel: "chrome" }); }
    catch { throw new Error("No encontré navegador: `npx opentcy setup`, instalá Google Chrome o definí CHROME_PATH."); }
  }
}
