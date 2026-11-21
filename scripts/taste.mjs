#!/usr/bin/env node
// The brand's taste memory: references the user handed over and their explicit reviews of pieces.
//
//   npx @opency/cli taste inspire <url | image file> --note "what the user said they like about it" [--title "…"]
//   npx @opency/cli taste feedback <piece> --verdict liked|rejected|changes --note "the user's words" [--slide N]
//   npx @opency/cli taste show [--json]          what the compositor and the agent read before designing
//   npx @opency/cli taste forget <id>            removes one inspiration or one review
//   All of them: --brand <slug>.
//
// An inspiration is a reference, never an asset: it is kept in brands/<brand>/inspirations/ and cannot be
// placed in a piece. A page is saved as a link (title and cover image read from the page); an image URL or a
// file is copied in. The note is the user's own words: it is what the next session reads.
// A review records the version it was given on and the recipes of the slides it covers. "liked" and "rejected"
// move the compositor's choices for this brand; "changes" is a correction of one piece and teaches nothing
// about structure (references/learning.md).

import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fetchBuffer } from "./lib/stock.mjs";
import { parseArgs, resolveBrand, brandDir, resolvePiece, readJSON, writeJSON, brandOf, today, slugify, ensureWorkspace } from "./lib/project.mjs";
import { readTaste, writeTaste, profile } from "./lib/taste.mjs";

ensureWorkspace();
const args = parseArgs(process.argv.slice(2));
const [cmd, target] = args._;
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const out = (data, text) => console.log(args.json ? JSON.stringify(data, null, 2) : text);
const meta = (html, name) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1]
  ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i"))?.[1] ?? null;
const unique = (list, base) => { let id = base || "ref", i = 2; while (list.some((x) => x.id === id)) id = `${base}-${i++}`; return id; };

async function saveImage(dir, id, buf) {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${id}.jpg`);
  // A reference only needs to be recognizable: 1600 px, no metadata.
  await sharp(buf, { failOn: "none" }).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 86 }).toFile(file);
  return file;
}

try {
  if (cmd === "inspire") {
    if (!target) fail('Usage: npx @opency/cli taste inspire <url | image file> --note "what the user said about it"');
    if (typeof args.note !== "string" || !args.note.trim()) fail("--note is required: what the user said they like about it, in their words.");
    const brand = await resolveBrand(args), dir = path.join(brandDir(brand), "inspirations");
    const taste = await readTaste(brand);
    const entry = { id: null, kind: "link", url: null, title: typeof args.title === "string" ? args.title : null, file: null, note: args.note.trim(), addedAt: today() };
    if (/^https?:\/\//i.test(target)) {
      entry.url = target;
      const { buf, type } = await fetchBuffer(target);
      if (/^image\//i.test(type)) {
        entry.kind = "image";
        entry.id = unique(taste.inspirations, slugify(entry.title ?? path.basename(new URL(target).pathname).replace(/\.[a-z0-9]+$/i, "")).slice(0, 40) || "image");
        entry.file = path.relative(brandDir(brand), await saveImage(dir, entry.id, buf));
      } else {
        const html = buf.toString("utf8").slice(0, 400000);
        entry.title ??= meta(html, "og:title") ?? html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() ?? new URL(target).host;
        entry.id = unique(taste.inspirations, slugify(entry.title).slice(0, 40) || "link");
        const cover = meta(html, "og:image") ?? meta(html, "twitter:image");
        // The cover is a convenience: a page without one (or with one that fails) is still a reference.
        if (cover) { try { entry.file = path.relative(brandDir(brand), await saveImage(dir, entry.id, (await fetchBuffer(new URL(cover, target).href)).buf)); } catch { /* saved as a link */ } }
      }
    } else {
      const buf = await readFile(path.resolve(target)).catch(() => fail(`Cannot read ${target}`));
      entry.kind = "image";
      entry.id = unique(taste.inspirations, slugify(entry.title ?? path.basename(target).replace(/\.[a-z0-9]+$/i, "")).slice(0, 40) || "image");
      entry.file = path.relative(brandDir(brand), await saveImage(dir, entry.id, buf));
    }
    taste.inspirations.push(entry);
    await writeTaste(brand, taste);
    out(entry, `✓ inspiration "${entry.id}" saved for ${brand}${entry.file ? ` (${entry.file})` : ""}\n  note: ${entry.note}\n  It is a reference: it cannot be placed in a piece.`);
  } else if (cmd === "feedback") {
    const verdict = args.verdict;
    if (!["liked", "rejected", "changes"].includes(verdict)) fail("--verdict must be liked, rejected or changes");
    if (typeof args.note !== "string" || !args.note.trim()) fail("--note is required: what the user said, in their words.");
    const dir = await resolvePiece(target, args), brand = brandOf(dir);
    const piece = await readJSON(path.join(dir, "piece.json"));
    const slide = args.slide ? Number(args.slide) : null;
    if (slide && !piece.slides?.some((s) => s.n === slide)) fail(`The piece has no slide ${slide}.`);
    const covered = (piece.slides ?? []).filter((s) => !slide || s.n === slide);
    const taste = await readTaste(brand);
    const entry = {
      id: unique(taste.feedback, `${piece.id}-v${piece.version ?? 1}${slide ? `-s${slide}` : ""}`), piece: piece.id, version: piece.version ?? 1, slide, verdict, note: args.note.trim(),
      recipes: [...new Set(covered.map((s) => s.recipe).filter(Boolean))], layouts: [...new Set(covered.map((s) => s.layout).filter(Boolean))], date: today(),
    };
    taste.feedback.push(entry);
    await writeTaste(brand, taste);
    piece.feedback = [...(piece.feedback ?? []), { date: entry.date, version: entry.version, slide, verdict, note: entry.note }];
    await writeJSON(path.join(dir, "piece.json"), piece);
    const learns = verdict !== "changes" && entry.recipes.length;
    out(entry, `✓ ${verdict} recorded on ${piece.id} v${entry.version}${slide ? ` slide ${slide}` : ""}\n  ${learns ? `The compositor will ${verdict === "liked" ? "favor" : "avoid"}: ${entry.recipes.join(", ")}` : "Recorded as a note on this piece; it does not change how the next ones are composed."}`);
  } else if (cmd === "show") {
    const brand = await resolveBrand(args), p = profile(await readTaste(brand));
    const line = (f) => `  ${f.piece}${f.slide ? ` · slide ${f.slide}` : ""} — ${f.note}`;
    out(p, [
      `Taste of ${brand}`,
      `Structures: ${Object.entries(p.recipes).map(([r, n]) => `${r} ${n > 0 ? "+" : ""}${n}`).join(" · ") || "nothing learned yet"}`,
      p.liked.length ? `Liked:\n${p.liked.map(line).join("\n")}` : null,
      p.rejected.length ? `Rejected:\n${p.rejected.map(line).join("\n")}` : null,
      p.changes.length ? `Corrections:\n${p.changes.map(line).join("\n")}` : null,
      p.inspirations.length ? `Inspirations:\n${p.inspirations.map((i) => `  ${i.id} (${i.kind}) ${i.title ?? i.url ?? ""} — ${i.note}`).join("\n")}` : "No inspirations saved.",
    ].filter(Boolean).join("\n"));
  } else if (cmd === "forget") {
    if (!target) fail("Usage: npx @opency/cli taste forget <id>");
    const brand = await resolveBrand(args), taste = await readTaste(brand);
    const ins = taste.inspirations.find((x) => x.id === target);
    const before = taste.inspirations.length + taste.feedback.length;
    taste.inspirations = taste.inspirations.filter((x) => x.id !== target);
    taste.feedback = taste.feedback.filter((x) => x.id !== target);
    if (before === taste.inspirations.length + taste.feedback.length) fail(`Nothing with id "${target}". See: npx @opency/cli taste show`);
    if (ins?.file) await rm(path.join(brandDir(brand), ins.file), { force: true });
    await writeTaste(brand, taste);
    out({ forgotten: target }, `✓ forgot ${target}`);
  } else {
    console.log((await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  }
} catch (e) { fail(e.message); }
