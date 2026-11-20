#!/usr/bin/env node
// Resultados de las piezas publicadas: registrar y ver qué funciona.
//
//   npx opentcy results add <pieza> --reach 4200 --saves 96 --shares 31 --likes 240 --comments 12 [--follows 8] [--network instagram] [--url …]
//   npx opentcy results                                  ranking y promedios por intención, modo y layout de portada
//
// Los números los pasa la persona (o una herramienta oficial conectada). El agente no los estima ni los inventa.
// Tasa de guardado = guardados / alcance: es la señal más útil para contenido que enseña.
// Con menos de 5 piezas medidas por grupo, los promedios son una pista, no una regla.

import { readdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs, readJSON, writeJSON, resolveBrand, brandDir, resolvePiece, today } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const METRICS = ["reach", "impressions", "saves", "shares", "likes", "comments", "follows", "clicks"];

if (args._[0] === "add") {
  let dir; try { dir = await resolvePiece(args._[1], args); } catch (e) { fail(e.message); }
  const piece = await readJSON(path.join(dir, "piece.json"), {});
  const entry = { date: today(), network: typeof args.network === "string" ? args.network : "instagram" };
  for (const m of METRICS) if (args[m] !== undefined) { const v = Number(args[m]); if (!Number.isFinite(v) || v < 0) fail(`--${m} tiene que ser un número`); entry[m] = v; }
  if (typeof args.url === "string") entry.url = args.url;
  if (Object.keys(entry).length <= 2) fail(`Pasá al menos una métrica: ${METRICS.map((m) => "--" + m).join(" ")}`);
  piece.results = [...(piece.results ?? []).filter((r) => r.network !== entry.network), entry];
  if (piece.status !== "published") { piece.status = "published"; }
  await writeJSON(path.join(dir, "piece.json"), piece);
  console.log(`✓ resultados de ${entry.network} guardados en ${piece.id}`);
  process.exit(0);
}

let slug; try { slug = await resolveBrand(args); } catch (e) { fail(e.message); }
const pdir = path.join(brandDir(slug), "pieces");
const rows = [];
for (const d of await readdir(pdir, { withFileTypes: true }).catch(() => [])) {
  if (!d.isDirectory()) continue;
  const piece = await readJSON(path.join(pdir, d.name, "piece.json"), null);
  const report = await readJSON(path.join(pdir, d.name, "render/report.json"), null);
  for (const r of piece?.results ?? []) {
    if (!r.reach) continue;
    rows.push({ id: d.name, network: r.network, reach: r.reach, saveRate: (r.saves ?? 0) / r.reach, shareRate: (r.shares ?? 0) / r.reach, engagement: ((r.likes ?? 0) + (r.comments ?? 0) + (r.saves ?? 0) + (r.shares ?? 0)) / r.reach,
      intent: piece.direction?.intent || "—", mode: report?.summary?.mode ?? piece.direction?.dominantMode ?? "—", cover: piece.slides?.[0]?.layout ?? "—", slides: piece.slides?.length ?? 0, hook: piece.hook });
  }
}
if (!rows.length) { console.log(`${slug}: todavía no hay resultados cargados. Usá: npx opentcy results add <pieza> --reach … --saves …`); process.exit(0); }
const pct = (x) => (x * 100).toFixed(1).padStart(5) + " %";
rows.sort((a, b) => b.saveRate - a.saveRate);
console.log(`${slug}: ${rows.length} pieza(s) medida(s), por tasa de guardado\n`);
console.log("  guard.  compart.  interac.  alcance  pieza");
for (const r of rows) console.log(`  ${pct(r.saveRate)}  ${pct(r.shareRate)}  ${pct(r.engagement)}  ${String(r.reach).padStart(7)}  ${r.id} · ${r.intent} · ${r.mode} · "${r.hook}"`);
for (const [label, key] of [["intención", "intent"], ["fondo", "mode"], ["layout de portada", "cover"]]) {
  const groups = {};
  for (const r of rows) (groups[r[key]] ??= []).push(r);
  console.log(`\nPor ${label}:`);
  for (const [g, list] of Object.entries(groups).sort((a, b) => avg(b[1], "saveRate") - avg(a[1], "saveRate")))
    console.log(`  ${g.padEnd(16)} guardado ${pct(avg(list, "saveRate"))} · compartido ${pct(avg(list, "shareRate"))} · n=${list.length}${list.length < 5 ? "  (pocas piezas: pista, no regla)" : ""}`);
}
function avg(list, k) { return list.reduce((s, r) => s + r[k], 0) / list.length; }
