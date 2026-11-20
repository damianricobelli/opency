#!/usr/bin/env node
// Servidor MCP de opentcy (stdio).
//
//   npx opentcy mcp          ·   claude mcp add opentcy -- npx -y opentcy mcp
//
// Expone el motor (marcas, brief, campañas, stock, piezas, render, feed) como herramientas, las
// instrucciones del skill como recursos y tres prompts de arranque. Cada herramienta ejecuta el mismo
// script que el CLI, así que MCP y terminal nunca divergen.
//
// Nada de lo que hay acá publica en redes: opentcy deja archivos listos y la persona decide.

import { spawn } from "node:child_process";
import { readFile, writeFile, readdir, mkdir, cp, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sharp from "sharp";
import { PKG, ROOT, BRANDS, hasWorkspace, listBrands, loadBrand, brandDir, readJSON, readText, today } from "../scripts/lib/project.mjs";
import { BRIEFS, briefKinds, nextQuestions, missingAnswers, elicitationSchema } from "../scripts/lib/brief.mjs";
import { fetchBuffer, availableProviders, missingKeys } from "../scripts/lib/stock.mjs";

const VERSION = JSON.parse(await readFile(path.join(PKG, "package.json"), "utf8")).version;
const REFS = path.join(PKG, "skills/opentcy/references");

// ---------- utilidades ----------
const Slug = z.string().regex(/^[a-z0-9_][a-z0-9_-]{0,63}$/, "slug en minúsculas, números y guiones");
const PieceId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,95}$/, "id de pieza (AAAA-MM-DD-slug)");
const Brand = Slug.optional().describe("Slug de la marca. Si se omite, la marca activa.");
const Format = z.enum(["4:5", "1:1", "9:16", "16:9"]);
const clean = (s) => String(s).replace(/^-+/, "").trim(); // un texto libre nunca se interpreta como flag

/** Ejecuta un script del motor con el workspace actual. Nunca usa shell. */
function engine(script, argv, { timeout = 180000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(PKG, "scripts", script), ...argv.map(String)], { cwd: ROOT, env: { ...process.env, OPENTCY_HOME: ROOT }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, code, out: out.trim(), err: err.trim() }); });
  });
}
const text = (t) => ({ type: "text", text: typeof t === "string" ? t : JSON.stringify(t, null, 2) });
const isBlock = (p) => p && typeof p === "object" && (p.type === "text" || p.type === "image") && !Array.isArray(p);
const ok = (...parts) => ({ content: parts.filter((p) => p !== null && p !== undefined && p !== false).map((p) => (isBlock(p) ? p : text(p))) });
const bad = (msg) => ({ isError: true, content: [text(msg)] });
const result = (r, ...extra) => (r.ok || r.code === 2 ? ok([r.out, r.err].filter(Boolean).join("\n") || "✓", ...extra) : bad([r.err, r.out].filter(Boolean).join("\n") || `falló (código ${r.code})`));
const withBrand = (brand) => (brand ? ["--brand", brand] : []);
const parse = (r) => { try { return JSON.parse(r.out); } catch { return null; } };

async function image(file, maxW = 1600) {
  const buf = await sharp(file).resize({ width: maxW, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return { type: "image", data: buf.toString("base64"), mimeType: "image/jpeg" };
}
async function activeBrand(brand) {
  if (brand) { if (!existsSync(brandDir(brand))) throw new Error(`No existe la marca "${brand}". Marcas: ${(await listBrands()).join(", ") || "(ninguna)"}`); return brand; }
  const f = path.join(BRANDS, ".active");
  const a = existsSync(f) ? (await readFile(f, "utf8")).trim() : (await listBrands()).length === 1 ? (await listBrands())[0] : "";
  if (!a) throw new Error(`No hay marca activa. Marcas: ${(await listBrands()).join(", ") || "(ninguna: usá brand_create)"}`);
  return a;
}
const pieceDir = async (brand, id) => {
  const dir = path.join(brandDir(await activeBrand(brand)), "pieces", id);
  if (!existsSync(path.join(dir, "piece.json"))) throw new Error(`No existe la pieza "${id}". Usá piece_list.`);
  return dir;
};
const guard = (fn) => async (a, extra) => { try { return await fn(a ?? {}, extra); } catch (e) { return bad(e.message); } };
const NEEDS_WS = "Este directorio todavía no es un workspace de opentcy. Llamá a workspace_init (crea brands/, templates/ y las instrucciones).";

const server = new McpServer({ name: "opentcy", version: VERSION }, {
  instructions: `opentcy convierte al agente en el equipo de contenido de una o varias marcas: director de arte, diseñador y redactor.
Orden de trabajo: 1) workspace_status. 2) skill_guide (leé "core" completo antes de la primera pieza). 3) Si la marca no está cargada: brief_interview kind=brand y references/onboarding. 4) Antes de diseñar una campaña o una pieza ambigua: brief_interview. No se diseña sin saber qué se quiere transmitir. 5) campaign_plan → piece_create → piece_write → piece_render (mirá la hoja de contacto que devuelve) → revisión en frío → entrega.
Reglas: nunca inventes cifras, precios, clientes ni testimonios; solo imágenes registradas (stock_import / asset_add) y analizadas (asset_analyze); pedí un sí explícito antes de brand_write sobre una marca cargada, borrar, o compartir algo fuera del proyecto. opentcy no publica en redes: entrega archivos.`,
});

const tool = (name, title, description, inputSchema, handler, annotations = {}) =>
  server.registerTool(name, { title, description, inputSchema, annotations: { openWorldHint: false, ...annotations } }, guard(handler));
const RO = { readOnlyHint: true };

// ============================================================ Workspace y guía
tool("workspace_status", "Estado del workspace", "Punto de partida de toda sesión: marcas, marca activa, qué le falta a cada una, campañas abiertas, bancos de imágenes disponibles y entorno de render.", {}, async () => {
  if (!hasWorkspace()) return ok({ workspace: ROOT, ready: false, next: NEEDS_WS });
  const active = await activeBrand().catch(() => null);
  const brands = [];
  for (const slug of await listBrands()) {
    const b = await loadBrand(slug);
    const cdir = path.join(b.dir, "campaigns");
    const campaigns = (await readdir(cdir, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name);
    const pieces = (await readdir(path.join(b.dir, "pieces"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).length;
    brands.push({ slug, name: b.name, active: slug === active, loaded: b.loaded, language: b.language, pillars: b.pillars.length, verifiedFacts: b.verified.length, hasVoiceSamples: b.voiceSamples.replace(/^#.*$/gm, "").trim().length > 40, campaigns, pieces });
  }
  const next = !brands.length ? 'No hay marcas. Empezá por brief_interview kind="brand" y después brand_create.' : brands.some((b) => b.active && !b.loaded) ? "La marca activa no está cargada: brief_interview kind=\"brand\" y references/onboarding." : "Listo. Para una campaña: brief_interview kind=\"campaign\".";
  return ok({ workspace: ROOT, ready: true, version: VERSION, activeBrand: active, brands, stock: { available: availableProviders(), missingKeys: missingKeys() }, next });
}, RO);

tool("workspace_init", "Crear el workspace", "Crea en el directorio actual las instrucciones del agente, las plantillas y una marca de ejemplo. No pisa nada existente salvo con force.", { force: z.boolean().optional().describe("Actualiza instrucciones y plantillas aunque existan. Nunca toca las marcas de la persona.") }, async ({ force }) => result(await engine("init.mjs", [ROOT, ...(force ? ["--force"] : [])])));

tool("doctor", "Verificar el entorno", "Comprueba navegador del render, ffmpeg, claves de stock y workspace. Usalo si piece_render falla.", {}, async () => result(await engine("doctor.mjs", [])), RO);

const TOPICS = { core: null, brief: "brief.md", onboarding: "onboarding.md", planificacion: "planificacion.md", copy: "copy.md", "direccion-de-arte": "direccion-de-arte.md", assets: "assets.md", calidad: "calidad.md", revision: "revision.md", operaciones: "operaciones.md", publicacion: "publicacion.md", aprendizaje: "aprendizaje.md", layouts: null };
tool("skill_guide", "Instrucciones del skill", 'Devuelve las instrucciones de trabajo. "core" es el núcleo (leelo entero al empezar); el resto se lee cuando el tema aparece: brief, onboarding, planificacion, copy, direccion-de-arte, assets, calidad, revision, operaciones, publicacion, aprendizaje, layouts.', { topic: z.enum(Object.keys(TOPICS)).default("core") }, async ({ topic }) => {
  if (topic === "core") return ok((await readFile(path.join(PKG, "skills/opentcy/SKILL.md"), "utf8")).replace(/^---[\s\S]*?---\s*/, ""));
  if (topic === "layouts") return ok(await readFile(path.join(PKG, "templates/layouts/README.md"), "utf8"));
  return ok(await readFile(path.join(REFS, TOPICS[topic]), "utf8"));
}, RO);

// ============================================================ Marcas
tool("brand_list", "Listar marcas", "Marcas del workspace y cuál está activa.", {}, async () => result(await engine("brand.mjs", ["list"])), RO);

tool("brand_get", "Leer una marca", "Todo lo que hay que saber antes de diseñar: brand.json (datos, logos, pilares, datos verificados), brand-kit.md (voz, roles de color, instrucciones), tokens.css, muestras de voz, decisiones, calendario e inspiraciones.", { brand: Brand, include: z.array(z.enum(["brand.json", "brand-kit.md", "tokens.css", "voice-samples.md", "decisions.md", "calendar.md", "inspirations.md"])).optional().describe("Por defecto, todo.") }, async ({ brand, include }) => {
  const slug = await activeBrand(brand), dir = brandDir(slug);
  const files = include ?? ["brand.json", "brand-kit.md", "tokens.css", "voice-samples.md", "decisions.md", "calendar.md", "inspirations.md"];
  const parts = [`# Marca: ${slug}${(await loadBrand(slug)).loaded ? "" : "  (SIN CARGAR: seguí references/onboarding antes de diseñar)"}`];
  for (const f of files) parts.push(`\n===== ${f} =====\n${(await readText(path.join(dir, f))) || "(vacío)"}`);
  const tpl = (await readdir(path.join(dir, "templates"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name);
  if (tpl.length) parts.push(`\nPlantillas guardadas: ${tpl.join(", ")}`);
  return ok(parts.join("\n"));
}, RO);

tool("brand_create", "Crear una marca", "Crea brands/<slug>/ con tokens neutros. Después: brand_import_site si hay web, y proponé paleta, tipografías y voz antes de escribir nada.", { slug: Slug, name: z.string().min(1).max(60) }, async ({ slug, name }) => result(await engine("brand.mjs", ["new", slug, "--name", clean(name)])));

tool("brand_use", "Elegir la marca activa", "Define con qué marca trabajan las demás herramientas cuando no se indica una.", { brand: Slug }, async ({ brand }) => result(await engine("brand.mjs", ["use", brand])));

tool("brand_import_site", "Leer una web", "Abre la web de la marca y extrae colores por superficie, tintas, tipografías, logo, titulares, CTAs y redes. No escribe la marca: deja un informe para que propongas y la persona apruebe. Devuelve la captura de la home.", { url: z.string().url(), brand: Brand }, async ({ url, brand }) => {
  const slug = await activeBrand(brand);
  if (!/^https?:\/\//.test(url)) return bad("Solo URLs http(s).");
  const r = await engine("brand.mjs", ["import", url, "--brand", slug], { timeout: 120000 });
  if (!r.ok) return result(r);
  const report = await readText(path.join(brandDir(slug), "import/report.json"));
  const shot = path.join(brandDir(slug), "import/home.png");
  return ok(r.out, `\n===== import/report.json =====\n${report}`, existsSync(shot) ? await image(shot, 1280) : null);
}, { openWorldHint: true });

tool("brand_check", "Verificar paleta y fuentes", "Mide el contraste de cada combinación de la paleta y confirma que las fuentes cargan. Tiene que terminar sin problemas antes de la primera pieza.", { brand: Brand }, async ({ brand }) => result(await engine("brand.mjs", ["check", ...withBrand(brand)])), RO);

const BRAND_FILES = ["brand.json", "brand-kit.md", "tokens.css", "voice-samples.md", "calendar.md", "decisions.md", "inspirations.md"];
tool("brand_write", "Escribir un archivo de marca", "Escribe un archivo de la marca. REQUIERE un sí explícito de la persona si la marca ya está cargada y el archivo es brand.json, brand-kit.md o tokens.css: primero mostrá la propuesta en texto. Guarda una copia de la versión anterior en history/.", { brand: Brand, file: z.enum(BRAND_FILES), content: z.string().max(200000), confirmedByUser: z.boolean().describe("true solo si la persona aprobó este cambio en esta conversación.") }, async ({ brand, file, content, confirmedByUser }) => {
  const slug = await activeBrand(brand), dir = brandDir(slug);
  if (slug.startsWith("_")) return bad("Las marcas de ejemplo no se editan: creá una con brand_create.");
  const b = await loadBrand(slug);
  const core = ["brand.json", "brand-kit.md", "tokens.css"].includes(file);
  if (core && b.loaded && !confirmedByUser) return bad(`${slug} ya está cargada. Mostrale el cambio a la persona y volvé a llamar con confirmedByUser=true cuando diga que sí.`);
  if (file === "brand.json") { try { JSON.parse(content); } catch (e) { return bad(`brand.json no es JSON válido: ${e.message}`); } }
  const target = path.join(dir, file);
  if (existsSync(target) && core) { const h = path.join(dir, "history", today()); await mkdir(h, { recursive: true }); await cp(target, path.join(h, file)); }
  await writeFile(target, content.endsWith("\n") ? content : content + "\n");
  return ok(`✓ brands/${slug}/${file}${core ? ` (anterior en history/${today()}/)` : ""}. ${file === "tokens.css" ? "Corré brand_check." : ""}`);
}, { destructiveHint: true });

// ============================================================ Brief
tool("brief_questions", "Preguntas del brief", "Las preguntas que hay que tener respondidas antes de diseñar, por tipo: brand (cargar una marca), campaign (una campaña) o piece (una pieza suelta). Cada una indica si es obligatoria y de dónde puede deducirse para no preguntarla.", { kind: z.enum(briefKinds).default("campaign") }, async ({ kind }) => ok({ kind, ...BRIEFS[kind] }), RO);

tool("brief_interview", "Entrevistar a la persona", `Hace el brief con la persona. Si el cliente lo soporta, le muestra un formulario por tandas cortas; si no, devuelve las próximas preguntas para que las hagas vos en el chat (de a 2 a 4, con tu herramienta de preguntas si tenés una).
Pasá en "known" todo lo que ya sepas por el pedido, la marca o la web: no se vuelve a preguntar. Con "campaign" las respuestas se guardan en esa campaña.`, {
  kind: z.enum(briefKinds).default("campaign"),
  known: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional().describe("Respuestas ya conocidas, por id de pregunta."),
  campaign: Slug.optional().describe("Campaña donde guardar (solo kind=campaign). Tiene que existir: campaign_create."),
  brand: Brand,
  rounds: z.number().int().min(1).max(5).default(3),
}, async ({ kind, known = {}, campaign, brand, rounds }) => {
  const answers = { ...known };
  let asked = false, stopped = null;
  if (server.server.getClientCapabilities()?.elicitation) {
    for (let i = 0; i < rounds; i++) {
      const qs = nextQuestions(kind, answers, 4);
      if (!qs.length || (i > 0 && !qs.some((q) => q.required))) break;
      const res = await server.server.elicitInput({ message: i === 0 ? `${BRIEFS[kind].title}. ${BRIEFS[kind].intro}` : "Unas más y arranco:", requestedSchema: elicitationSchema(qs) }).catch(() => null);
      if (!res) break; // el cliente declaró la capacidad pero no respondió: se sigue por chat
      asked = true;
      if (res.action !== "accept") { stopped = res.action; break; }
      for (const [k, v] of Object.entries(res.content ?? {})) if (v !== "" && v !== null && v !== undefined) answers[k] = String(v);
    }
  }
  let saved = null;
  if (kind === "campaign" && campaign && Object.keys(answers).length) {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "opentcy-"));
    try { await writeFile(path.join(tmp, "a.json"), JSON.stringify(answers)); const r = await engine("campaign.mjs", ["brief", campaign, "--answers", path.join(tmp, "a.json"), "--json", ...withBrand(brand)]); if (!r.ok) return result(r); saved = campaign; }
    finally { await rm(tmp, { recursive: true, force: true }); }
  }
  const missing = missingAnswers(kind, answers).map((q) => ({ id: q.id, ask: q.ask, options: q.options, why: q.why }));
  const optional = nextQuestions(kind, answers, 20).filter((q) => !q.required).map((q) => ({ id: q.id, ask: q.ask, options: q.options }));
  return ok({
    kind, mode: asked ? "formulario" : "chat", answers, savedTo: saved, readyToDesign: !missing.length,
    ...(stopped ? { note: `La persona ${stopped === "decline" ? "rechazó" : "cerró"} el formulario: seguí por chat, sin insistir con todo de una.` } : {}),
    missingRequired: missing, stillOpen: optional.slice(0, 6),
    next: missing.length ? `Preguntale a la persona ${asked ? "lo que falta" : "estas preguntas"} en el chat, de a 2 a 4 y en sus palabras. Lo que puedas deducir de la marca o de la web, proponelo en vez de preguntarlo. Después ${kind === "campaign" ? "guardá con campaign_brief" : "seguí"}.` : kind === "campaign" ? "Brief completo. Devolvele a la persona el mensaje en una frase y proponé el plan de piezas (campaign_plan)." : kind === "brand" ? "Con esto proponé paleta, tipografías, voz y datos verificados; escribí con brand_write cuando diga que sí." : "Definí la dirección (tesis, modo, gesto) y creá la pieza.",
  });
});

// ============================================================ Campañas
tool("campaign_create", "Crear una campaña", "Crea la campaña y guarda lo que ya se sabe del brief. Una campaña es un mensaje sostenido en varias piezas.", { slug: Slug, name: z.string().min(1).max(80), answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(), brand: Brand }, async ({ slug, name, answers, brand }) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "opentcy-"));
  try { await writeFile(path.join(tmp, "a.json"), JSON.stringify(answers ?? {})); return result(await engine("campaign.mjs", ["new", slug, "--name", clean(name), "--answers", path.join(tmp, "a.json"), "--json", ...withBrand(brand)])); }
  finally { await rm(tmp, { recursive: true, force: true }); }
});

tool("campaign_brief", "Guardar respuestas del brief", `Guarda o corrige respuestas del brief de una campaña y devuelve qué falta. Claves: ${BRIEFS.campaign.questions.map((q) => q.id).join(", ")}.`, { campaign: Slug, answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])), brand: Brand }, async ({ campaign, answers, brand }) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "opentcy-"));
  try { await writeFile(path.join(tmp, "a.json"), JSON.stringify(answers)); return result(await engine("campaign.mjs", ["brief", campaign, "--answers", path.join(tmp, "a.json"), "--json", ...withBrand(brand)])); }
  finally { await rm(tmp, { recursive: true, force: true }); }
});

tool("campaign_plan", "Guardar el plan de piezas", "Guarda el plan aprobado por la persona: cada pieza prueba el mensaje desde un ángulo distinto. Mostrá el plan en texto y esperá el sí antes de guardarlo.", { campaign: Slug, brand: Brand, pieces: z.array(z.object({ slug: z.string().min(1), angle: z.string().min(1).describe("El ángulo en una frase."), intent: z.string().optional().describe("opinar, enseñar, mostrar producto, caso, vender, novedad, comunidad"), format: Format.optional(), channel: z.string().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), layouts: z.string().optional().describe("Layouts separados por coma.") })).min(1).max(40) }, async ({ campaign, brand, pieces }) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "opentcy-"));
  try { await writeFile(path.join(tmp, "p.json"), JSON.stringify(pieces)); return result(await engine("campaign.mjs", ["plan", campaign, "--file", path.join(tmp, "p.json"), "--json", ...withBrand(brand)])); }
  finally { await rm(tmp, { recursive: true, force: true }); }
});

tool("campaign_status", "Estado de una campaña", "Brief (qué falta), plan, piezas creadas con su estado y errores de render, y el próximo paso.", { campaign: Slug, brand: Brand }, async ({ campaign, brand }) => result(await engine("campaign.mjs", ["status", campaign, "--json", ...withBrand(brand)])), RO);

tool("campaign_list", "Listar campañas", "Campañas de la marca.", { brand: Brand }, async ({ brand }) => result(await engine("campaign.mjs", ["list", "--json", ...withBrand(brand)])), RO);

// ============================================================ Imágenes
tool("stock_search", "Buscar en bancos de imágenes", `Busca fotos libres en Pexels, Unsplash y Openverse a la vez y devuelve las previews para que las MIRES antes de elegir. Buscá en inglés y concreto ("barista pouring latte art close up", no "coffee"). Primero van siempre las fotos propias de la marca (asset_list). Cada resultado trae autor, licencia y hasta qué formato alcanza sin agrandarse.`, { query: z.string().min(2).max(120), orientation: z.enum(["portrait", "landscape", "square"]).optional().describe("portrait para 4:5 y 9:16."), provider: z.enum(["auto", "pexels", "unsplash", "openverse"]).default("auto"), n: z.number().int().min(1).max(24).default(8), page: z.number().int().min(1).max(12).default(1), previews: z.boolean().default(true).describe("Adjunta las imágenes de preview (hasta 8)."), brand: Brand }, async ({ query, orientation, provider, n, page, previews, brand }) => {
  const r = await engine("assets.mjs", ["stock", clean(query), "--json", "--provider", provider, "--n", n, "--page", page, ...(orientation ? ["--orientation", orientation] : []), ...withBrand(brand)], { timeout: 60000 });
  const data = parse(r);
  if (!r.ok || !data) return result(r);
  const parts = [{ ...data, next: data.results.length ? 'Mirá las previews. Importá SOLO la elegida con stock_import y después asset_analyze.' : "Sin resultados: probá otra búsqueda, más concreta y en inglés." }];
  if (previews) for (const item of data.results.slice(0, 8)) {
    try { const { buf } = await fetchBuffer(item.preview); parts.push(text(`▼ ${item.ref} · ${item.w}×${item.h} · ${item.license} · ${item.by}`), { type: "image", data: (await sharp(buf).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer()).toString("base64"), mimeType: "image/jpeg" }); } catch { /* preview caída: el resultado sigue en la lista */ }
  }
  return ok(...parts);
}, { readOnlyHint: true, openWorldHint: true });

tool("stock_import", "Importar una foto de banco", "Descarga la foto elegida a resolución completa, la normaliza (sRGB, sin metadatos), registra autor y licencia en assets.json y devuelve la imagen para analizarla. Después llamá a asset_analyze.", { ref: z.string().regex(/^(pexels|unsplash|openverse):[A-Za-z0-9_-]{1,64}$/), description: z.string().min(3).max(200).describe("Qué se ve en la foto: la usa el agente para elegirla en el futuro."), id: Slug.optional(), brand: Brand }, async ({ ref, description, id, brand }) => {
  const slug = await activeBrand(brand);
  const r = await engine("assets.mjs", ["stock-import", ref, "--desc", clean(description), ...(id ? ["--id", id] : []), "--brand", slug], { timeout: 120000 });
  if (!r.ok) return result(r);
  const newId = r.out.match(/✓ (\S+) →/)?.[1];
  const a = (await readJSON(path.join(brandDir(slug), "assets/assets.json"), { assets: [] })).assets.find((x) => x.id === newId);
  return ok(r.out, a ? await image(path.join(brandDir(slug), "assets", a.file), 1024) : null);
}, { openWorldHint: true });

tool("asset_add", "Registrar una imagen", "Registra una foto, logo o textura desde un archivo local o una URL pública que pasó la persona. Devuelve la imagen para analizarla.", { source: z.string().min(1).describe("Ruta local o URL http(s)."), kind: z.enum(["photo", "logo", "texture", "stock"]).default("photo"), description: z.string().min(3).max(200), credit: z.string().max(200).optional(), license: z.string().max(80).optional(), id: Slug.optional(), brand: Brand }, async ({ source, kind, description, credit, license, id, brand }) => {
  const slug = await activeBrand(brand);
  const r = await engine("assets.mjs", ["add", source, "--kind", kind, "--desc", clean(description), ...(credit ? ["--credit", clean(credit)] : []), ...(license ? ["--license", clean(license)] : []), ...(id ? ["--id", id] : []), "--brand", slug], { timeout: 120000 });
  if (!r.ok) return result(r);
  const newId = r.out.match(/✓ (\S+) →/)?.[1];
  const a = (await readJSON(path.join(brandDir(slug), "assets/assets.json"), { assets: [] })).assets.find((x) => x.id === newId);
  return ok(r.out, a && !a.file.endsWith(".svg") ? await image(path.join(brandDir(slug), "assets", a.file), 1024) : null);
}, { openWorldHint: true });

const Rect = z.object({ kind: z.enum(["face", "hand", "subject", "text", "logo"]), x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) });
tool("asset_analyze", "Analizar una foto", "Obligatorio antes de usar una foto: registrá el foco y las regiones que no se pueden cortar ni tapar (caras, manos, sujeto, texto, logos), en coordenadas 0 a 1 sobre la imagen. Mirala antes con asset_view. Con esto el render detecta recortes de caras y texto sobre el sujeto.", { id: Slug, focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(), protect: z.array(Rect).max(12).optional().describe("Lista vacía = la miré y no hay nada que proteger."), done: z.boolean().default(true), brand: Brand }, async ({ id, focal, protect, done, brand }) => {
  const argv = ["analyze", id, ...(focal ? ["--focal", `${focal.x},${focal.y}`] : []), ...(protect ?? []).flatMap((p) => ["--protect", `${p.kind}:${p.x},${p.y},${p.w},${p.h}`]), ...(done ? ["--done"] : []), ...withBrand(brand)];
  return result(await engine("assets.mjs", argv));
});

tool("asset_list", "Listar imágenes", "Biblioteca de la marca: id, tipo, tamaño, hasta qué formato alcanza, descripción, crédito y si está analizada (✓), pendiente (·) o vetada (✗).", { kind: z.enum(["photo", "logo", "texture", "stock"]).optional(), brand: Brand }, async ({ kind, brand }) => {
  const slug = await activeBrand(brand);
  const assets = (await readJSON(path.join(brandDir(slug), "assets/assets.json"), { assets: [] })).assets.filter((a) => !kind || a.kind === kind);
  return ok(assets.map((a) => ({ id: a.id, kind: a.kind, file: `../../assets/${a.file}`, description: a.description, size: a.quality?.width ? `${a.quality.width}×${a.quality.height}` : "svg", tone: a.quality?.tone, coverage: a.quality?.coverage, credit: a.credit, license: a.license, analyzed: !!a.analysis?.complete, focalPoint: a.analysis?.focalPoint, vetoed: !!a.vetoed, usedIn: a.usage?.length ?? 0 })));
}, RO);

tool("asset_view", "Ver una imagen", "Devuelve la imagen registrada para mirarla (antes de analizarla o de elegirla).", { id: Slug, brand: Brand }, async ({ id, brand }) => {
  const slug = await activeBrand(brand);
  const a = (await readJSON(path.join(brandDir(slug), "assets/assets.json"), { assets: [] })).assets.find((x) => x.id === id);
  if (!a) return bad(`No existe el asset "${id}".`);
  if (a.file.endsWith(".svg")) return ok(await readText(path.join(brandDir(slug), "assets", a.file)));
  return ok({ id: a.id, description: a.description, quality: a.quality, analysis: a.analysis, credit: a.credit }, await image(path.join(brandDir(slug), "assets", a.file), 1280));
}, RO);

tool("asset_veto", "Vetar una imagen", "Marca una foto que la persona rechazó para que no vuelva a usarse (o la habilita de nuevo).", { id: Slug, reason: z.string().max(200).optional(), undo: z.boolean().default(false), brand: Brand }, async ({ id, reason, undo, brand }) => result(await engine("assets.mjs", [undo ? "unveto" : "veto", id, ...(reason ? ["--reason", clean(reason)] : []), ...withBrand(brand)])));

// ============================================================ Piezas
tool("layouts_list", "Layouts disponibles", "Los arquetipos de slide probados y las plantillas guardadas de la marca. Devuelve la hoja de contacto de los layouts.", { brand: Brand }, async ({ brand }) => {
  const lib = await readJSON(path.join(ROOT, "templates/layouts/piece.json"), { slides: [] });
  const slug = await activeBrand(brand).catch(() => null);
  const tpl = slug ? (await readdir(path.join(brandDir(slug), "templates"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  const sheet = path.join(ROOT, "templates/layouts/render/contact-sheet.png");
  return ok(await readText(path.join(ROOT, "templates/layouts/README.md")), `\nNombres: ${lib.slides.map((s) => s.layout).join(", ")}\nPlantillas de la marca: ${tpl.join(", ") || "(ninguna)"}`, existsSync(sheet) ? await image(sheet, 1800) : null);
}, RO);

tool("piece_create", "Crear una pieza", "Crea la pieza combinando layouts (lo habitual), desde una plantilla de la marca, o duplicando/adaptando otra pieza a otro formato. Escribí el copy completo antes: si un texto no entra en un layout, se cambia de layout, no se achica la letra.", {
  slug: z.string().min(1).max(60), brand: Brand,
  layouts: z.array(z.string()).min(1).max(20).optional().describe("Un layout por slide, en orden. No repitas el mismo en todos."),
  template: z.string().optional(), from: PieceId.optional().describe("Pieza a duplicar o adaptar."),
  slides: z.number().int().min(1).max(20).optional().describe("Slides en blanco, si no hay layouts."),
  format: Format.optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), campaign: Slug.optional(), intent: z.string().max(40).optional(), category: z.string().max(40).optional(),
}, async ({ slug, brand, layouts, template, from, slides, format, date, campaign, intent, category }) => {
  const argv = [clean(slug)];
  if (layouts) argv.push("--layouts", layouts.join(","));
  if (template) argv.push("--template", clean(template));
  if (from) argv.push("--from", from);
  if (slides) argv.push("--slides", slides);
  for (const [k, v] of Object.entries({ format, date, campaign, intent, category })) if (v) argv.push(`--${k}`, clean(v));
  const r = await engine("new-piece.mjs", [...argv, ...withBrand(brand)]);
  return result(r, r.ok ? "Ahora: piece_read para ver los slides, piece_write para el copy y piece.json (direction, hook, captions, alt), y piece_render." : null);
});

tool("piece_list", "Listar piezas", "Piezas de la marca con formato, estado, campaña y resultado del último render.", { brand: Brand, campaign: Slug.optional() }, async ({ brand, campaign }) => {
  const slug = await activeBrand(brand), pdir = path.join(brandDir(slug), "pieces");
  const rows = [];
  for (const d of (await readdir(pdir, { withFileTypes: true }).catch(() => [])).filter((x) => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = await readJSON(path.join(pdir, d.name, "piece.json"), null); if (!p || (campaign && p.campaign !== campaign)) continue;
    const rep = await readJSON(path.join(pdir, d.name, "render/report.json"), null);
    rows.push({ id: d.name, title: p.title, format: p.format, slides: p.slides?.length, status: p.status, version: p.version, campaign: p.campaign ?? null, plannedDate: p.plannedDate, render: rep ? `${rep.summary.errors} errores · ${rep.summary.warnings} advertencias` : "sin renderizar" });
  }
  return ok(rows);
}, RO);

const PIECE_FILE = z.string().regex(/^(piece\.json|slide-\d{2}\.html)$/, "piece.json o slide-NN.html");
tool("piece_read", "Leer una pieza", "Devuelve piece.json y el HTML de los slides (todos, o los archivos pedidos). También el reporte de calidad si existe.", { piece: PieceId, files: z.array(PIECE_FILE).optional(), report: z.boolean().default(false), brand: Brand }, async ({ piece, files, report, brand }) => {
  const dir = await pieceDir(brand, piece);
  const all = files ?? ["piece.json", ...(await readdir(dir)).filter((f) => /^slide-\d{2}\.html$/.test(f)).sort()];
  const parts = [];
  for (const f of all) parts.push(`===== ${f} =====\n${await readText(path.join(dir, f)) || "(no existe)"}`);
  if (report) parts.push(`===== render/report.md =====\n${await readText(path.join(dir, "render/report.md")) || "(sin render)"}`);
  return ok(parts.join("\n\n"));
}, RO);

tool("piece_write", "Escribir slides o piece.json", "Escribe uno o varios archivos de la pieza. Reglas: color y tipografía solo con var(--…) de tokens.css; imágenes solo registradas, con data-asset y src relativo ../../assets/…; nunca URLs externas. Guardá una versión antes de un cambio grande (piece_version).", { piece: PieceId, files: z.array(z.object({ file: PIECE_FILE, content: z.string().max(200000) })).min(1).max(21), brand: Brand }, async ({ piece, files, brand }) => {
  const dir = await pieceDir(brand, piece);
  for (const f of files) {
    if (f.file === "piece.json") { try { JSON.parse(f.content); } catch (e) { return bad(`piece.json no es JSON válido: ${e.message}`); } }
    else if (/<script\b/i.test(f.content)) return bad(`${f.file}: los slides no llevan <script>.`);
  }
  for (const f of files) await writeFile(path.join(dir, f.file), f.content.endsWith("\n") ? f.content : f.content + "\n");
  return ok(`✓ ${files.map((f) => f.file).join(", ")}. Corré piece_render.`);
});

tool("piece_render", "Renderizar y controlar", "Renderiza la pieza, corre el control de calidad a nivel píxel (contraste sobre fotos, zonas seguras, viudas, recortes de caras, cifras sin fuente, copy) y devuelve el reporte y la HOJA DE CONTACTO. Mirala: que los chequeos pasen no es aprobación estética. No se entrega con errores.", { piece: PieceId, pdf: z.boolean().default(false).describe("Suma carousel.pdf para LinkedIn."), scale: z.number().int().min(1).max(4).default(1).describe("2 para 2K."), brand: Brand }, async ({ piece, pdf, scale, brand }) => {
  const dir = await pieceDir(brand, piece);
  const r = await engine("render.mjs", [dir, "--scale", scale, ...(pdf ? ["--pdf"] : [])], { timeout: 300000 });
  if (!r.ok) return result(r);
  const sheet = path.join(dir, "render/contact-sheet.png");
  const outputs = (await readdir(path.join(dir, "render")).catch(() => [])).filter((f) => !f.startsWith("."));
  return ok(await readText(path.join(dir, "render/report.md")), `\nArchivos en ${path.relative(ROOT, dir)}/render/: ${outputs.join(", ")}`, existsSync(sheet) ? await image(sheet, 2000) : null);
});

tool("piece_view", "Ver un slide renderizado", "Devuelve un slide ya renderizado a mayor tamaño, o la hoja de contacto.", { piece: PieceId, slide: z.number().int().min(1).max(20).optional().describe("Sin número: la hoja de contacto."), brand: Brand }, async ({ piece, slide, brand }) => {
  const dir = await pieceDir(brand, piece);
  const n = String(slide ?? 0).padStart(2, "0");
  const file = slide ? [`slide-${n}.png`, `slide-${n}.jpg`].map((f) => path.join(dir, "render", f)).find(existsSync) : path.join(dir, "render/contact-sheet.png");
  if (!file || !existsSync(file)) return bad("Todavía no hay render: corré piece_render.");
  return ok(await image(file, slide ? 1080 : 2000));
}, RO);

tool("piece_version", "Versiones de una pieza", "save guarda una copia antes de un cambio grande; list muestra el historial; diff los textos que cambiaron (también los que editó la persona a mano: no se tocan); restore vuelve a una versión sin perder la actual.", { piece: PieceId, action: z.enum(["save", "list", "diff", "restore"]), note: z.string().max(200).optional(), version: z.number().int().min(1).optional(), brand: Brand }, async ({ piece, action, note, version, brand }) => {
  const dir = await pieceDir(brand, piece);
  return result(await engine("version.mjs", [dir, action, ...(action === "save" && note ? [clean(note)] : []), ...(action === "restore" && version ? [version] : [])]));
});

tool("piece_motion", "Generar video", "Arma un MP4 con los slides (entradas escalonadas y fundidos). Requiere ffmpeg y data-motion en el <main> de cada slide. El audio lo aporta la persona, con los derechos resueltos.", { piece: PieceId, slides: z.union([z.literal("all"), z.number().int().min(1).max(20)]).default("all"), duration: z.number().min(2).max(15).default(4), audio: z.string().optional().describe("Ruta local a un archivo de audio de la persona."), brand: Brand }, async ({ piece, slides, duration, audio, brand }) => {
  const dir = await pieceDir(brand, piece);
  return result(await engine("motion.mjs", [dir, ...(slides === "all" ? ["--slides", "all"] : ["--slide", slides]), "--duration", duration, ...(audio ? ["--audio", audio] : [])], { timeout: 600000 }));
});

// ============================================================ Feed y resultados
tool("feed_check", "Revisar el feed", "Controla el ritmo del feed (fondos, categorías), ganchos repetidos y fotos que vuelven antes de tiempo, y devuelve la grilla del perfil.", { brand: Brand }, async ({ brand }) => {
  const slug = await activeBrand(brand);
  const r = await engine("feed.mjs", ["--brand", slug]);
  const grid = path.join(brandDir(slug), "feed-preview.png");
  return result(r, r.ok && existsSync(grid) ? await image(grid, 1200) : null);
}, RO);

const Metric = z.number().min(0).optional();
tool("results_add", "Cargar resultados", "Guarda los números de una pieza publicada. Los pasa la persona: nunca se estiman.", { piece: PieceId, network: z.string().default("instagram"), reach: Metric, impressions: Metric, saves: Metric, shares: Metric, likes: Metric, comments: Metric, follows: Metric, clicks: Metric, url: z.string().url().optional(), brand: Brand }, async ({ piece, network, url, brand, ...metrics }) => {
  const dir = await pieceDir(brand, piece);
  return result(await engine("results.mjs", ["add", dir, "--network", clean(network), ...Object.entries(metrics).filter(([, v]) => v !== undefined).flatMap(([k, v]) => [`--${k}`, v]), ...(url ? ["--url", url] : [])]));
});

tool("results_summary", "Qué funcionó", "Ranking de piezas publicadas y promedios por intención, modo y layout de portada. Usalo al planificar: repetí la estructura que mejor rindió con un tema nuevo.", { brand: Brand }, async ({ brand }) => result(await engine("results.mjs", withBrand(brand))), RO);

// ============================================================ Recursos y prompts
for (const [topic, file] of Object.entries(TOPICS)) {
  const src = topic === "core" ? path.join(PKG, "skills/opentcy/SKILL.md") : topic === "layouts" ? path.join(PKG, "templates/layouts/README.md") : path.join(REFS, file);
  server.registerResource(`guia-${topic}`, `opentcy://guide/${topic}`, { title: `opentcy · ${topic}`, description: `Instrucciones del skill: ${topic}`, mimeType: "text/markdown" }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await readFile(src, "utf8") }] }));
}

const prompt = (name, title, description, argsSchema, build) => server.registerPrompt(name, { title, description, argsSchema }, (a) => ({ messages: [{ role: "user", content: { type: "text", text: build(a) } }] }));
prompt("nueva-campana", "Nueva campaña", "Brief interactivo, plan y piezas de una campaña.", { tema: z.string().describe("De qué va la campaña, en tus palabras."), marca: z.string().optional() }, ({ tema, marca }) => `Quiero una campaña${marca ? ` para ${marca}` : ""}: ${tema}\n\nUsá opentcy. Empezá por workspace_status y skill_guide("core") y skill_guide("brief"). Antes de diseñar, haceme el brief con brief_interview (pasá en "known" lo que ya dije acá): necesito que entiendas qué quiero transmitir. Después proponeme el plan de piezas en texto y esperá mi sí.`);
prompt("cargar-marca", "Cargar una marca", "Onboarding de una marca desde su web.", { web: z.string().describe("URL de la web o del perfil.") }, ({ web }) => `Cargá una marca nueva desde ${web} con opentcy. Leé skill_guide("onboarding"), creala, importá la web con brand_import_site, y proponeme en texto la paleta con sus roles, las tipografías, la voz y los datos verificados. Preguntame solo lo que no puedas deducir (brief_interview kind="brand"). No escribas la marca hasta que te diga que sí.`);
prompt("plan-semanal", "Plan de la semana", "3 a 5 ideas para la semana, cruzadas con el calendario y los resultados.", { marca: z.string().optional() }, ({ marca }) => `Proponeme el plan de contenido de la semana${marca ? ` para ${marca}` : ""} con opentcy. Leé skill_guide("planificacion"), la marca con brand_get, feed_check y results_summary. De 3 a 5 ideas: intención, ángulo en una frase, formato, fecha sugerida y las preguntas abiertas. No diseñes nada hasta que elija.`);

await server.connect(new StdioServerTransport());
