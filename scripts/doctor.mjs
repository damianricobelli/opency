#!/usr/bin/env node
// Verifica el entorno: Node, navegador del render, ffmpeg, claves de stock y workspace.
//   npx opentcy doctor [--json]
import { spawnSync } from "node:child_process";
import { ROOT, hasWorkspace, listBrands, launchBrowser, parseArgs } from "./lib/project.mjs";
import { PROVIDERS } from "./lib/stock.mjs";

const args = parseArgs(process.argv.slice(2));
const checks = [];
const add = (name, ok, detail, fix) => checks.push({ name, ok, detail, ...(ok ? {} : { fix }) });

const [maj, min] = process.versions.node.split(".").map(Number);
add("node", maj > 18 || (maj === 18 && min >= 17), process.versions.node, "Instalá Node 18.17 o superior.");

try { const b = await launchBrowser(); const v = b.version(); await b.close(); add("navegador", true, `Chromium ${v}`); }
catch (e) { add("navegador", false, e.message, "npx opentcy setup, instalá Google Chrome o definí CHROME_PATH."); }

const ff = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
add("ffmpeg (solo video)", ff.status === 0, ff.status === 0 ? ff.stdout.split("\n")[0].replace(/ Copyright.*/, "") : "no encontrado", "Opcional: instalá ffmpeg para `opentcy motion`.");

for (const [k, p] of Object.entries(PROVIDERS)) add(`stock: ${p.label}`, !!p.key(), p.keyName ? (p.key() ? `${p.keyName} definida` : `falta ${p.keyName}`) : "sin clave", p.keyName ? `Opcional: clave gratis en ${p.signup}` : undefined);

const ws = hasWorkspace();
add("workspace", ws, ws ? `${ROOT} · marcas: ${(await listBrands()).join(", ") || "(ninguna)"}` : `${ROOT} no tiene brands/ y templates/`, "npx opentcy init");

if (args.json) console.log(JSON.stringify({ ok: checks.filter((c) => !/stock|ffmpeg/.test(c.name)).every((c) => c.ok), checks }, null, 2));
else for (const c of checks) console.log(`${c.ok ? "✓" : /stock|ffmpeg/.test(c.name) ? "·" : "✗"} ${c.name.padEnd(22)} ${c.detail}${c.ok || !c.fix ? "" : `\n    → ${c.fix}`}`);
process.exit(checks.some((c) => !c.ok && !/stock|ffmpeg/.test(c.name)) ? 1 : 0);
