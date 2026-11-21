#!/usr/bin/env node
// Render + quality control for a piece.
//
// Usage: npx @opency/cli render pieces/<id> [--scale 2] [--only 3] [--pdf] [--strict]
//
// Writes to pieces/<id>/render/:
//   slide-NN.png        sRGB PNG at the format size (× scale)
//   slide-NN.jpg        JPG 95, 4:4:4 chroma (crisp text after Instagram's recompression)
//   contact-sheet.png   every slide at real phone size: this is what the agent inspects
//   carousel.pdf        with --pdf (LinkedIn carousel: one page per slide)
//   report.json / .md   quality findings
//
// Checks (mechanical, composition, photos and copy), measured on the actual render:
//   pixel-level contrast, even over photos and gradients · headline orphans · safe area and critical strip
//   block overlap · clipped text · illegible size on a phone · accent mass
//   upscaled (pixelated) photos · faces/subjects cut by the crop · text over the subject · vetoed assets
//   empty boxes and orphan rules · no dominant element · three slides of one layout in a row · one background throughout
//   photos cropped without an analysis · fonts that failed to load · literal colors outside tokens · unfilled placeholders · copy (lib/copy-lint)

import { readdir, writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import sharp from "sharp";
import { FORMATS, parseArgs, readJSON, writeJSON, loadBrand, loadAssets, brandOf, resolvePiece, launchBrowser, ROOT } from "./lib/project.mjs";
import { lintCopy } from "./lib/copy-lint.mjs";

const args = parseArgs(process.argv.slice(2));
let pieceDir;
try { pieceDir = await resolvePiece(args._[0], args); }
catch (e) { console.error(`✗ ${e.message}\nUsage: npx @opency/cli render <piece id | path> [--brand slug] [--scale 2] [--only N] [--pdf] [--strict]`); process.exit(1); }
const scale = Number(args.scale ?? 1);
if (![1, 2, 3, 4].includes(scale)) { console.error("--scale must be 1, 2, 3 or 4"); process.exit(1); }

const piece = await readJSON(path.join(pieceDir, "piece.json"), {});
const format = piece.format ?? "4:5";
const spec = FORMATS[format];
if (!spec) { console.error(`Unknown format "${format}"`); process.exit(1); }
const brandSlug = brandOf(pieceDir);
const brand = await loadBrand(brandSlug);
const assets = await loadAssets(brandSlug);

let files = (await readdir(pieceDir)).filter((f) => /^slide-\d+\.html$/.test(f)).sort();
if (args.only) files = files.filter((f) => Number(f.match(/\d+/)[0]) === Number(args.only));
if (!files.length) { console.error("No slide-NN.html files to render."); process.exit(1); }

const outDir = path.join(pieceDir, "render");
await mkdir(outDir, { recursive: true });

const launch = () => launchBrowser().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
const browser = await launch();
const context = await browser.newContext({ viewport: { width: spec.w, height: spec.h }, deviceScaleFactor: scale });

// ---------- DOM inspection (runs inside the page) ----------
function inspect({ spec, assets }) {
  const W = spec.w, H = spec.h, S = spec.safe;
  const issues = [];
  const add = (code, el, msg, severity = "warn") => issues.push({ code, where: el ? label(el) : "", msg, severity });
  function label(el) { return el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}`; }
  const inBleed = (el) => !!el.closest("[data-bleed]");
  const isChrome = (el) => !!el.closest("[data-chrome]");
  const visible = (el) => { const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.02; };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());

  // computed color → actual rgba (resolves color-mix, oklab, etc.)
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const toRGBA = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };

  const textRect = (el) => {
    const r = document.createRange(); let box = null;
    for (const n of ownText(el)) {
      r.selectNodeContents(n);
      for (const q of r.getClientRects()) {
        if (!q.width || !q.height) continue;
        box = box ? { l: Math.min(box.l, q.left), t: Math.min(box.t, q.top), r: Math.max(box.r, q.right), b: Math.max(box.b, q.bottom) } : { l: q.left, t: q.top, r: q.right, b: q.bottom };
      }
    }
    return box;
  };

  // ---- Text blocks ----
  const textEls = [...document.body.querySelectorAll("*")].filter((el) => ownText(el).length && visible(el) && !el.closest("script,style,title"));
  const blocks = textEls.filter((el) => !textEls.some((o) => o !== el && o.contains(el)));
  const headlineSel = "h1,h2,h3,.t-hero,.t-cover,.t-closer,.t-title,.t-subtitle,[data-role=headline]";
  const roleOf = (el) => el.dataset.role || (isChrome(el) ? "chrome" : el.matches(headlineSel) ? "headline" : el.matches(".t-intro,[id*=support],[id*=bajada]") ? "support" : el.matches(".label,.t-label,.chip") ? "label" : "body");

  const texts = [];
  const contrastTargets = [];
  for (const el of textEls) {
    const tr = textRect(el); if (!tr) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize), fw = Number(cs.fontWeight) || 400;
    const displayPx = fs * spec.display / W;
    const large = displayPx >= 24 || (displayPx >= 18.66 && fw >= 700);
    contrastTargets.push({ where: label(el), rect: tr, color: toRGBA(cs.color), large, fs });
    const small = isChrome(el) || el.closest(".label,.t-label,.chip,[data-role=label]");
    const minPx = small ? 9 : 10.5;
    if (displayPx < minPx) add("illegible_text_size", el, `${fs.toFixed(0)} px on canvas = ${displayPx.toFixed(1)} pt on a phone (min. ${minPx}${small ? " for labels" : ""})`);
    if (inBleed(el) || el.closest("[aria-hidden=true]")) continue;
    // bounds (tolerance: the glyph area exceeds the line box by ~0.15em above and below)
    const tol = fs * 0.16;
    if (tr.l < -tol || tr.t < -tol || tr.r > W + tol || tr.b > H + tol) add("layer_out_of_bounds", el, "text outside the canvas", "error");
    else if (tr.l < S.left - 2 || tr.t < S.top - tol || tr.r > W - S.right + 2 || tr.b > H - S.bottom + tol) add("outside_safe_area", el, "text outside the safe area");
    else if (!isChrome(el) && tr.b > H - spec.critical + tol && spec.critical > S.bottom) add("critical_zone", el, `content text in the bottom ${spec.critical} px (covered by the app UI); chrome only there`);
    // overflow relative to its own box
    const er = el.getBoundingClientRect();
    if (tr.r > er.right + 2 || tr.l < er.left - 2) add("text_overflow", el, "text overflows its box (word too long for the width)");
    if (cs.overflow !== "visible" && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) add("text_overflow", el, "text clipped by overflow", "error");
  }

  for (const el of blocks) {
    const text = el.innerText.replace(/\s+/g, " ").trim();
    texts.push({ id: el.id || label(el), role: roleOf(el), text, chrome: isChrome(el), fs: Math.round(parseFloat(getComputedStyle(el).fontSize)) });
  }

  // ---- Headline orphans: last line with a single word ----
  for (const el of blocks.filter((b) => b.matches(headlineSel) || b.querySelector(headlineSel))) {
    const r = document.createRange(); const words = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode; const re = /\S+/g; let m;
      while ((m = re.exec(n.textContent))) { r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const q = r.getBoundingClientRect(); if (q.width) words.push({ w: m[0], top: q.top, h: q.height, left: q.left, right: q.right }); }
    }
    if (words.length < 3) continue;
    const lines = [];
    for (const w of words) { const L = lines.find((l) => Math.abs(l.top - w.top) < w.h * 0.5); if (L) { L.words.push(w.w); L.left = Math.min(L.left, w.left); L.right = Math.max(L.right, w.right); } else lines.push({ top: w.top, words: [w.w], left: w.left, right: w.right }); }
    // An orphan is a short word left alone under fuller lines. Display type set in stacked short lines
    // (a poster headline) is not one: there the last line holds its own against the widest.
    const last = lines[lines.length - 1], widest = Math.max(...lines.map((l) => l.right - l.left));
    const stacked = lines.length >= 2 && (last.right - last.left) >= widest * 0.55;
    if (lines.length >= 2 && last.words.length === 1 && !stacked) add("headline_orphan", el, `last line has a single word: "${lines[lines.length - 1].words[0]}"`, "error");
  }

  // ---- Critical overlap between text blocks ----
  const rects = blocks.map((el) => ({ el, r: textRect(el) })).filter((x) => x.r && !inBleed(x.el) && !x.el.closest("[aria-hidden=true]"));
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i].r, b = rects[j].r;
    const ix = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)), iy = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    const minA = Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t));
    if (ix * iy > minA * 0.04) add("critical_overlap", rects[i].el, `overlaps ${label(rects[j].el)}`, "error");
  }

  // ---- Dead space: empty vertical bands inside the content area ----
  {
    const area = W * H;
    const big = [...document.querySelectorAll("img,.photo,video")].some((e) => { const q = e.getBoundingClientRect(); return q.width * q.height > area * 0.5; });
    if (!big) {
      const top = S.top, bottom = H - spec.critical;
      const spans = [];
      for (const { el, r } of rects) if (!isChrome(el)) spans.push([r.t, r.b]);
      for (const e of document.querySelectorAll(".rule,.chip,.card,.glass,.nc,.photo,img,svg,[data-bleed],[aria-hidden=true],.bar,hr,[data-fill]")) {
        if (e.closest("[data-chrome]")) continue;
        const q = e.getBoundingClientRect();
        if (q.width * q.height < area * 0.002 || q.width * q.height > area * 0.6) continue;
        spans.push([q.top, q.bottom]);
      }
      const segs = spans.map(([a, b]) => [Math.max(a, top), Math.min(b, bottom)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
      const zone = bottom - top;
      let cursor = top, middle = 0, topGap = null;
      for (const [a, b] of segs) { if (topGap === null) topGap = a - top; else middle = Math.max(middle, a - cursor); cursor = Math.max(cursor, b); }
      const bottomGap = bottom - cursor;
      const T = (topGap ?? 0) / zone, B = bottomGap / zone, M = middle / zone, pct = (x) => `${Math.round(x * 100)} %`;
      const hint = "spread the content out, scale up the hierarchy or add an element with a purpose";
      if (!segs.length) {}
      else if (B > 0.3 && B - T > 0.15) add("top_stack", null, `content stacked at the top: ${pct(B)} of the area is empty below; ${hint}`);
      else if (T > 0.35 && T - B > 0.15) add("dead_space", null, `content sunk to the bottom: ${pct(T)} empty above; ${hint}`);
      else if (M > 0.4) add("dead_space", null, `${pct(M)} gap in the middle; ${hint}`);
      else if (T > 0.38 && B > 0.38) add("dead_space", null, `content too small for the slide (${pct(T)} empty above and ${pct(B)} below); ${hint}`);
    }
  }

  // ---- Logo ----
  for (const el of document.querySelectorAll("[data-role=logo], .logo, #logo")) {
    const q = el.getBoundingClientRect();
    if (q.left < S.left - 1 || q.top < S.top - 1 || q.right > W - S.right + 1 || q.bottom > H - S.bottom + 1) add("outside_safe_area", el, "logo outside the safe area");
  }

  // ---- Images: missing, external, upscaled, subject crops, text over the subject ----
  const byId = Object.fromEntries(assets.map((a) => [a.id, a]));
  const dpr = window.devicePixelRatio;
  const imgs = [], logos = [];
  for (const img of document.querySelectorAll("img")) {
    const q = img.getBoundingClientRect();
    const src = img.getAttribute("src") || "";
    if (/^https?:/i.test(src)) add("external_image", img, "external image: download it into assets/ and register it (npx @opency/cli assets add)", "error");
    if (!img.complete || !img.naturalWidth) { add("missing_asset", img, `failed to load ${src}`, "error"); continue; }
    const fit = getComputedStyle(img).objectFit;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const s = fit === "contain" ? Math.min(q.width / nw, q.height / nh) : fit === "fill" ? Math.max(q.width / nw, q.height / nh) : Math.max(q.width / nw, q.height / nh);
    const need = s * dpr;
    // A graded photo (grain, tint, darkening) hides a little softness; a clean one does not.
    const grade = img.closest("figure.photo")?.dataset.grade;
    const tolerance = grade && grade !== "none" ? 1.15 : 1.02;
    if (!/\.svg(\?|$)/i.test(src) && need > tolerance && q.width * q.height > 40000) add("image_upscaled", img, `shown at ${(need * 100).toFixed(0)} % of its real size (${nw}×${nh}) → it will look soft/pixelated`, need > 1.3 ? "error" : "warn");
    const id = img.dataset.asset;
    const meta = id ? byId[id] : null;
    const isLogo = img.matches("[data-role=logo], .logo, #logo") || /\/logos\//.test(src);
    if (isLogo) { /* logos are declared in brand.json, not in the photo registry */ }
    else if (!id) add("asset_untracked", img, "image without data-asset: reuse and cropping cannot be checked");
    else if (!isLogo && !meta) add("asset_unregistered", img, `data-asset="${id}" is not in assets/assets.json`);
    if (meta?.vetoed) add("vetoed_asset", img, `asset vetoed by the user: ${id}`, "error");
    if (isLogo && !img.closest("[data-bleed]") && !img.matches("[data-bleed]")) logos.push({ where: label(img), src: img.src, rect: { l: q.left, t: q.top, w: q.width, h: q.height } });
    if (!isLogo) imgs.push({ id, rect: { l: q.left, t: q.top, r: q.right, b: q.bottom } });
    // A photo cropped without a finished analysis: nobody checked what the crop cuts.
    if (meta && !isLogo && !meta.analysis?.complete && (fit === "cover" || fit === "") && q.width * q.height > 200000) {
      const shown = Math.min(1, (q.width / q.height) / (nw / nh), (nw / nh) / (q.width / q.height));
      if (shown < 0.9) add("crop_unverified", img, `${Math.round((1 - shown) * 100)} % of ${id} is cropped away and the photo has no finished analysis: look at it and record its focal point and faces (assets analyze ${id} --focal x,y --protect … --done)`);
    }
    // protected regions (normalized 0–1 coordinates on the original image)
    if (meta?.analysis?.protectedRegions?.length && (fit === "cover" || fit === "")) {
      const pos = getComputedStyle(img).objectPosition.split(" ").map((v) => parseFloat(v) / 100);
      const dw = nw * s, dh = nh * s;
      const ox = q.left + (q.width - dw) * (isNaN(pos[0]) ? 0.5 : pos[0]);
      const oy = q.top + (q.height - dh) * (isNaN(pos[1]) ? 0.5 : pos[1]);
      const clip = { l: Math.max(q.left, 0), t: Math.max(q.top, 0), r: Math.min(q.right, W), b: Math.min(q.bottom, H) };
      for (const pr of meta.analysis.protectedRegions) {
        const R = { l: ox + pr.x * dw, t: oy + pr.y * dh, r: ox + (pr.x + pr.w) * dw, b: oy + (pr.y + pr.h) * dh };
        const cut = R.l < clip.l - 2 || R.t < clip.t - 2 || R.r > clip.r + 2 || R.b > clip.b + 2;
        if (cut) add("subject_cropped", img, `the crop cuts off the ${pr.kind} (${id}); adjust --fx/--fy or the format`, pr.kind === "face" ? "error" : "warn");
        for (const { el, r } of rects) {
          const ix = Math.max(0, Math.min(R.r, r.r) - Math.max(R.l, r.l)), iy = Math.max(0, Math.min(R.b, r.b) - Math.max(R.t, r.t));
          if (ix * iy > (R.r - R.l) * (R.b - R.t) * 0.08) add("text_over_subject", el, `text covers the ${pr.kind} of ${id}`, pr.kind === "face" ? "error" : "warn");
        }
      }
    }
  }

  // ---- Fonts ----
  const generic = /^(system-ui|sans-serif|serif|monospace|ui-monospace|ui-sans-serif|cursive|fantasy|-apple-system|arial|helvetica)$/i;
  const loaded = new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "").toLowerCase()));
  const missing = new Set();
  for (const el of blocks) {
    const fam = getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim();
    if (!generic.test(fam) && !loaded.has(fam.toLowerCase())) missing.add(fam);
  }
  if (missing.size) add("font_not_loaded", null, `failed to load: ${[...missing].join(", ")} → rendered with a fallback font. Prefer local fonts in assets/fonts/`, "error");

  // ---- Placeholders and pending data ----
  if (/\{\{[^}]+\}\}/.test(document.body.innerText)) add("placeholder_left", null, "{{…}} placeholders left unfilled", "error");
  if (document.querySelector(".tbd")) add("data_tbd", null, "data still marked as to be confirmed (.tbd)", "error");

  // ---- Background mode (for feed rhythm) and accent ----
  const mode = document.querySelector(".photo img") ? "photo" : "flat";
  const canvasEl = document.querySelector(".canvas") ?? document.body;
  const accent = toRGBA(getComputedStyle(canvasEl).getPropertyValue("--accent").trim() || "transparent");

  // ---- Objects without a job ----
  const hasText = (el) => el && el.innerText && el.innerText.trim().length > 0;
  for (const el of document.querySelectorAll(".card, .glass, .nc, .tile")) {
    if (!hasText(el) && !el.querySelector("img, svg")) add("decorative_container", el, "an empty box: every visible object needs a job. Remove it or give it content");
  }
  for (const el of document.querySelectorAll(".rule")) {
    const sib = [el.previousElementSibling, el.nextElementSibling, ...(el.parentElement?.children.length === 1 ? [el.parentElement.previousElementSibling, el.parentElement.nextElementSibling] : [])];
    if (!sib.some(hasText)) add("orphan_divider", el, "a rule with nothing next to it to separate or announce: remove it");
  }

  // ---- Character budget declared by the layout (data-max) ----
  for (const el of document.querySelectorAll("[data-max]")) {
    const max = Number(el.dataset.max), len = el.innerText.replace(/\s+/g, " ").trim().length;
    if (max && len > max * 1.2) add("over_budget", el, `${len} characters; this layout is designed for ~${max}. Shorten the text or switch layouts (do not shrink the type)`);
  }

  // ---- Data for cross-slide consistency ----
  const chrome = {};
  for (const el of document.querySelectorAll("[data-chrome] [id], [data-chrome][id]")) { const q = el.getBoundingClientRect(); chrome[el.id] = { l: Math.round(q.left), r: Math.round(q.right), b: Math.round(q.bottom), size: getComputedStyle(el).fontSize }; }
  const material = { texture: canvasEl.dataset?.texture ?? "", grade: document.querySelector(".photo")?.dataset.grade ?? "" };
  const tone = mode === "photo" && canvasEl.classList.contains("photo-slide") ? "photo" : getComputedStyle(canvasEl).backgroundColor;

  return { issues, texts, contrastTargets, mode, accent, images: imgs, logos, chrome, material, tone };
}

// ---------- Pixel measurements ----------
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

async function measureContrast(bgPng, targets) {
  const img = sharp(bgPng); const { width, height } = await img.metadata();
  const raw = await img.removeAlpha().raw().toBuffer();
  const out = [];
  for (const t of targets) {
    if (t.color[3] < 0.05) continue;
    const l = Math.max(0, Math.floor(t.rect.l * scale)), tp = Math.max(0, Math.floor(t.rect.t * scale));
    const r = Math.min(width, Math.ceil(t.rect.r * scale)), b = Math.min(height, Math.ceil(t.rect.b * scale));
    if (r - l < 2 || b - tp < 2) continue;
    const step = Math.max(1, Math.floor(Math.sqrt(((r - l) * (b - tp)) / 4000)));
    const ratios = []; let sum = 0, sum2 = 0, n = 0;
    for (let y = tp; y < b; y += step) for (let x = l; x < r; x += step) {
      const i = (y * width + x) * 3;
      const [br, bg, bb] = [raw[i], raw[i + 1], raw[i + 2]];
      const a = t.color[3];
      const tl = lum(t.color[0] * a + br * (1 - a), t.color[1] * a + bg * (1 - a), t.color[2] * a + bb * (1 - a));
      const bl = lum(br, bg, bb);
      ratios.push(ratio(tl, bl)); sum += bl; sum2 += bl * bl; n++;
    }
    ratios.sort((x, y) => x - y);
    const p10 = ratios[Math.floor(ratios.length * 0.1)];
    const std = Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2));
    out.push({ ...t, p10, busy: std > 0.06 });
  }
  return out;
}

// Logo against its actual background: share of the logo's opaque pixels that are barely distinguishable
async function logoVisibility(flatPng, logo) {
  const w = Math.round(logo.rect.w * scale), h = Math.round(logo.rect.h * scale);
  const left = Math.round(logo.rect.l * scale), top = Math.round(logo.rect.t * scale);
  if (w < 4 || h < 4 || left < 0 || top < 0) return null;
  let lg;
  try { lg = await sharp(fileURLToPath(logo.src), { density: 300 }).resize(w, h, { fit: "fill" }).ensureAlpha().raw().toBuffer(); } catch { return null; }
  const meta = await sharp(flatPng).metadata();
  if (left + w > meta.width || top + h > meta.height) return null;
  const bg = await sharp(flatPng).extract({ left, top, width: w, height: h }).removeAlpha().raw().toBuffer();
  let opaque = 0, lost = 0;
  for (let i = 0, j = 0; i < lg.length; i += 4, j += 3) {
    if (lg[i + 3] < 128) continue;
    opaque++;
    if (ratio(lum(lg[i], lg[i + 1], lg[i + 2]), lum(bg[j], bg[j + 1], bg[j + 2])) < 1.6) lost++;
  }
  return opaque ? lost / opaque : null;
}

async function accentMass(png, accent) {
  if (!accent || accent[3] < 0.5) return 0;
  const { data, info } = await sharp(png).resize(270).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let hit = 0; const total = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    const d = Math.abs(data[i] - accent[0]) + Math.abs(data[i + 1] - accent[1]) + Math.abs(data[i + 2] - accent[2]);
    if (d < 45) hit++;
  }
  return hit / total;
}

// Literal colors in the slide HTML (outside tokens)
function literalColors(html) {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n") + "\n" + [...html.matchAll(/style="([^"]*)"/gi)].map((m) => m[1]).join(";\n");
  const found = new Set();
  for (const line of css.split(/[;\n]/)) {
    if (/shadow|^\s*--(veil|scrim|vignette|grain|fx|fy|duo)/i.test(line)) continue;
    const m = line.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|oklab)\([^)]*\)/gi);
    if (m) m.forEach((c) => found.add(c));
  }
  return [...found];
}

// ---------- Slide loop ----------
const report = { piece: piece.id ?? path.basename(pieceDir), format, scale, renderedAt: new Date().toISOString(), slides: [], copy: [] };
const pngs = [];

for (const file of files) {
  const n = Number(file.match(/\d+/)[0]);
  const page = await context.newPage();
  const netErrors = [];
  page.on("requestfailed", (r) => netErrors.push(r.url()));
  page.on("pageerror", (e) => netErrors.push(`JS: ${e.message}`));
  await page.goto(pathToFileURL(path.join(pieceDir, file)).href, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  // Freeze animations at their final state for the still
  await page.evaluate(async () => {
    document.getAnimations().forEach((a) => { try { a.finish(); } catch { a.pause(); } });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  const dom = await page.evaluate(inspect, { spec, assets });
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: spec.w, height: spec.h }, type: "png" });
  // The deliverable is supersampled: rasterized at twice the size and reduced with Lanczos, which gives
  // cleaner type edges and gradients than rasterizing at the final size. Checks keep using `png`.
  let master = png;
  if (scale === 1 && !args["no-supersample"]) {
    try {
      const cdp = await context.newCDPSession(page);
      const metrics = { width: spec.w, height: spec.h, mobile: false };
      await cdp.send("Emulation.setDeviceMetricsOverride", { ...metrics, deviceScaleFactor: 2 });
      const big = await page.screenshot({ clip: { x: 0, y: 0, width: spec.w, height: spec.h }, type: "png", scale: "device" });
      await cdp.send("Emulation.setDeviceMetricsOverride", { ...metrics, deviceScaleFactor: 1 });
      await cdp.detach();
      if ((await sharp(big).metadata()).width === spec.w * 2) master = await sharp(big).resize(spec.w, spec.h, { kernel: "lanczos3" }).png().toBuffer();
    } catch { /* a browser without this protocol: the direct render is used */ }
  }

  // Background without text, to measure real contrast
  await page.addStyleTag({ content: "*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important}" });
  const bgPng = await page.screenshot({ clip: { x: 0, y: 0, width: spec.w, height: spec.h }, type: "png" });
  // Without photos: to measure accent mass without a similarly toned photo inflating it
  await page.addStyleTag({ content: "img,.photo,video{visibility:hidden!important}" });
  const flatPng = await page.screenshot({ clip: { x: 0, y: 0, width: spec.w, height: spec.h }, type: "png" });
  await page.close();

  const issues = [...dom.issues];
  for (const u of netErrors) issues.push({ code: "request_failed", where: "", msg: `failed to load ${u}`, severity: /fonts\.(googleapis|gstatic)/.test(u) ? "warn" : "error" });

  for (const c of await measureContrast(bgPng, dom.contrastTargets)) {
    const min = c.large ? 3 : 4.5;
    if (c.p10 < min) issues.push({ code: "unreadable_contrast", where: c.where, severity: c.p10 < min * 0.8 ? "error" : "warn",
      msg: `contrast ${c.p10.toFixed(2)}:1 (min. ${min}:1${c.large ? ", large text" : ""})${c.busy ? " over a textured/photo background → add a veil or scrim, or move the block" : ""}` });
  }
  for (const lg of dom.logos) {
    const lost = await logoVisibility(flatPng, lg);
    if (lost !== null && lost > 0.12) issues.push({ code: "logo_low_contrast", where: lg.where, severity: "error", msg: `${Math.round(lost * 100)} % of the logo is indistinguishable from its background: use the variant for this surface (brand.json → logos)` });
  }
  const mass = await accentMass(flatPng, dom.accent);
  if (mass > 0.1) issues.push({ code: "accent_mass", where: "", msg: `the accent covers ${(mass * 100).toFixed(0)} % of the slide (max. ~10 %)`, severity: "warn" });

  // One element has to own the slide: if the largest text is barely larger than the rest, nothing leads.
  const body = dom.texts.filter((t) => !t.chrome && t.role !== "label" && t.fs);
  if (body.length >= 2) {
    const sizes = [...new Set(body.map((t) => t.fs))].sort((a, b) => b - a);
    const weak = sizes.length === 1 ? body.length >= 3 : sizes[0] < sizes[1] * 1.25;
    if (weak) issues.push({ code: "weak_dominant", where: "", msg: `no element leads the slide: the largest text (${sizes[0]} px) is close to the next (${sizes[1] ?? sizes[0]} px). Make one thing clearly bigger or cut the others`, severity: "warn" });
  }
  const lits = literalColors(await readFile(path.join(pieceDir, file), "utf8"));
  if (lits.length) issues.push({ code: "brand_literal_color", where: "", msg: `colors outside tokens: ${lits.slice(0, 5).join(", ")}`, severity: "warn" });

  const base = file.replace(/\.html$/, "");
  await sharp(master).withIccProfile("srgb").png({ compressionLevel: 9 }).toFile(path.join(outDir, `${base}.png`));
  await sharp(master).flatten({ background: "#ffffff" }).withIccProfile("srgb").jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true }).toFile(path.join(outDir, `${base}.jpg`));
  pngs.push({ n, png });

  report.slides.push({ n, file, mode: dom.mode, accentMass: Number(mass.toFixed(3)), texts: dom.texts, images: dom.images.map((i) => i.id).filter(Boolean), chrome: dom.chrome, material: dom.material, tone: dom.tone, issues });
}
await browser.close();

// ---------- Cross-slide consistency ----------
if (!args.only && report.slides.length > 1 && piece.status !== "reference") {
  const first = report.slides[0];
  const drift = new Set(), mat = new Set();
  for (const s of report.slides.slice(1)) {
    for (const [id, c] of Object.entries(s.chrome)) {
      const ref = first.chrome[id]; if (!ref) continue;
      if (Math.abs(c.b - ref.b) > 2 || c.size !== ref.size || (Math.abs(c.l - ref.l) > 2 && Math.abs(c.r - ref.r) > 2)) drift.add(s.n);
    }
    if (s.material.texture !== first.material.texture) mat.add(`slide ${s.n}: texture "${s.material.texture || "none"}"`);
  }
  const grades = new Set(report.slides.map((s) => s.material.grade).filter(Boolean));
  if (drift.size) first.issues.push({ code: "alignment_drift", where: "", msg: `the brand mark or the pager changes position or size on slides ${[...drift].join(", ")} compared to slide 1`, severity: "warn" });
  if (mat.size) first.issues.push({ code: "material_drift", where: "", msg: `texture differs from slide 1 ("${first.material.texture || "none"}") on ${[...mat].join("; ")}. One material per piece`, severity: "warn" });
  if (grades.size > 1) first.issues.push({ code: "material_drift", where: "", msg: `mixed photo treatments: ${[...grades].join(", ")}. One per piece`, severity: "warn" });
  const layouts = (piece.slides ?? []).map((x) => x.layout).filter(Boolean);
  if (layouts.length >= 4 && new Set(layouts).size === 1) first.issues.push({ code: "template_rhythm", where: "", msg: `all ${layouts.length} slides use the same layout (${layouts[0]}): vary the structure`, severity: "warn" });
  else {
    const run = layouts.findIndex((l, i) => i >= 2 && l === layouts[i - 1] && l === layouts[i - 2] && !/^(base|copia|template:)/.test(l));
    if (run >= 0) first.issues.push({ code: "template_rhythm", where: "", msg: `slides ${run - 1}–${run + 1} repeat the same layout (${layouts[run]}): three in a row reads as a template`, severity: "warn" });
  }
  // Five or more slides on one background read as one long slide.
  const tones = report.slides.map((s) => s.tone);
  if (tones.length >= 5 && new Set(tones).size === 1) first.issues.push({ code: "flat_rhythm", where: "", msg: `all ${tones.length} slides sit on the same background (${tones[0]}): give the peak slide another surface`, severity: "warn" });
  // Words only: a carousel that never shows anything.
  const TYPE_ONLY = new Set(["cover-type", "statement", "poster", "closer"]);
  if (layouts.length >= 5 && layouts.every((l) => TYPE_ONLY.has(l))) first.issues.push({ code: "missing_content_visual", where: "", msg: "every slide is a sentence: show one thing (a number, the steps, a comparison, the product, a photo) instead of describing it", severity: "warn" });
}

// ---------- Copy (all slides + captions) ----------
if (!args.only) {
  report.copy = lintCopy({
    slides: report.slides.map((s) => ({ n: s.n, texts: s.texts })),
    captions: piece.captions ?? {},
    voiceSamples: brand.voiceSamples, address: brand.address,
    brandUsesEmoji: brand.usesEmoji, brandUsesDashes: brand.usesDashes, brandName: brand.name,
    verified: brand.verified, sources: piece.sources ?? [],
    language: piece.language, brandLanguage: brand.language,
  });
  const missingAlt = (piece.slides ?? []).filter((s) => !s.alt).map((s) => s.n);
  if (missingAlt.length) report.copy.push({ code: "missing_alt_text", where: `slides ${missingAlt.join(",")}`, msg: "missing alt text (accessibility; Instagram and LinkedIn support it)", severity: "warn" });
}

// ---------- Captions and alt text as paste-ready files ----------
if (!args.only) {
  for (const [net, c] of Object.entries(piece.captions ?? {})) {
    const text = typeof c === "string" ? c : (c?.thread ?? []).map((t, i) => `${i + 1}/ ${t}`).join("\n\n");
    if (text.trim()) await writeFile(path.join(outDir, `caption-${net}.txt`), text.trim() + "\n");
  }
  const alts = (piece.slides ?? []).filter((s) => s.alt).map((s) => `Slide ${s.n}: ${s.alt}`).join("\n");
  if (alts) await writeFile(path.join(outDir, "alt-text.txt"), alts + "\n");
}

// ---------- Contact sheet at phone size ----------
if (!args.only) {
  const tw = spec.display, th = Math.round(spec.h * tw / spec.w), gap = 24, cols = Math.min(pngs.length, 5);
  const rows = Math.ceil(pngs.length / cols);
  const tiles = await Promise.all(pngs.map(async ({ png }, i) => ({
    input: await sharp(png).resize(tw, th, { kernel: "lanczos3" }).png().toBuffer(),
    left: gap + (i % cols) * (tw + gap), top: gap + Math.floor(i / cols) * (th + gap),
  })));
  await sharp({ create: { width: gap + cols * (tw + gap), height: gap + rows * (th + gap), channels: 3, background: "#d9d9d9" } })
    .composite(tiles).png().toFile(path.join(outDir, "contact-sheet.png"));
}

// ---------- PDF (LinkedIn) ----------
if (args.pdf && !args.only) {
  const b2 = await launch();
  const p = await b2.newPage();
  const imgs = pngs.map(({ png }) => `<img src="data:image/png;base64,${png.toString("base64")}">`).join("");
  await p.setContent(`<style>@page{size:${spec.w}px ${spec.h}px;margin:0}body{margin:0}img{display:block;width:${spec.w}px;height:${spec.h}px;page-break-after:always}</style>${imgs}`);
  await p.pdf({ path: path.join(outDir, "carousel.pdf"), width: `${spec.w}px`, height: `${spec.h}px`, printBackground: true });
  await b2.close();
}

// ---------- Report ----------
const all = [...report.slides.flatMap((s) => s.issues.map((i) => ({ ...i, slide: s.n }))), ...report.copy.map((i) => ({ ...i, slide: "copy" }))];
report.summary = { errors: all.filter((i) => i.severity === "error").length, warnings: all.filter((i) => i.severity !== "error").length, mode: report.slides[0]?.mode };
report.cover = { hook: report.slides.find((s) => s.n === 1)?.texts.find((t) => t.role === "headline")?.text ?? "", images: report.slides.find((s) => s.n === 1)?.images ?? [] };
await writeJSON(path.join(outDir, "report.json"), report);

const md = [`# Quality report — ${report.piece}`, "", `${format} · ${files.length} slide(s) · ×${scale} · ${report.summary.errors} errors · ${report.summary.warnings} warnings`, ""];
for (const s of report.slides) {
  md.push(`## Slide ${s.n} (${s.mode})`);
  md.push(s.issues.length ? s.issues.map((i) => `- ${i.severity === "error" ? "**ERROR**" : "warning"} \`${i.code}\` ${i.where} — ${i.msg}`).join("\n") : "- no findings");
  md.push("");
}
md.push("## Copy and captions", report.copy.length ? report.copy.map((i) => `- ${i.severity === "error" ? "**ERROR**" : "warning"} \`${i.code}\` ${i.where} — ${i.msg}`).join("\n") : "- no findings");
await writeFile(path.join(outDir, "report.md"), md.join("\n") + "\n");

// ---------- Console ----------
const rel = (p) => path.relative(process.cwd(), p);
for (const s of report.slides) {
  const e = s.issues.filter((i) => i.severity === "error").length;
  console.log(`${e ? "✗" : s.issues.length ? "⚠" : "✓"} slide ${String(s.n).padStart(2, "0")} (${s.mode})`);
  for (const i of s.issues) console.log(`    ${i.severity === "error" ? "ERROR" : "warning"} ${i.code} ${i.where} — ${i.msg}`);
}
if (report.copy.length) { console.log("copy:"); for (const i of report.copy) console.log(`    ${i.severity === "error" ? "ERROR" : "warning"} ${i.code} ${i.where} — ${i.msg}`); }
console.log(`\n→ ${rel(outDir)}/ (png, jpg${args.pdf ? ", carousel.pdf" : ""}, contact-sheet.png, report.md)`);
console.log(`${report.summary.errors} errors · ${report.summary.warnings} warnings. Look at contact-sheet.png before delivering.`);
if (args.strict && report.summary.errors) process.exit(2);
