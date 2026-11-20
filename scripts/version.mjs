#!/usr/bin/env node
// Versions of a piece, without depending on git.
//
//   npx opency version <piece> save "what changed" [--by agente|persona]  saves a copy and bumps the version
//   npx opency version <piece> list
//   npx opency version <piece> restore <N>                                goes back to version N (as a new version)
//   npx opency version <piece> diff [N]                                   which texts changed since version N (defaults to the latest)
//
// Each version stores piece.json and the slide-NN.html files in versions/vN/. Restoring overwrites nothing:
// it saves the current state first. `diff` also shows edits made by hand.
// --by takes the stored history values: "agente" (the agent) or "persona" (the user).

import { mkdir, readdir, cp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs, readJSON, writeJSON, resolvePiece, today } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const [pieceArg, cmd = "list", param] = args._;
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
let dir; try { dir = await resolvePiece(pieceArg, args); } catch (e) { fail(`${e.message}\nUsage: npx opency version <piece> save "change" | list | restore N | diff [N]`); }
const vdir = path.join(dir, "versions");
const slideFiles = async (d) => (await readdir(d).catch(() => [])).filter((f) => /^slide-\d+\.html$/.test(f)).sort();

export async function snapshot(dir, change, by = "agente") {
  const piece = await readJSON(path.join(dir, "piece.json"), {});
  const v = piece.version ?? 1;
  const dest = path.join(dir, "versions", `v${v}`);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  for (const f of ["piece.json", ...(await slideFiles(dir))]) await cp(path.join(dir, f), path.join(dest, f));
  piece.version = v + 1;
  (piece.history ??= []).push({ version: piece.version, date: today(), change, by });
  await writeJSON(path.join(dir, "piece.json"), piece);
  return { saved: v, current: piece.version };
}

const texts = (html) => Object.fromEntries([...html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => [m[2], m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()]).filter(([, t]) => t));

if (cmd === "save") {
  const r = await snapshot(dir, param ?? "change", typeof args.by === "string" ? args.by : "agente");
  console.log(`✓ saved v${r.saved}; the piece is now at v${r.current}`);
} else if (cmd === "list") {
  const piece = await readJSON(path.join(dir, "piece.json"), {});
  const saved = new Set((await readdir(vdir).catch(() => [])).map((d) => Number(d.slice(1))));
  for (const h of piece.history ?? []) console.log(`${h.version === piece.version ? "●" : saved.has(h.version) ? "○" : " "} v${String(h.version).padEnd(3)} ${h.date ?? ""}  ${(h.by ?? "").padEnd(8)} ${h.change}`);
  console.log("● current · ○ has a saved copy (can be restored)");
} else if (cmd === "restore") {
  const n = Number(param), src = path.join(vdir, `v${n}`);
  if (!existsSync(src)) fail(`No saved copy of v${n}. Saved: ${(await readdir(vdir).catch(() => [])).join(", ") || "none"}`);
  await snapshot(dir, `before restoring v${n}`);
  const current = await readJSON(path.join(dir, "piece.json"), {});
  for (const f of await slideFiles(dir)) await rm(path.join(dir, f));
  for (const f of await slideFiles(src)) await cp(path.join(src, f), path.join(dir, f));
  const old = await readJSON(path.join(src, "piece.json"), {});
  const restored = { ...old, version: current.version, history: current.history, feedback: current.feedback };
  restored.history[restored.history.length - 1].change = `restored v${n}`;
  await writeJSON(path.join(dir, "piece.json"), restored);
  console.log(`✓ restored v${n} as v${restored.version}. Render again.`);
} else if (cmd === "diff") {
  const saved = (await readdir(vdir).catch(() => [])).map((d) => Number(d.slice(1))).sort((a, b) => a - b);
  const n = param ? Number(param) : saved[saved.length - 1];
  if (!n || !existsSync(path.join(vdir, `v${n}`))) fail("No saved version to compare against. Use `save` first.");
  let changes = 0;
  for (const f of new Set([...(await slideFiles(dir)), ...(await slideFiles(path.join(vdir, `v${n}`)))])) {
    const a = existsSync(path.join(vdir, `v${n}`, f)) ? texts(await readFile(path.join(vdir, `v${n}`, f), "utf8")) : null;
    const b = existsSync(path.join(dir, f)) ? texts(await readFile(path.join(dir, f), "utf8")) : null;
    if (!a) { console.log(`+ ${f} (new slide)`); changes++; continue; }
    if (!b) { console.log(`- ${f} (slide removed)`); changes++; continue; }
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[id] !== b[id]) { console.log(`~ ${f} #${id}\n    before: ${a[id] ?? "—"}\n    now:    ${b[id] ?? "—"}`); changes++; }
  }
  console.log(changes ? `\n${changes} text change(s) since v${n}.` : `No text changes since v${n}.`);
} else fail(`Unknown command "${cmd}".`);
