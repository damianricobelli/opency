#!/usr/bin/env node
// Campañas: un brief y un plan de piezas que comparten mensaje.
//
//   npx opentcy campaign new <slug> --name "Nombre" [--answers archivo.json] [--set clave="valor"]…
//   npx opentcy campaign brief <slug> [--set clave="valor"]… [--answers archivo.json]      completa o corrige respuestas
//   npx opentcy campaign plan <slug> --file plan.json                                        guarda el plan de piezas
//   npx opentcy campaign status <slug>                                                       qué falta, qué piezas hay y cómo están
//   npx opentcy campaign list
//   npx opentcy brief questions [brand|campaign|piece] [--json]                              las preguntas de cada brief
//   En todos: --brand <slug>   ·   --json para salida estructurada.
//
// La campaña vive en brands/<marca>/campaigns/<slug>/brief.json. Las piezas se vinculan con
// `npx opentcy new <pieza> --campaign <slug>` (queda en piece.json → campaign).
// Un plan es una lista de { slug, intent, format, channel, date, angle, layouts? }.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs, readJSON, writeJSON, resolveBrand, brandDir, slugify, today, FORMATS } from "./lib/project.mjs";
import { BRIEFS, briefKinds, missingAnswers, nextQuestions, renderMarkdown } from "./lib/brief.mjs";

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const out = (data, text) => console.log(args.json ? JSON.stringify(data, null, 2) : text);

// --set se puede repetir: parseArgs se queda con el último, así que se leen todos a mano.
const sets = argv.flatMap((v, i) => (argv[i - 1] === "--set" ? [v] : []));
async function collectAnswers() {
  const a = {};
  if (typeof args.answers === "string") Object.assign(a, await readJSON(path.resolve(args.answers), null) ?? fail(`No pude leer ${args.answers}`));
  for (const s of sets) { const i = s.indexOf("="); if (i < 1) fail(`--set espera clave=valor (recibí "${s}")`); a[s.slice(0, i)] = s.slice(i + 1); }
  return a;
}

// ---- brief questions (no necesita marca) ----
if (args._[0] === "questions" || (args._[0] === "brief" && args._[1] === "questions")) {
  const kind = args._.find((x) => briefKinds.includes(x)) ?? "campaign";
  const b = BRIEFS[kind];
  out({ kind, ...b }, [`# ${b.title}`, b.intro, "", ...b.questions.map((q, i) => `${String(i + 1).padStart(2)}. ${q.required ? "●" : "○"} ${q.ask}${q.options ? `\n     opciones: ${q.options.join(" · ")}` : ""}${q.infer ? `\n     se puede deducir de: ${q.infer}` : ""}`), "", "● obligatoria   ○ opcional"].join("\n"));
  process.exit(0);
}

const [cmd, target] = args._;
let brand; try { brand = await resolveBrand(args); } catch (e) { fail(e.message); }
const CDIR = path.join(brandDir(brand), "campaigns");
const file = (slug) => path.join(CDIR, slug, "brief.json");
const load = async (slug) => (await readJSON(file(slug), null)) ?? fail(`No existe la campaña "${slug}" en brands/${brand}/campaigns. Creala: npx opentcy campaign new ${slug} --name "…"`);
async function save(c) {
  c.updatedAt = today();
  await writeJSON(file(c.slug), c);
  await writeFile(path.join(CDIR, c.slug, "brief.md"), renderMarkdown("campaign", c.answers).replace("# Brief de campaña", `# ${c.name} · brief`) + "\n");
}

async function piecesOf(slug) {
  const pdir = path.join(brandDir(brand), "pieces");
  const ids = (await readdir(pdir, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const rows = [];
  for (const id of ids) {
    const p = await readJSON(path.join(pdir, id, "piece.json"), null);
    if (p?.campaign !== slug) continue;
    const rep = await readJSON(path.join(pdir, id, "render/report.json"), null);
    rows.push({ id, title: p.title ?? "", format: p.format, slides: p.slides?.length ?? 0, status: p.status ?? "draft", plannedDate: p.plannedDate ?? null, rendered: !!rep, errors: rep?.summary?.errors ?? null, warnings: rep?.summary?.warnings ?? null });
  }
  return rows;
}

async function status(slug) {
  const c = await load(slug);
  const missing = missingAnswers("campaign", c.answers).map((q) => ({ id: q.id, ask: q.ask }));
  const pieces = await piecesOf(slug);
  const made = new Set(pieces.map((p) => p.id.replace(/^\d{4}-\d{2}-\d{2}-/, "")));
  const pending = (c.plan ?? []).filter((p) => !made.has(slugify(p.slug)));
  const ready = !missing.length;
  const next = !ready ? "Completar el brief: faltan respuestas obligatorias." : !(c.plan ?? []).length ? "Proponer el plan de piezas y guardarlo con `campaign plan`." : pending.length ? `Crear ${pending.length} pieza(s) pendientes del plan.` : pieces.some((p) => !p.rendered || p.errors) ? "Renderizar y resolver errores." : "Revisión en frío y entrega.";
  return { brand, slug, name: c.name, readyToDesign: ready, missing, answers: c.answers, plan: c.plan ?? [], pieces, pendingFromPlan: pending, next };
}

try {
  if (cmd === "new") {
    if (!target) fail('Uso: npx opentcy campaign new <slug> --name "Nombre"');
    const slug = slugify(target);
    if (existsSync(file(slug))) fail(`Ya existe la campaña "${slug}". Para cambiar respuestas: npx opentcy campaign brief ${slug} --set clave="valor"`);
    await mkdir(path.join(CDIR, slug), { recursive: true });
    const c = { slug, name: typeof args.name === "string" ? args.name : target, brand, createdAt: today(), status: "brief", answers: await collectAnswers(), plan: [] };
    await save(c);
    const s = await status(slug);
    out(s, `✓ brands/${brand}/campaigns/${slug}/brief.json\n${s.missing.length ? `  Faltan ${s.missing.length} respuesta(s) obligatoria(s):\n${s.missing.map((m) => `   · ${m.id}: ${m.ask}`).join("\n")}` : "  Brief completo."}\n  → ${s.next}`);
  } else if (cmd === "brief") {
    const c = await load(target);
    const add = await collectAnswers();
    const unknown = Object.keys(add).filter((k) => !BRIEFS.campaign.questions.some((q) => q.id === k));
    if (unknown.length) fail(`Clave(s) desconocida(s): ${unknown.join(", ")}. Válidas: ${BRIEFS.campaign.questions.map((q) => q.id).join(", ")}`);
    if (Object.keys(add).length) { Object.assign(c.answers, add); await save(c); }
    const s = await status(target);
    const nq = nextQuestions("campaign", c.answers);
    out({ ...s, nextQuestions: nq }, `${renderMarkdown("campaign", c.answers)}\n${s.readyToDesign ? "✓ Listo para diseñar." : `Faltan: ${s.missing.map((m) => m.id).join(", ")}`}\n→ ${s.next}`);
  } else if (cmd === "plan") {
    const c = await load(target);
    if (typeof args.file !== "string") fail("Uso: npx opentcy campaign plan <slug> --file plan.json   (lista de { slug, intent, format, channel, date, angle })");
    const plan = await readJSON(path.resolve(args.file), null);
    if (!Array.isArray(plan) || !plan.length) fail("El plan tiene que ser una lista con al menos una pieza.");
    for (const [i, p] of plan.entries()) {
      if (!p.slug || !p.angle) fail(`Pieza ${i + 1}: faltan slug o angle (el ángulo en una frase).`);
      if (p.format && !FORMATS[p.format]) fail(`Pieza ${i + 1}: formato inválido "${p.format}". Opciones: ${Object.keys(FORMATS).join(", ")}`);
      if (p.date && !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) fail(`Pieza ${i + 1}: la fecha va como AAAA-MM-DD.`);
    }
    c.plan = plan.map((p) => ({ slug: slugify(p.slug), intent: p.intent ?? "", format: p.format ?? "4:5", channel: p.channel ?? "", date: p.date ?? "", angle: p.angle, ...(p.layouts ? { layouts: p.layouts } : {}) }));
    c.status = "planned";
    await save(c);
    out(await status(target), `✓ Plan guardado: ${c.plan.length} pieza(s)\n${c.plan.map((p) => `  ${p.date || "sin fecha "} ${p.format.padEnd(5)} ${p.slug.padEnd(28)} ${p.angle}`).join("\n")}\n  Crear cada una: npx opentcy new <slug> --campaign ${c.slug} --layouts … --date …`);
  } else if (cmd === "status") {
    const s = await status(target);
    out(s, [`${s.name} · ${brand}/${s.slug} · ${s.readyToDesign ? "brief completo" : `faltan ${s.missing.length} respuesta(s)`}`,
      ...s.missing.map((m) => `  ✗ ${m.id}: ${m.ask}`),
      s.plan.length ? `Plan: ${s.plan.length} pieza(s), ${s.pendingFromPlan.length} sin crear` : "Sin plan todavía.",
      ...s.pieces.map((p) => `  ${p.rendered ? (p.errors ? "✗" : "✓") : "·"} ${p.id.padEnd(40)} ${String(p.format).padEnd(5)} ${p.status.padEnd(10)} ${p.rendered ? `${p.errors} errores · ${p.warnings} advertencias` : "sin renderizar"}`),
      `→ ${s.next}`].join("\n"));
  } else if (cmd === "list") {
    const dirs = (await readdir(CDIR, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory());
    const rows = [];
    for (const d of dirs) { const c = await readJSON(file(d.name), null); if (c) rows.push({ slug: c.slug, name: c.name, status: c.status, pieces: (await piecesOf(c.slug)).length, planned: c.plan?.length ?? 0, updatedAt: c.updatedAt }); }
    out(rows, rows.length ? rows.map((r) => `${r.slug.padEnd(28)} ${r.name} · ${r.pieces}/${r.planned} piezas · ${r.status}`).join("\n") : `(${brand} no tiene campañas: npx opentcy campaign new <slug> --name "…")`);
  } else {
    console.log((await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  }
} catch (e) { fail(e.message); }
