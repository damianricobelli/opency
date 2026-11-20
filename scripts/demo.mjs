#!/usr/bin/env node
// See what opency produces before setting anything up: renders the demo carousel.
//   npx @opency/cli demo [--json]
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, PKG, ensureWorkspace, parseArgs } from "./lib/project.mjs";
import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";

const args = parseArgs(process.argv.slice(2));
const here = path.dirname(fileURLToPath(import.meta.url));
ensureWorkspace();
const piece = path.join(ROOT, "brands/_demo/pieces/example-carousel");
// A workspace created with --no-demo, or an older one, may not have it.
if (!existsSync(piece)) await cp(path.join(PKG, "brands/_demo"), path.join(ROOT, "brands/_demo"), { recursive: true, filter: (src) => !/[\\/](render|versions)([\\/]|$)/.test(src) });
const r = spawnSync(process.execPath, [path.join(here, "render.mjs"), piece], { encoding: "utf8", env: { ...process.env, OPENCY_HOME: ROOT } });
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
const sheet = path.join(piece, "render/contact-sheet.png");
if (args.json) console.log(JSON.stringify({ piece: "example-carousel", brand: "_demo", contactSheet: sheet, dir: path.join(piece, "render") }, null, 2));
else console.log(`${r.stdout.trim()}\n\n✓ This is a real carousel rendered on your machine: ${sheet}\n  Next: load your brand — ask your agent "Load my brand from mysite.com".`);
