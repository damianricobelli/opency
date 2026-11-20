#!/usr/bin/env node
// Campaigns: a brief and a plan of pieces that share one message.
//
//   npx @opency/cli campaign new <slug> --name "Name" [--answers file.json] [--set key="value"]…
//   npx @opency/cli campaign brief <slug> [--set key="value"]… [--answers file.json]      fill in or correct answers
//   npx @opency/cli campaign plan <slug> --file plan.json                                  save the piece plan
//   npx @opency/cli campaign status <slug>                                                 what is missing, which pieces exist and how they are
//   npx @opency/cli campaign list
//   npx @opency/cli campaign brand-brief [--set key="value"]… [--answers file.json]    the brand's own brief (brands/<brand>/brief.json)
//   npx @opency/cli brief questions [brand|campaign|piece] [--json]                        the questions of each brief
//   All of them: --brand <slug>   ·   --json for structured output   ·   --lang es|en: the language the questions are asked in.
//
// The campaign lives in brands/<brand>/campaigns/<slug>/brief.json. Pieces are linked with
// `npx @opency/cli new <piece> --campaign <slug>` (stored in piece.json → campaign).
// A plan is a list of { slug, intent, format, channel, date, angle, layouts? }.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs, readJSON, writeJSON, resolveBrand, brandDir, slugify, today, FORMATS } from "./lib/project.mjs";
import { BRIEFS, briefKinds, briefIn, briefLanguage, missingAnswers, nextQuestions, renderMarkdown } from "./lib/brief.mjs";

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
// The language the questions are asked in (the user's), not the language of the brand's copy.
const LANG = typeof args.lang === "string" ? briefLanguage(args.lang) : null;
const out = (data, text) => console.log(args.json ? JSON.stringify(data, null, 2) : text);

// --set can repeat: parseArgs keeps only the last one, so all of them are read by hand.
const sets = argv.flatMap((v, i) => (argv[i - 1] === "--set" ? [v] : []));
async function collectAnswers() {
  const a = {};
  if (typeof args.answers === "string") Object.assign(a, await readJSON(path.resolve(args.answers), null) ?? fail(`Could not read ${args.answers}`));
  for (const s of sets) { const i = s.indexOf("="); if (i < 1) fail(`--set expects key=value (got "${s}")`); a[s.slice(0, i)] = s.slice(i + 1); }
  return a;
}

// ---- brief questions (no brand needed) ----
if (args._[0] === "questions" || (args._[0] === "brief" && args._[1] === "questions")) {
  const kind = args._.find((x) => briefKinds.includes(x)) ?? "campaign";
  const b = briefIn(kind, LANG);
  out({ kind, ...b }, [`# ${b.title}`, b.intro, "", ...b.questions.map((q, i) => `${String(i + 1).padStart(2)}. ${q.required ? "●" : "○"} ${q.ask}${q.options ? `\n     ${LANG === "es" ? "opciones" : "options"}: ${q.options.join(" · ")}` : ""}${q.infer ? `\n     ${LANG === "es" ? "se puede deducir de" : "can be inferred from"}: ${q.infer}` : ""}`), "", LANG === "es" ? "● obligatoria   ○ opcional" : "● required   ○ optional"].join("\n"));
  process.exit(0);
}

const [cmd, target] = args._;

// ---- the brand's own brief: what the user answered when the brand was loaded ----
if (cmd === "brand-brief") {
  let b; try { b = await resolveBrand(args); } catch (e) { fail(e.message); }
  const file = path.join(brandDir(b), "brief.json");
  const current = (await readJSON(file, null)) ?? { brand: b, createdAt: today(), answers: {} };
  const add = await collectAnswers();
  const unknown = Object.keys(add).filter((k) => !BRIEFS.brand.questions.some((q) => q.id === k));
  if (unknown.length) fail(`Unknown key(s): ${unknown.join(", ")}. Valid: ${BRIEFS.brand.questions.map((q) => q.id).join(", ")}`);
  if (LANG) current.language = LANG;
  const lang = current.language ?? "en";
  if (Object.keys(add).length || LANG) {
    Object.assign(current.answers, add);
    current.updatedAt = today();
    await writeJSON(file, current);
    await writeFile(path.join(brandDir(b), "brief.md"), renderMarkdown("brand", current.answers, lang) + "\n");
  }
  const missing = missingAnswers("brand", current.answers, lang).map((q) => ({ id: q.id, ask: q.ask }));
  out({ brand: b, language: lang, answers: current.answers, missing, readyToPropose: !missing.length, nextQuestions: nextQuestions("brand", current.answers, 4, lang) },
    `${renderMarkdown("brand", current.answers, lang)}\n${missing.length ? `Missing: ${missing.map((m) => m.id).join(", ")}` : "✓ Enough to propose palette, typefaces and voice."}`);
  process.exit(0);
}

let brand; try { brand = await resolveBrand(args); } catch (e) { fail(e.message); }
const CDIR = path.join(brandDir(brand), "campaigns");
const file = (slug) => path.join(CDIR, slug, "brief.json");
const load = async (slug) => (await readJSON(file(slug), null)) ?? fail(`Campaign "${slug}" does not exist in brands/${brand}/campaigns. Create it: npx @opency/cli campaign new ${slug} --name "…"`);
async function save(c) {
  c.updatedAt = today();
  await writeJSON(file(c.slug), c);
  await writeFile(path.join(CDIR, c.slug, "brief.md"), renderMarkdown("campaign", c.answers, c.language).replace(/^# .*/, `# ${c.name} · brief`) + "\n");
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
  const missing = missingAnswers("campaign", c.answers, c.language).map((q) => ({ id: q.id, ask: q.ask }));
  const pieces = await piecesOf(slug);
  const made = new Set(pieces.map((p) => p.id.replace(/^\d{4}-\d{2}-\d{2}-/, "")));
  const pending = (c.plan ?? []).filter((p) => !made.has(slugify(p.slug)));
  const ready = !missing.length;
  const next = !ready ? "Complete the brief: required answers are missing." : !(c.plan ?? []).length ? "Propose the piece plan and save it with `campaign plan`." : pending.length ? `Create the ${pending.length} piece(s) still pending from the plan.` : pieces.some((p) => !p.rendered || p.errors) ? "Render and fix the errors." : "Cold review and delivery.";
  return { brand, slug, name: c.name, readyToDesign: ready, missing, answers: c.answers, plan: c.plan ?? [], pieces, pendingFromPlan: pending, next };
}

try {
  if (cmd === "new") {
    if (!target) fail('Usage: npx @opency/cli campaign new <slug> --name "Name"');
    const slug = slugify(target);
    if (existsSync(file(slug))) fail(`Campaign "${slug}" already exists. To change answers: npx @opency/cli campaign brief ${slug} --set key="value"`);
    await mkdir(path.join(CDIR, slug), { recursive: true });
    const c = { slug, name: typeof args.name === "string" ? args.name : target, brand, createdAt: today(), status: "brief", language: LANG ?? "en", answers: await collectAnswers(), plan: [] };
    await save(c);
    const s = await status(slug);
    out(s, `✓ brands/${brand}/campaigns/${slug}/brief.json\n${s.missing.length ? `  ${s.missing.length} required answer(s) missing:\n${s.missing.map((m) => `   · ${m.id}: ${m.ask}`).join("\n")}` : "  Brief complete."}\n  → ${s.next}`);
  } else if (cmd === "brief") {
    const c = await load(target);
    const add = await collectAnswers();
    const unknown = Object.keys(add).filter((k) => !BRIEFS.campaign.questions.some((q) => q.id === k));
    if (unknown.length) fail(`Unknown key(s): ${unknown.join(", ")}. Valid: ${BRIEFS.campaign.questions.map((q) => q.id).join(", ")}`);
    if (LANG) c.language = LANG;
    if (Object.keys(add).length || LANG) { Object.assign(c.answers, add); await save(c); }
    const s = await status(target);
    const nq = nextQuestions("campaign", c.answers, 4, c.language);
    out({ ...s, nextQuestions: nq }, `${renderMarkdown("campaign", c.answers, c.language)}\n${s.readyToDesign ? "✓ Ready to design." : `Missing: ${s.missing.map((m) => m.id).join(", ")}`}\n→ ${s.next}`);
  } else if (cmd === "plan") {
    const c = await load(target);
    if (typeof args.file !== "string") fail("Usage: npx @opency/cli campaign plan <slug> --file plan.json   (a list of { slug, intent, format, channel, date, angle })");
    const plan = await readJSON(path.resolve(args.file), null);
    if (!Array.isArray(plan) || !plan.length) fail("The plan must be a list with at least one piece.");
    for (const [i, p] of plan.entries()) {
      if (!p.slug || !p.angle) fail(`Piece ${i + 1}: slug or angle is missing (the angle in one sentence).`);
      if (p.format && !FORMATS[p.format]) fail(`Piece ${i + 1}: invalid format "${p.format}". Options: ${Object.keys(FORMATS).join(", ")}`);
      if (p.date && !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) fail(`Piece ${i + 1}: the date must be YYYY-MM-DD.`);
    }
    c.plan = plan.map((p) => ({ slug: slugify(p.slug), intent: p.intent ?? "", format: p.format ?? "4:5", channel: p.channel ?? "", date: p.date ?? "", angle: p.angle, ...(p.layouts ? { layouts: p.layouts } : {}) }));
    c.status = "planned";
    await save(c);
    out(await status(target), `✓ Plan saved: ${c.plan.length} piece(s)\n${c.plan.map((p) => `  ${p.date || "no date   "} ${p.format.padEnd(5)} ${p.slug.padEnd(28)} ${p.angle}`).join("\n")}\n  Create each one: npx @opency/cli new <slug> --campaign ${c.slug} --layouts … --date …`);
  } else if (cmd === "status") {
    const s = await status(target);
    out(s, [`${s.name} · ${brand}/${s.slug} · ${s.readyToDesign ? "brief complete" : `${s.missing.length} answer(s) missing`}`,
      ...s.missing.map((m) => `  ✗ ${m.id}: ${m.ask}`),
      s.plan.length ? `Plan: ${s.plan.length} piece(s), ${s.pendingFromPlan.length} not created yet` : "No plan yet.",
      ...s.pieces.map((p) => `  ${p.rendered ? (p.errors ? "✗" : "✓") : "·"} ${p.id.padEnd(40)} ${String(p.format).padEnd(5)} ${p.status.padEnd(10)} ${p.rendered ? `${p.errors} errors · ${p.warnings} warnings` : "not rendered"}`),
      `→ ${s.next}`].join("\n"));
  } else if (cmd === "list") {
    const dirs = (await readdir(CDIR, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory());
    const rows = [];
    for (const d of dirs) { const c = await readJSON(file(d.name), null); if (c) rows.push({ slug: c.slug, name: c.name, status: c.status, pieces: (await piecesOf(c.slug)).length, planned: c.plan?.length ?? 0, updatedAt: c.updatedAt }); }
    out(rows, rows.length ? rows.map((r) => `${r.slug.padEnd(28)} ${r.name} · ${r.pieces}/${r.planned} pieces · ${r.status}`).join("\n") : `(${brand} has no campaigns: npx @opency/cli campaign new <slug> --name "…")`);
  } else {
    console.log((await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  }
} catch (e) { fail(e.message); }
