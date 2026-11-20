#!/usr/bin/env node
// Checks the environment: Node, render browser, ffmpeg, stock keys and workspace.
//   npx @opency/cli doctor [--json]
import { spawnSync } from "node:child_process";
import { ROOT, hasWorkspace, listBrands, launchBrowser, parseArgs } from "./lib/project.mjs";
import { PROVIDERS } from "./lib/stock.mjs";

const args = parseArgs(process.argv.slice(2));
const checks = [];
const add = (name, ok, detail, fix) => checks.push({ name, ok, detail, ...(ok ? {} : { fix }) });

const [maj, min] = process.versions.node.split(".").map(Number);
add("node", maj > 20 || (maj === 20 && min >= 9), process.versions.node, "Install Node 20.9 or later.");

try { const b = await launchBrowser(); const v = b.version(); await b.close(); add("browser", true, `Chromium ${v}`); }
catch (e) { add("browser", false, e.message, "Run npx @opency/cli setup, install Google Chrome or set CHROME_PATH."); }

const ff = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
add("ffmpeg (video only)", ff.status === 0, ff.status === 0 ? ff.stdout.split("\n")[0].replace(/ Copyright.*/, "") : "not found", "Optional: install ffmpeg for `opency motion`.");

for (const [k, p] of Object.entries(PROVIDERS)) add(`stock: ${p.label}`, !!p.key(), p.keyName ? (p.key() ? `${p.keyName} set` : `${p.keyName} missing`) : "no key needed", p.keyName ? `Optional: free key at ${p.signup}` : undefined);

const ws = hasWorkspace();
add("workspace", ws, ws ? `${ROOT} · brands: ${(await listBrands()).join(", ") || "(none)"}` : `${ROOT} has no brands/ and templates/`, "npx @opency/cli init");

if (args.json) console.log(JSON.stringify({ ok: checks.filter((c) => !/stock|ffmpeg/.test(c.name)).every((c) => c.ok), checks }, null, 2));
else for (const c of checks) console.log(`${c.ok ? "✓" : /stock|ffmpeg/.test(c.name) ? "·" : "✗"} ${c.name.padEnd(22)} ${c.detail}${c.ok || !c.fix ? "" : `\n    → ${c.fix}`}`);
process.exit(checks.some((c) => !c.ok && !/stock|ffmpeg/.test(c.name)) ? 1 : 0);
