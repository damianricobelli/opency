#!/usr/bin/env node
// Checks the environment: Node, render browser, ffmpeg, stock keys and workspace.
//   npx opentcy doctor [--json]
import { spawnSync } from "node:child_process";
import { ROOT, hasWorkspace, listBrands, launchBrowser, parseArgs } from "./lib/project.mjs";
import { PROVIDERS } from "./lib/stock.mjs";

const args = parseArgs(process.argv.slice(2));
const checks = [];
const add = (name, ok, detail, fix) => checks.push({ name, ok, detail, ...(ok ? {} : { fix }) });

const [maj, min] = process.versions.node.split(".").map(Number);
add("node", maj > 18 || (maj === 18 && min >= 17), process.versions.node, "Install Node 18.17 or later.");

try { const b = await launchBrowser(); const v = b.version(); await b.close(); add("browser", true, `Chromium ${v}`); }
catch (e) { add("browser", false, e.message, "Run npx opentcy setup, install Google Chrome or set CHROME_PATH."); }

const ff = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
add("ffmpeg (video only)", ff.status === 0, ff.status === 0 ? ff.stdout.split("\n")[0].replace(/ Copyright.*/, "") : "not found", "Optional: install ffmpeg for `opentcy motion`.");

for (const [k, p] of Object.entries(PROVIDERS)) add(`stock: ${p.label}`, !!p.key(), p.keyName ? (p.key() ? `${p.keyName} set` : `${p.keyName} missing`) : "no key needed", p.keyName ? `Optional: free key at ${p.signup}` : undefined);

const ws = hasWorkspace();
add("workspace", ws, ws ? `${ROOT} · brands: ${(await listBrands()).join(", ") || "(none)"}` : `${ROOT} has no brands/ and templates/`, "npx opentcy init");

if (args.json) console.log(JSON.stringify({ ok: checks.filter((c) => !/stock|ffmpeg/.test(c.name)).every((c) => c.ok), checks }, null, 2));
else for (const c of checks) console.log(`${c.ok ? "✓" : /stock|ffmpeg/.test(c.name) ? "·" : "✗"} ${c.name.padEnd(22)} ${c.detail}${c.ok || !c.fix ? "" : `\n    → ${c.fix}`}`);
process.exit(checks.some((c) => !c.ok && !/stock|ffmpeg/.test(c.name)) ? 1 : 0);
