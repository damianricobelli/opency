#!/usr/bin/env node
// From "rendered" to "in someone's hands": review, approval and delivery.
//
//   npx @opency/cli handoff review <piece>              one self-contained HTML page to send a client: slides, captions, alt text
//   npx @opency/cli handoff status <piece> <status>     idea | draft | review | approved | scheduled | published
//   npx @opency/cli handoff package <piece> [--force]   a folder ready to upload: numbered images, captions, alt text, checklist
//   All of them: --brand <slug>   ·   --json
//
// `review` needs a render. `package` needs a render with zero errors (or --force) and refuses a piece
// that is not approved unless --force. Nothing here publishes: the user uploads, or a publishing tool
// they connected does it with their confirmation.

import { readFile, writeFile, readdir, mkdir, copyFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ROOT, parseArgs, readJSON, writeJSON, resolvePiece, loadBrand, loadAssets, brandOf, readText, today } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const [cmd, target, value] = args._;
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const out = (data, text) => console.log(args.json ? JSON.stringify(data, null, 2) : text);
const STATUSES = ["idea", "draft", "review", "approved", "scheduled", "published"];
const LIMITS = { instagram: 2200, linkedin: 3000, tiktok: 4000, x: 280 };
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

if (!["review", "status", "package"].includes(cmd)) {
  console.log((await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  process.exit(cmd ? 1 : 0);
}

let dir; try { dir = await resolvePiece(target, args); } catch (e) { fail(e.message); }
const piece = await readJSON(path.join(dir, "piece.json"));
const brand = await loadBrand(brandOf(dir));
const rdir = path.join(dir, "render");
const report = await readJSON(path.join(rdir, "report.json"), null);
const rel = (p) => path.relative(ROOT, p);

/** Rendered slides in order: the JPG when the slide has a photo, else the PNG. */
async function renders() {
  const files = (await readdir(rdir).catch(() => [])).filter((f) => /^slide-\d+\.(png|jpg)$/.test(f));
  const byN = new Map();
  for (const f of files.sort()) { const n = f.match(/\d+/)[0]; if (!byN.has(n) || f.endsWith(".png")) byN.set(n, byN.get(n) ?? f); }
  for (const f of files) { const n = f.match(/\d+/)[0]; const mode = report?.slides?.find((s) => String(s.n).padStart(2, "0") === n)?.mode; if (mode === "photo" && f.endsWith(".jpg")) byN.set(n, f); else if (mode !== "photo" && f.endsWith(".png")) byN.set(n, f); }
  return [...byN.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([n, file]) => ({ n: Number(n), file }));
}

/** Credits the user must carry into the caption (CC BY) or may want to (other stock). */
async function credits() {
  const assets = await loadAssets(brandOf(dir));
  const used = new Set();
  for (const f of (await readdir(dir)).filter((x) => /^slide-\d+\.html$/.test(x))) for (const m of (await readFile(path.join(dir, f), "utf8")).matchAll(/data-asset="([^"]+)"/g)) used.add(m[1]);
  return assets.filter((a) => used.has(a.id) && a.credit).map((a) => ({ asset: a.id, credit: a.credit, license: a.license, required: /^CC BY/i.test(a.license ?? "") }));
}

const captions = () => Object.entries(piece.captions ?? {}).map(([network, c]) => [network, typeof c === "string" ? c : (c?.thread ?? []).join("\n\n")]).filter(([, text]) => text && text.trim());

if (cmd === "status") {
  if (!STATUSES.includes(value)) fail(`Status must be one of: ${STATUSES.join(", ")}`);
  if (["approved", "scheduled", "published"].includes(value) && report?.summary?.errors) fail(`The last render has ${report.summary.errors} error(s): a piece is not approved with errors.`);
  const from = piece.status ?? "draft";
  piece.status = value;
  piece.history = [...(piece.history ?? []), { version: piece.version ?? 1, date: today(), change: `status: ${from} → ${value}`, by: typeof args.by === "string" ? args.by : "persona" }];
  await writeJSON(path.join(dir, "piece.json"), piece);
  out({ piece: piece.id, from, status: value }, `✓ ${piece.id}: ${from} → ${value}${value === "approved" ? "\n  Next: npx @opency/cli handoff package " + piece.id : ""}`);
  process.exit(0);
}

const slides = await renders();
if (!report || !slides.length) fail(`${piece.id} has no render yet. Run: npx @opency/cli render ${piece.id}`);

if (cmd === "review") {
  const images = [];
  for (const s of slides) images.push({ ...s, data: (await sharp(path.join(rdir, s.file)).resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()).toString("base64"), alt: piece.slides?.find((x) => x.n === s.n)?.alt ?? "" });
  const cr = await credits();
  const html = `<!doctype html>
<html lang="${esc(piece.language ?? brand.language ?? "en")}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(piece.title || piece.id)} · ${esc(brand.name)} · review</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f6f3; --fg: #171614; --muted: #6b6862; --line: #dcd9d2; --card: #fff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #111110; --fg: #f1efea; --muted: #a09c94; --line: #2c2b28; --card: #1a1917; } }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 68rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  header p, .meta, figcaption, h2 { color: var(--muted); }
  h1 { font-size: clamp(1.6rem, 4vw, 2.4rem); line-height: 1.1; margin: 0.25rem 0 0.5rem; letter-spacing: -0.02em; }
  .meta { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: 0.06em; }
  h2 { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: 0.08em; margin: 3rem 0 1rem; }
  .slides { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr)); gap: 1.25rem; }
  figure { margin: 0; }
  figure img { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--line); }
  figcaption { font-size: 13px; margin-top: 0.5rem; }
  figcaption b { color: var(--fg); font-weight: 600; }
  .caption { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1rem; }
  .caption pre { white-space: pre-wrap; font: inherit; margin: 0.5rem 0 0; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); }
</style>
</head>
<body>
<main>
  <header>
    <p class="meta">${esc(brand.name)} · for review</p>
    <h1>${esc(piece.title || piece.id)}</h1>
    <p>${esc(piece.direction?.thesis ?? "")}</p>
    <p class="meta">${esc(piece.format)} · ${slides.length} slide${slides.length === 1 ? "" : "s"} · v${piece.version ?? 1} · ${esc(piece.plannedDate ?? "")}</p>
  </header>
  <h2>Slides</h2>
  <div class="slides">
${images.map((s) => `    <figure><img src="data:image/jpeg;base64,${s.data}" alt="${esc(s.alt)}" width="1080"><figcaption><b>${String(s.n).padStart(2, "0")}</b>${s.alt ? ` · ${esc(s.alt)}` : ""}</figcaption></figure>`).join("\n")}
  </div>
  ${captions().length ? `<h2>Captions</h2>\n${captions().map(([n, t]) => `  <section class="caption"><div class="meta">${esc(n)} · ${t.length} characters</div><pre>${esc(t)}</pre></section>`).join("\n")}` : ""}
  ${cr.length ? `<h2>Photo credits</h2>\n<ul>${cr.map((c) => `<li>${esc(c.credit)}${c.required ? " <b>(attribution required)</b>" : ""}</li>`).join("")}</ul>` : ""}
  <footer>Made with opency · ${today()} · Reply with your changes or your approval; nothing is published until you say so.</footer>
</main>
</body>
</html>
`;
  const file = path.join(rdir, "review.html");
  await writeFile(file, html);
  if ((piece.status ?? "draft") === "draft") { piece.status = "review"; await writeJSON(path.join(dir, "piece.json"), piece); }
  out({ piece: piece.id, file: rel(file), absolute: file, bytes: Buffer.byteLength(html), slides: slides.length, status: piece.status }, `✓ ${rel(file)} (${Math.round(Buffer.byteLength(html) / 1024)} kB, self-contained)\n  Send that single file to whoever approves: it opens in any browser, with no account and no server.\n  Status: ${piece.status}`);
} else if (cmd === "package") {
  if (report.summary.errors && !args.force) fail(`The last render has ${report.summary.errors} error(s). Fix them and render again, or pass --force.`);
  if (!["approved", "scheduled", "published"].includes(piece.status) && !args.force) fail(`${piece.id} is "${piece.status ?? "draft"}", not approved. Get the user's yes first (handoff status ${piece.id} approved), or pass --force.`);
  const pdir = path.join(dir, "delivery");
  await rm(pdir, { recursive: true, force: true });
  await mkdir(pdir, { recursive: true });
  const files = [];
  for (const s of slides) { const name = `${String(s.n).padStart(2, "0")}${path.extname(s.file)}`; await copyFile(path.join(rdir, s.file), path.join(pdir, name)); files.push(name); }
  for (const extra of ["carousel.pdf", "reel.mp4"]) if (existsSync(path.join(rdir, extra))) { await copyFile(path.join(rdir, extra), path.join(pdir, extra)); files.push(extra); }
  const caps = captions();
  for (const [network, t] of caps) { await writeFile(path.join(pdir, `caption-${network}.txt`), t + "\n"); files.push(`caption-${network}.txt`); }
  const alt = await readText(path.join(rdir, "alt-text.txt"));
  if (alt) { await writeFile(path.join(pdir, "alt-text.txt"), alt); files.push("alt-text.txt"); }
  const cr = await credits();
  const warnings = [];
  for (const [network, t] of caps) if (LIMITS[network] && t.length > LIMITS[network]) warnings.push(`${network} caption is ${t.length} characters (limit ${LIMITS[network]})`);
  for (const c of cr.filter((x) => x.required)) if (!caps.some(([, t]) => t.includes(c.credit.split(" (")[0]))) warnings.push(`CC BY photo "${c.asset}": add its credit to the caption — ${c.credit}`);
  if (!alt) warnings.push("no alt text: Instagram and LinkedIn both accept it");
  const md = [`# ${piece.title || piece.id} · ready to publish`, "", `${brand.name} · ${piece.format} · ${slides.length} slide(s) · v${piece.version ?? 1}${piece.plannedDate ? ` · planned for ${piece.plannedDate}` : ""}`, "",
    "## Checklist", "", `- [ ] Upload the images in order: ${files.filter((f) => /^\d+\./.test(f)).join(", ")}`,
    ...caps.map(([n]) => `- [ ] ${n}: paste \`caption-${n}.txt\``), alt ? "- [ ] Paste the alt text of each slide from `alt-text.txt`" : null,
    files.includes("carousel.pdf") ? "- [ ] LinkedIn: upload `carousel.pdf` as a document post" : null,
    ...cr.filter((c) => c.required).map((c) => `- [ ] Credit required: ${c.credit}`),
    "- [ ] After publishing, tell the agent the numbers so it can learn what works", "",
    warnings.length ? `## Before you publish\n\n${warnings.map((w) => `- ${w}`).join("\n")}\n` : null,
    "Nothing in this folder was published. You decide when it goes out."].filter((l) => l !== null).join("\n");
  await writeFile(path.join(pdir, "PUBLISH.md"), md + "\n");
  out({ piece: piece.id, dir: rel(pdir), files: [...files, "PUBLISH.md"], warnings, status: piece.status }, `✓ ${rel(pdir)}/ — ${files.length + 1} file(s)\n  ${[...files, "PUBLISH.md"].join(", ")}${warnings.map((w) => `\n  ⚠ ${w}`).join("")}`);
}
