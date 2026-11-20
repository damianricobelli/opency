#!/usr/bin/env node
// Local preview with text editing.
//
//   npx opency dev <piece> [--port 4321] [--brand slug]
//
// Opens http://localhost:4321 with every slide of the piece, scaled down. It reloads itself whenever a file
// changes (including the ones the agent edits). Double-click a text to edit it; Enter or clicking outside saves,
// Esc cancels. Each edit is written to the slide-NN.html and logged in piece.json (history, by: "persona"):
// the agent treats it as approved and does not overwrite it.
// Only plain texts are editable (an element with an id and no tags inside). Ask for anything else in chat.

import http from "node:http";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { ROOT, FORMATS, parseArgs, readJSON, writeJSON, resolvePiece, today } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
let pieceDir; try { pieceDir = await resolvePiece(args._[0], args); } catch (e) { console.error(`✗ ${e.message}\nUsage: npx opency dev <piece> [--port 4321]`); process.exit(1); }
const port = Number(args.port ?? 4321);
const rel = path.relative(ROOT, pieceDir).split(path.sep).join("/");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff", ".mp4": "video/mp4", ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8" };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Script injected into every served slide: enables double-click editing
const EDITOR = `<script>(() => {
  const file = location.pathname.split("/").pop();
  const editable = (el) => el && el.id && el.children.length === 0 && el.textContent.trim() && !el.closest("[data-chrome]");
  document.addEventListener("mouseover", (e) => { if (editable(e.target)) e.target.style.outline = "3px dashed rgba(120,120,255,.7)"; });
  document.addEventListener("mouseout", (e) => { if (e.target.style && !e.target.isContentEditable) e.target.style.outline = ""; });
  document.addEventListener("dblclick", (e) => {
    const el = e.target; if (!editable(el)) return;
    const before = el.textContent;
    el.contentEditable = "plaintext-only"; el.style.outline = "3px solid #4f46e5"; el.focus();
    const done = async (save) => {
      el.contentEditable = "false"; el.style.outline = ""; el.removeEventListener("keydown", key); el.removeEventListener("blur", blur);
      const text = el.textContent.replace(/\\s+/g, " ").trim();
      if (!save || !text || text === before.trim()) { el.textContent = before; return; }
      const r = await fetch("/__edit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ file, id: el.id, text }) });
      if (!r.ok) { el.textContent = before; parent.postMessage({ type: "edit-error", message: await r.text() }, "*"); }
    };
    const key = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); el.blur(); } if (ev.key === "Escape") { ev.preventDefault(); done(false); } };
    const blur = () => done(true);
    el.addEventListener("keydown", key); el.addEventListener("blur", blur);
  });
})();</script>`;

async function index() {
  const piece = await readJSON(path.join(pieceDir, "piece.json"), {});
  const spec = FORMATS[piece.format ?? "4:5"];
  const files = (await readdir(pieceDir)).filter((f) => /^slide-\d+\.html$/.test(f)).sort();
  const report = await readJSON(path.join(pieceDir, "render/report.json"), null);
  const k = spec.w > 1200 ? 0.3 : 0.36;
  const frames = files.map((f, i) => {
    const issues = report?.slides?.find((s) => s.file === f)?.issues ?? [];
    const badge = issues.length ? `<span class="b ${issues.some((x) => x.severity === "error") ? "e" : "w"}" title="${esc(issues.map((x) => x.code + ": " + x.msg).join("\n"))}">${issues.length}</span>` : "";
    return `<figure><div class="f" style="width:${spec.w * k}px;height:${spec.h * k}px"><iframe src="/${rel}/${f}" style="width:${spec.w}px;height:${spec.h}px;transform:scale(${k})"></iframe></div><figcaption>${i + 1} · ${esc(piece.slides?.[i]?.layout ?? "")} ${badge}</figcaption></figure>`;
  }).join("");
  const cap = Object.entries(piece.captions ?? {}).filter(([, v]) => typeof v === "string" && v.trim()).map(([n, v]) => `<details><summary>Caption ${n}</summary><pre>${esc(v)}</pre></details>`).join("");
  return `<!doctype html><meta charset="utf-8"><title>${esc(piece.title || piece.id || "piece")}</title>
<style>body{margin:0;font:14px/1.4 system-ui;background:#e9e9ec;color:#222}header{padding:16px 24px;background:#fff;border-bottom:1px solid #d4d4d8;position:sticky;top:0;z-index:2}
h1{font-size:16px;margin:0 0 2px}small{color:#666}main{display:flex;flex-wrap:wrap;gap:20px;padding:24px}figure{margin:0}.f{overflow:hidden;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18)}
iframe{border:0;transform-origin:0 0;display:block}figcaption{padding:6px 2px;color:#555}.b{display:inline-block;min-width:18px;text-align:center;border-radius:9px;color:#fff;font-size:12px;padding:0 5px}.e{background:#dc2626}.w{background:#d97706}
aside{padding:0 24px 32px;max-width:720px}pre{white-space:pre-wrap;background:#fff;padding:12px;border:1px solid #d4d4d8}#msg{color:#dc2626}</style>
<header><h1>${esc(piece.title || piece.id || "")}</h1><small>${esc(rel)} · ${piece.format ?? ""} · v${piece.version ?? 1} · ${piece.status ?? ""}${report ? ` · last render: ${report.summary.errors} errors, ${report.summary.warnings} warnings` : " · not rendered"} · double-click a text to edit it</small> <small id="msg"></small></header>
<main>${frames}</main><aside>${cap}</aside>
<script>new EventSource("/__events").onmessage = () => location.reload(); addEventListener("message", (e) => { if (e.data?.type === "edit-error") document.getElementById("msg").textContent = e.data.message; });</script>`;
}

const clients = new Set();
let timer;
const ping = () => { clearTimeout(timer); timer = setTimeout(() => { for (const c of clients) c.write("data: reload\n\n"); }, 150); };
for (const dir of [pieceDir, path.join(pieceDir, "../.."), path.join(ROOT, "templates/base")]) {
  try { watch(dir, (ev, f) => { if (f && /\.(html|css|json|svg)$/.test(f) && !f.startsWith(".")) ping(); }); } catch {}
}

async function applyEdit({ file, id, text }) {
  if (!/^slide-\d+\.html$/.test(file ?? "") || !/^[\w-]+$/.test(id ?? "") || typeof text !== "string" || text.length > 1000) throw new Error("invalid edit");
  const full = path.join(pieceDir, file);
  const html = await readFile(full, "utf8");
  const re = new RegExp(`(<(\\w+)[^>]*\\bid="${escRe(id)}"[^>]*>)([^<]*)(</\\2>)`);
  const m = html.match(re);
  if (!m) throw new Error(`#${id} is not a plain text: ask for that change in chat`);
  const before = m[3].replace(/\s+/g, " ").trim();
  await writeFile(full, html.replace(re, (_, open, _tag, _old, close) => open + esc(text) + close));
  const piece = await readJSON(path.join(pieceDir, "piece.json"), {});
  piece.version = (piece.version ?? 1) + 1;
  (piece.history ??= []).push({ version: piece.version, date: today(), change: `${file} #${id}: «${before}» → «${text}»`, by: "persona" });
  await writeJSON(path.join(pieceDir, "piece.json"), piece);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") { res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" }); return res.end(await index()); }
    if (url.pathname === "/__events") { res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" }); res.write("retry: 1000\n\n"); clients.add(res); req.on("close", () => clients.delete(res)); return; }
    if (url.pathname === "/__edit" && req.method === "POST") {
      let body = ""; for await (const chunk of req) { body += chunk; if (body.length > 20000) throw new Error("too large"); }
      try { await applyEdit(JSON.parse(body)); res.writeHead(204); return res.end(); }
      catch (e) { res.writeHead(400, { "content-type": MIME[".txt"] }); return res.end(e.message); }
    }
    // Static files, only inside the project
    const file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT + path.sep) || /(^|[\\/])(node_modules|\.git)([\\/]|$)/.test(file)) { res.writeHead(403); return res.end(); }
    const st = await stat(file).catch(() => null);
    if (!st?.isFile()) { res.writeHead(404); return res.end("not found"); }
    let data = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    if (/slide-\d+\.html$/.test(file) && path.dirname(file) === pieceDir) data = Buffer.from(data.toString("utf8").replace("</body>", EDITOR + "</body>"));
    res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(data);
  } catch (e) { res.writeHead(500); res.end(String(e.message)); }
});
server.listen(port, "127.0.0.1", () => console.log(`Preview of ${rel}\n→ http://localhost:${port}   (Ctrl+C to stop)`));
