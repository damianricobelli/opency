// Auto-repair: pure helpers that turn a render report into safe edits of the slide HTML.
//
// "Safe" means deterministic and unable to change meaning or design intent: no wording, no colors,
// no layout, no image choices, no type sizes. Everything else is listed as skipped with what to do.
// Nothing here touches the disk: scripts/repair.mjs reads, calls planRepairs() and writes.

import path from "node:path";

const pad = (n) => String(n).padStart(2, "0");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** What the agent has to do by hand, by issue code. Codes not listed fall back to DEFAULT_REASON. */
export const SKIP_REASONS = {
  // layout and type
  illegible_text_size: "changing a type size is a design decision: raise the size token or cut text so it fits larger",
  layer_out_of_bounds: "layout change: move or resize the block so it sits inside the canvas",
  outside_safe_area: "layout change: move the element inside the safe area",
  critical_zone: "layout change: move the content above the strip the app UI covers",
  text_overflow: "needs shorter wording or a wider box: neither is automatic",
  critical_overlap: "layout change: separate the two blocks",
  top_stack: "composition: redistribute the content or scale up the hierarchy",
  dead_space: "composition: redistribute the content or scale up the hierarchy",
  over_budget: "copy: shorten the text or switch to a layout designed for more characters",
  alignment_drift: "layout: give the brand mark and the pager the same position and size on every slide",
  template_rhythm: "structure: vary the layouts across slides",
  // color
  unreadable_contrast: "color or layout choice: add a veil or scrim, change the token pair or move the block",
  accent_mass: "color choice: reduce how much of the slide the accent covers",
  brand_literal_color: "color choice: replace each literal with the matching brand token",
  // images and assets
  external_image: "image choice: download it into assets/ and register it (assets add)",
  missing_asset: "image choice: fix the path or add the missing file to the brand's assets",
  image_upscaled: "image choice: use a larger source photo or show it smaller",
  asset_untracked: "image registry: add data-asset with the id from assets/assets.json",
  asset_unregistered: "image registry: register the asset (assets add) or fix the id",
  vetoed_asset: "image choice: the user vetoed this asset, pick another one",
  subject_cropped: "image crop: adjust --fx/--fy or pick another photo or format",
  text_over_subject: "layout or image crop: move the text or the focal point",
  font_not_loaded: "brand setup: put the font files in assets/fonts/ and check the @font-face paths",
  request_failed: "a resource failed to load: fix its path or bring it into the brand's assets",
  // content
  placeholder_left: "copy: fill in the {{…}} placeholders",
  data_tbd: "copy: confirm the figure with the user, then remove the .tbd mark",
  missing_alt_text: "copy: write the alt text for each slide in piece.json",
  unsourced_figure: "figures: add the source to piece.sources or brand.json → verified, or remove the figure",
};
const COPY_REASON = "copy: wording is never rewritten automatically, edit it in the brand's voice";
const DEFAULT_REASON = "no deterministic fix for this code: review it by hand";
const STALE = "already fixed in the files: the report is out of date, render again";

export function skipReason(code) {
  if (SKIP_REASONS[code]) return SKIP_REASONS[code];
  if (/^(copy_|caption_|cover_|linkedin_|x_)/.test(code)) return COPY_REASON;
  return DEFAULT_REASON;
}

// ---------- Locating elements ----------

/**
 * Finds the opening tag render.mjs labelled as `where`: "#id", "tag.firstClass" or "tag".
 * Returns { index, tag } only when exactly one element matches; null otherwise.
 */
export function findTag(html, where) {
  let hits = [];
  const tags = (name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))];
  if (where?.startsWith("#")) {
    hits = [...html.matchAll(new RegExp(`<[a-z][\\w-]*\\b[^>]*\\sid="${escapeRe(where.slice(1))}"[^>]*>`, "gi"))];
  } else if (/^[a-z][\w-]*\.[^\s.]+$/i.test(where ?? "")) {
    const [name, cls] = [where.slice(0, where.indexOf(".")), where.slice(where.indexOf(".") + 1)];
    hits = tags(name).filter((m) => !attr(m[0], "id") && attr(m[0], "class")?.split(" ")[0] === cls);
  } else if (/^[a-z][\w-]*$/i.test(where ?? "")) {
    hits = tags(where).filter((m) => !attr(m[0], "id") && !attr(m[0], "class"));
  }
  return hits.length === 1 ? { index: hits[0].index, tag: hits[0][0] } : null;
}
const replaceTag = (html, found, next) => html.slice(0, found.index) + next + html.slice(found.index + found.tag.length);

// ---------- headline_orphan ----------

/** Simple selectors (tag, .class, #id, tag.class) of every rule that sets text-wrap, with the value it sets. */
function textWrapRules(css) {
  const out = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const value = m[2].match(/(?:^|;)\s*text-wrap\s*:\s*([a-z-]+)/i)?.[1]?.toLowerCase();
    if (value) for (const sel of m[1].split(",")) out.push({ sel: sel.trim(), value });
  }
  return out;
}
function matchesSimple(sel, tag) {
  const m = sel.match(/^([a-z][\w-]*)?(?:\.([\w-]+))?(?:#([\w-]+))?$/i);
  if (!m || !(m[1] || m[2] || m[3])) return false;
  const name = tag.match(/^<([a-z][\w-]*)/i)[1].toLowerCase();
  if (m[1] && m[1].toLowerCase() !== name) return false;
  if (m[2] && !(attr(tag, "class") ?? "").split(/\s+/).includes(m[2])) return false;
  if (m[3] && attr(tag, "id") !== m[3]) return false;
  return true;
}

/**
 * Adds `text-wrap: balance` inline. Returns { html } when it changed something, or { already: true }
 * when the element is balanced as it stands (so balance cannot be what removes the orphan).
 */
export function balanceHeadline(html, where, baseCss = "") {
  const found = findTag(html, where);
  if (!found) return { missing: true };
  const { tag } = found;
  if (/\sstyle='/.test(tag)) return { missing: true };
  const style = attr(tag, "style");
  const inline = style?.match(/(?:^|;)\s*text-wrap\s*:\s*([^;]+)/i)?.[1]?.trim().toLowerCase();
  if (inline?.startsWith("balance")) return { already: true };
  if (inline === undefined) {
    // Without an inline value, the slide's own <style> wins over base.css; the last matching rule decides.
    const slideCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    const last = [...textWrapRules(baseCss), ...textWrapRules(slideCss)].filter((r) => matchesSimple(r.sel, tag)).pop();
    if (last?.value === "balance") return { already: true };
  }
  let next;
  if (style === undefined) next = tag.replace(/\s*\/?>$/, (end) => ` style="text-wrap: balance"${end}`);
  else if (inline !== undefined) next = tag.replace(/(\sstyle="[^"]*?)(text-wrap\s*:\s*)[^;"]+/i, "$1$2balance");
  else next = tag.replace(/\sstyle="([^"]*)"/, (m, s) => ` style="${s.trim().replace(/;$/, "")}${s.trim() ? "; " : ""}text-wrap: balance"`);
  return { html: replaceTag(html, found, next) };
}

// ---------- logo_low_contrast ----------

/** Same rule as new-piece.mjs: the logo variant follows the slide's surface. */
export function logoForSurface(html, logos = {}) {
  const surface = html.match(/class="canvas[^"]*\b(on-primary|on-secondary|photo-slide)\b/)?.[1];
  const logo = surface === "on-primary" ? (logos.onPrimary ?? logos.onDark) : surface ? logos.onDark : logos.onLight;
  return { surface: surface ?? "light", logo: typeof logo === "string" && logo ? logo : null };
}

/** Points the logo <img> at `src`. { html } when changed, { already: true } when it already was. */
export function swapLogo(html, where, src) {
  const found = findTag(html, where);
  if (!found || !/^<img\b/i.test(found.tag) || attr(found.tag, "src") === undefined) return { missing: true };
  if (attr(found.tag, "src") === src) return { already: true };
  return { html: replaceTag(html, found, found.tag.replace(/(\ssrc=")[^"]*(")/, `$1${src}$2`)) };
}

// ---------- pager ----------

const PAGER = /(<span id="pager">)([^<]*)(<\/span>)/;
const PAGER_TEXT = /^(\s*)(\d+)(\s*\/\s*)(\d+)(\s*)$/;

/** Expected "NN/TT" for slide i of `total`, keeping the piece's own padding and separator. */
export function renumberPager(html, n, total, padded = true) {
  const m = html.match(PAGER);
  const t = m?.[2].match(PAGER_TEXT);
  if (!t) return { missing: true }; // no pager, or one that is not a plain counter: leave it alone
  const f = padded ? pad : String;
  const text = `${t[1]}${f(n)}${t[3]}${f(total)}${t[5]}`;
  if (text === m[2]) return { already: true };
  return { html: html.replace(PAGER, `$1${text}$3`), from: m[2].trim(), to: text.trim() };
}
/** A piece pads its pagers unless every one of them is written without a leading zero. */
export function pagersArePadded(htmls) {
  const nums = htmls.map((h) => h.match(PAGER)?.[2].match(PAGER_TEXT)).filter(Boolean).flatMap((t) => [t[2], t[4]]);
  return !nums.length || nums.some((x) => x.length > 1 && x.startsWith("0")) || nums.every((x) => x.length > 1);
}

// ---------- material (texture) ----------

const CANVAS = /(<main class="canvas[^"]*")([^>]*)>/;
export const textureOf = (html) => { const m = html.match(CANVAS); return m ? (attr(m[0], "data-texture") ?? "") : null; };

/** Sets the canvas texture the way new-piece.mjs does: the brand's material, without per-slide grain overrides. */
export function setTexture(html, texture) {
  if (textureOf(html) === null) return { missing: true };
  if (textureOf(html) === (texture || "")) return { already: true };
  return {
    html: html.replace(CANVAS, (m, head, rest) => {
      rest = rest.replace(/\s*data-texture="[^"]*"/, "").replace(/\s*style="--grain:[^";]*;?\s*"/, "").replace(/(\sstyle=")\s*--grain:[^";]*;\s*/, "$1");
      return `${head}${texture ? ` data-texture="${texture}"` : ""}${rest}>`;
    }),
  };
}

// ---------- <html lang> ----------

export function setLang(html, lang) {
  const m = html.match(/<html\b[^>]*>/i);
  if (!m) return { missing: true };
  const current = attr(m[0], "lang");
  if (current === lang) return { already: true };
  const next = current === undefined ? m[0].replace(/^<html/i, `$& lang="${lang}"`) : m[0].replace(/(\slang=")[^"]*(")/, `$1${lang}$2`);
  return { html: html.replace(m[0], next), from: current ?? "(none)" };
}

// ---------- The plan ----------

/**
 * @param report   render/report.json
 * @param piece    piece.json
 * @param brand    { loaded, raw } as returned by loadBrand()
 * @param slides   [{ file, html }] in file order (every slide-NN.html of the piece)
 * @param baseCss  templates/base/base.css (to know which classes already balance their text)
 * @param logoSrc  (brand-relative logo path) → { src, exists }: how a slide references that file
 * @returns { fixed, skipped, files }  files = { [file]: new html } for the slides that change
 */
export function planRepairs({ report, piece = {}, brand = {}, slides, baseCss = "", logoSrc }) {
  const fixed = [], skipped = [];
  const html = Object.fromEntries(slides.map((s) => [s.file, s.html]));
  const original = { ...html };
  const numberOf = (file) => Number(file.match(/\d+/)[0]);
  const reference = piece.status === "reference"; // a library of independent slides: no cross-slide rules
  const seen = new Set();

  const apply = (r, file, entry, action, reason) => {
    if (r.html !== undefined) { html[file] = r.html; fixed.push({ ...entry, action }); }
    else skipped.push({ ...entry, reason: r.missing ? reason : STALE });
  };

  for (const s of report.slides ?? []) {
    for (const issue of s.issues ?? []) {
      const entry = { code: issue.code, slide: s.n, where: issue.where ?? "" };
      const key = `${issue.code}|${s.n}|${issue.where}|${issue.code === "material_drift" ? issue.msg.slice(0, 7) : ""}`;
      const file = s.file;
      if (html[file] === undefined) { skipped.push({ ...entry, reason: `${file} no longer exists: render again` }); continue; }

      if (issue.code === "headline_orphan") {
        if (seen.has(key)) continue; seen.add(key);
        const r = balanceHeadline(html[file], issue.where, baseCss);
        if (r.already) skipped.push({ ...entry, reason: "the headline already has `text-wrap: balance`: if a fresh render still reports it, reword it, remove a forced <br> or change its max-width" });
        else apply(r, file, entry, "balanced the headline's line breaks", `could not locate ${issue.where || "the element"} unambiguously: add \`text-wrap: balance\` to the headline by hand`);
      } else if (issue.code === "logo_low_contrast") {
        if (seen.has(key)) continue; seen.add(key);
        const { surface, logo } = logoForSurface(html[file], brand.raw?.logos);
        const target = logo && logoSrc ? logoSrc(logo) : null;
        if (!logo) skipped.push({ ...entry, reason: `brand.json → logos has no variant for a ${surface} surface: add one (or change the slide's surface)` });
        else if (!target.exists) skipped.push({ ...entry, reason: `the logo variant for a ${surface} surface (${logo}) is not on disk: add the file or fix brand.json → logos` });
        else {
          const r = swapLogo(html[file], issue.where, target.src);
          if (r.already) skipped.push({ ...entry, reason: `the slide already uses the variant for a ${surface} surface (${logo}): if a fresh render still reports it, the artwork itself lacks contrast there, so supply a better variant or change the surface` });
          else apply(r, file, entry, `switched the logo to the variant for a ${surface} surface (${logo})`, `could not locate ${issue.where || "the logo"} as a single <img>: set its src to ${target.src} by hand`);
        }
      } else if (issue.code === "material_drift" && /^texture/.test(issue.msg ?? "")) {
        if (seen.has(key)) continue; seen.add(key);
        const defaults = brand.raw?.defaults;
        if (!brand.loaded || !defaults || !("texture" in defaults)) { skipped.push({ ...entry, reason: "the brand has no default texture (brand.json → defaults.texture): choose one material and set data-texture on every slide" }); continue; }
        const tex = defaults.texture || "";
        let any = false;
        for (const sl of slides) {
          const r = setTexture(html[sl.file], tex);
          if (r.html === undefined) continue;
          html[sl.file] = r.html; any = true;
          fixed.push({ code: issue.code, slide: numberOf(sl.file), where: "main.canvas", action: `set the texture to the brand default ("${tex || "none"}")` });
        }
        if (!any) skipped.push({ ...entry, reason: STALE });
      } else if (issue.code === "material_drift") {
        skipped.push({ ...entry, reason: "photo treatment is a design choice: pick one data-grade and use it on every photo" });
      } else skipped.push({ ...entry, reason: skipReason(issue.code) });
    }
  }
  for (const issue of report.copy ?? []) skipped.push({ code: issue.code, slide: "copy", where: issue.where ?? "", reason: skipReason(issue.code) });

  // Not in the report: read straight from the slides.
  if (!reference) {
    const padded = pagersArePadded(slides.map((s) => html[s.file]));
    slides.forEach((sl, i) => {
      const r = renumberPager(html[sl.file], i + 1, slides.length, padded);
      if (r.html === undefined) return;
      html[sl.file] = r.html;
      fixed.push({ code: "pager_numbering", slide: numberOf(sl.file), where: "#pager", action: `renumbered the pager from ${r.from} to ${r.to}` });
    });
  }
  if (typeof piece.language === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(piece.language)) {
    for (const sl of slides) {
      const r = setLang(html[sl.file], piece.language);
      if (r.html === undefined) continue;
      html[sl.file] = r.html;
      fixed.push({ code: "html_lang", slide: numberOf(sl.file), where: "html", action: `set <html lang> to "${piece.language}" (was ${r.from === "(none)" ? "missing" : `"${r.from}"`})` });
    }
  }

  const files = Object.fromEntries(Object.entries(html).filter(([f, h]) => h !== original[f]));
  return { fixed, skipped, files };
}

/** How a slide inside `pieceDir` references a brand-relative file (posix separators, as written in the HTML). */
export const relativeSrc = (pieceDir, brandDir, file) => path.relative(pieceDir, path.join(brandDir, file)).split(path.sep).join("/");
