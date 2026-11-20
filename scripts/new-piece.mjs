#!/usr/bin/env node
// Crea una pieza nueva en brands/<marca>/pieces/.
//
//   npx opentcy new <slug> --layouts cover-type,steps,big-number,closer     combina layouts de la librería
//   npx opentcy new <slug> --template <nombre>                               parte de una plantilla guardada de la marca
//   npx opentcy new <slug> --from <id de pieza> [--format 9:16]              duplica o adapta una pieza existente
//   npx opentcy new <slug> [--slides 6]                                      slides en blanco
//   opciones: --brand slug  --campaign slug  --format 4:5|1:1|9:16|16:9  --date AAAA-MM-DD  --intent …  --category …
//
// Al copiar un layout: ajusta las rutas a la marca, pone su nombre y su logo en la barra inferior
// (versión clara u oscura según la superficie del slide) y numera el paginador.

import { mkdir, readFile, writeFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import { ROOT, FORMATS, parseArgs, readJSON, writeJSON, resolveBrand, brandDir, loadBrand, slugify, today } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const rawSlug = args._[0];
if (!rawSlug) fail("Uso: npx opentcy new <slug> [--layouts a,b,c | --template nombre | --from pieza | --slides N] [--format 4:5] [--brand slug]");

let brandSlug; try { brandSlug = await resolveBrand(args); } catch (e) { fail(e.message); }
const brand = await loadBrand(brandSlug);
const bdir = brandDir(brandSlug);

const date = args.date ?? today();
const id = `${date}-${slugify(rawSlug)}`;
const dir = path.join(bdir, "pieces", id);
try { await access(dir); fail(`Ya existe brands/${brandSlug}/pieces/${id}.`); } catch {}

// ---- Fuentes de slides ----
let sources = [], inherited = null;
if (args.layouts) {
  const lib = await readJSON(path.join(ROOT, "templates/layouts/piece.json"), { slides: [] });
  const byName = Object.fromEntries(lib.slides.map((s) => [s.layout, `slide-${String(s.n).padStart(2, "0")}.html`]));
  for (const name of String(args.layouts).split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!byName[name]) fail(`Layout desconocido "${name}". Disponibles: ${Object.keys(byName).join(", ")}`);
    sources.push({ path: path.join(ROOT, "templates/layouts", byName[name]), layout: name });
  }
} else if (args.template || args.from) {
  const src = args.template ? path.join(bdir, "templates", args.template) : path.join(bdir, "pieces", String(args.from).replace(/^pieces\//, ""));
  const files = (await readdir(src).catch(() => [])).filter((f) => /^slide-\d+\.html$/.test(f)).sort();
  if (!files.length) fail(`${path.relative(ROOT, src)} no tiene slide-NN.html`);
  inherited = await readJSON(path.join(src, "piece.json"), null);
  sources = files.map((f, i) => ({ path: path.join(src, f), layout: inherited?.slides?.[i]?.layout ?? (args.template ? `template:${args.template}` : "copia") }));
} else {
  const n = Number(args.slides ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > 20) fail("--slides debe ser 1–20");
  sources = Array.from({ length: n }, () => ({ path: path.join(ROOT, "templates/base/slide.html"), layout: "base" }));
}
if (sources.length > 20) fail("Máximo 20 slides.");

const format = args.format ?? inherited?.format ?? "4:5";
if (!FORMATS[format]) fail(`Formato inválido "${format}". Opciones: ${Object.keys(FORMATS).join(", ")}`);

await mkdir(dir, { recursive: true });
const total = sources.length;
const pad = (x) => String(x).padStart(2, "0");
const logos = brand.raw?.logos ?? {};
const slides = [];

for (const [i, src] of sources.entries()) {
  const n = i + 1;
  let html = await readFile(src.path, "utf8");
  const surface = html.match(/class="canvas[^"]*\b(on-primary|on-secondary|photo-slide)\b/)?.[1];
  const logo = surface === "on-primary" ? (logos.onPrimary ?? logos.onDark) : surface ? logos.onDark : logos.onLight;
  html = html
    .replace(/data-format="[^"]*"/, `data-format="${format}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${id} · slide ${n} · ${src.layout}</title>`)
    .replace(/href="[^"]*tokens\.css"/, 'href="../../tokens.css"')
    .replace(/href="[^"]*base\.css"/, 'href="../../../../templates/base/base.css"')
    .replace(/src="(?:\.\.\/)+(?:brands\/[^/]+\/)?assets\//g, 'src="../../assets/')
    .replace(/(<span id="pager">)[^<]*(<\/span>)/, `$1${pad(n)}/${pad(total)}$2`)
    .replaceAll("{{FORMAT}}", format).replaceAll("{{PIECE_ID}}", id).replaceAll("{{N}}", pad(n)).replaceAll("{{TOTAL}}", pad(total));
  // Un material por pieza: la textura es la de la marca, no la del layout de origen
  if (brand.loaded && !args.from && !args.template && brand.raw?.defaults && "texture" in brand.raw.defaults) {
    const tex = brand.raw.defaults.texture;
    html = html.replace(/(<main class="canvas[^"]*")([^>]*)>/, (m, head, rest) => {
      rest = rest.replace(/\s*data-texture="[^"]*"/, "").replace(/\s*style="--grain:[^"]*"/, "");
      return `${head}${tex ? ` data-texture="${tex}"` : ""}${rest}>`;
    });
  }
  if (brand.loaded && !args.from) {
    const mark = logo
      ? `<img id="logo" class="logo" data-role="logo" src="../../${logo}" alt="${brand.name}">`
      : `<span id="brand">${brand.handle || brand.name}</span>`;
    html = html.replace(/<span id="brand">[^<]*<\/span>/, mark).replaceAll("{{MARCA}}", brand.handle || brand.name);
  }
  const file = `slide-${pad(n)}.html`;
  await writeFile(path.join(dir, file), html);
  const prev = inherited?.slides?.[i];
  slides.push({ n, file, layout: src.layout, role: prev?.role ?? (n === 1 ? "hook" : n === total && total > 1 ? "close" : ""), claim: prev?.claim ?? "", alt: prev?.alt ?? "" });
}

const piece = {
  id, title: inherited?.title ?? "", status: "draft", category: args.category ?? inherited?.category ?? "", plannedDate: date, format, version: 1,
  language: inherited?.language ?? brand.language ?? "es",
  ...(args.from ? { adaptedFrom: String(args.from) } : {}),
  ...(typeof args.campaign === "string" ? { campaign: slugify(args.campaign) } : inherited?.campaign && args.from ? { campaign: inherited.campaign } : {}),
  direction: inherited?.direction ?? { intent: args.intent ?? "", thesis: "", dominantMode: brand.raw?.defaults?.dominantMode ?? "", density: "", signatureMove: "", avoid: [] },
  hook: inherited?.hook ?? "",
  slides,
  captions: inherited?.captions ?? { instagram: "", linkedin: "", tiktok: "", x: { thread: [] } },
  sources: inherited?.sources ?? [],
  feedback: [],
  history: [{ version: 1, date: today(), change: args.from ? `adaptada de ${args.from}${args.format ? ` a ${format}` : ""}` : "creada", by: "agente" }],
};
await writeJSON(path.join(dir, "piece.json"), piece);

console.log(`✓ brands/${brandSlug}/pieces/${id} · ${format} · ${total} slide(s)${args.layouts ? ` · ${sources.map((s) => s.layout).join(" → ")}` : ""}`);
console.log(`  Siguiente: completar piece.json, editar los slides y correr: npx opentcy render ${id}${args.brand ? ` --brand ${brandSlug}` : ""}`);
