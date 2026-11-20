// Brand typefaces by name: Fontsource lookup, download plan, @font-face CSS and the tokens.css patch.
//
//   searchFonts(query)                      → families on Fontsource that match
//   resolveFont(nameOrId)                   → { font, axes } (throws with suggestions when unknown)
//   planFiles(font, axes, opts)             → which .woff2 files to download and how they are named (pure)
//   fontFaceCss(family, files)              → the @font-face rules for those files (pure)
//   patchTokens(css, { family, fontFace, role }) → tokens.css with the rules and --font-<role> set (pure)
//
// Fontsource (fontsource.org) serves open-licensed families (Google Fonts and others):
//   metadata   https://api.fontsource.org/v1/fonts            (whole catalog)
//              https://api.fontsource.org/v1/fonts/<id>       (detail, with file URLs)
//              https://api.fontsource.org/v1/variable/<id>    (axes of a variable family; 404 when static)
//   files      https://cdn.jsdelivr.net/fontsource/fonts/<id>@<version>/<subset>-<weight>-<style>.woff2
//              https://cdn.jsdelivr.net/fontsource/fonts/<id>:vf@<version>/<subset>-wght-<style>.woff2
//   license    https://cdn.jsdelivr.net/npm/@fontsource/<id>@<version>/LICENSE
// Every request goes through fetchBuffer (public addresses only, size cap).

import { fetchBuffer } from "./stock.mjs";

export const API = "https://api.fontsource.org/v1";
export const CDN = "https://cdn.jsdelivr.net/fontsource/fonts";
export const ROLES = ["display", "body", "mono"];
/** Fallback stack used when tokens.css has none for the role. */
export const DEFAULT_FALLBACK = { display: "system-ui, sans-serif", body: "system-ui, sans-serif", mono: "ui-monospace, monospace" };
/** Weight tokens that each role is rendered with (base.css reads them). */
const ROLE_WEIGHT_VARS = { display: ["--weight-display", "--weight-title"], body: ["--weight-body", "--weight-strong"], mono: [] };

const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const getJSON = async (url) => JSON.parse((await fetchBuffer(url)).buf.toString("utf8"));
const is404 = (e) => /^404\b/.test(e?.message ?? "");

// ---------- Catalog ----------
/** "Inter Tight" → "InterTight": the file prefix used in assets/fonts/. */
export const fileBase = (family) => String(family).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "");

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Catalog entries that match the query, best first. With `fuzzy`, falls back to the closest names when nothing matches. */
export function rankFonts(list, query, { limit = 12, fuzzy = false } = {}) {
  const q = String(query).trim().toLowerCase(), qs = slug(query);
  if (!qs) return [];
  const tokens = qs.split("-");
  const scored = [];
  for (const f of list) {
    const fam = f.family.toLowerCase(), words = f.id.split("-");
    let score = null;
    if (f.id === qs || fam === q) score = 0;
    else if (f.id.startsWith(qs + "-")) score = 1;
    else if (f.id.startsWith(qs)) score = 1.5;
    else if (words.some((w) => w.startsWith(qs)) || f.id.includes("-" + qs)) score = 2;
    else if (f.id.includes(qs)) score = 3;
    else if (tokens.every((t) => words.some((w) => w.startsWith(t)))) score = 4;
    if (score !== null) scored.push({ f, score });
  }
  if (!scored.length && fuzzy) {
    const max = Math.max(2, Math.floor(qs.length / 3));
    for (const f of list) { const d = distance(f.id, qs); if (d <= max) scored.push({ f, score: 10 + d }); }
  }
  return scored.sort((a, b) => a.score - b.score || a.f.id.length - b.f.id.length || a.f.id.localeCompare(b.f.id)).slice(0, limit).map((s) => s.f);
}

const summary = (f) => ({ family: f.family, id: f.id, category: f.category, weights: f.weights, styles: f.styles, subsets: f.subsets, variable: !!f.variable, license: f.license });

export async function searchFonts(query, { limit = 12, fuzzy = false } = {}) {
  return rankFonts(await getJSON(`${API}/fonts`), query, { limit, fuzzy }).map(summary);
}

/** Detail of one family plus its variable axes (null when static). Unknown name → error listing the closest families. */
export async function resolveFont(nameOrId) {
  const id = slug(nameOrId);
  if (!id) throw new Error("Missing font family name.");
  let font = await getJSON(`${API}/fonts/${id}`).catch((e) => { if (is404(e)) return null; throw e; });
  if (!font) {
    const list = await getJSON(`${API}/fonts`);
    const exact = list.find((f) => f.family.toLowerCase() === String(nameOrId).trim().toLowerCase());
    if (exact) font = await getJSON(`${API}/fonts/${exact.id}`);
    else {
      const near = rankFonts(list, nameOrId, { limit: 5, fuzzy: true });
      throw new Error(`"${nameOrId}" is not on Fontsource.${near.length ? ` Closest: ${near.map((f) => `${f.family} (${f.id})`).join(", ")}.` : " Try `fonts search` with part of the name; a commercial typeface has to be supplied as .woff2 files."}`);
    }
  }
  let axes = null;
  if (font.variable) axes = (await getJSON(`${API}/variable/${font.id}`).catch((e) => { if (is404(e)) return null; throw e; }))?.axes ?? null;
  return { font, axes };
}

// ---------- Download plan ----------
/** "400,700" → [400, 700]. Throws on anything that is not a list of weights. */
export function parseWeights(value) {
  if (value === undefined || value === null || value === false) return null;
  if (value === true || !String(value).trim()) throw new Error("--weights needs a list, e.g. --weights 400,700");
  const out = String(value).split(",").map((w) => w.trim()).filter(Boolean).map((w) => {
    if (!/^\d{1,4}$/.test(w)) throw new Error(`Invalid weight "${w}". Use numbers, e.g. --weights 400,700`);
    return Number(w);
  });
  return [...new Set(out)].sort((a, b) => a - b);
}

/** 400 and 700 when the family has them; otherwise the closest weights it does have. */
export function defaultWeights(available) {
  const closest = (t) => [...available].sort((a, b) => Math.abs(a - t) - Math.abs(b - t) || a - b)[0];
  return [...new Set([400, 700].map(closest))].filter((w) => w !== undefined).sort((a, b) => a - b);
}

/**
 * Files to download for a family. Pure: no network, no disk.
 * One variable file when the family has a weight axis and no explicit weights were asked for; otherwise one per weight.
 * Throws when a weight, style or subset is not published for the family: nothing is ever substituted.
 */
export function planFiles(font, axes, { weights = null, italic = false, subsets = ["latin"] } = {}) {
  const base = fileBase(font.family);
  for (const s of subsets) if (!font.subsets.includes(s)) throw new Error(`${font.family} has no "${s}" subset. Available: ${font.subsets.join(", ")}.`);
  if (italic && !font.styles.includes("italic")) throw new Error(`${font.family} has no italic. A slanted regular would be synthetic, so it is not installed.`);
  if (!font.styles.includes("normal") && !italic) throw new Error(`${font.family} only exists in italic: add --italic.`);
  const styles = [...(font.styles.includes("normal") ? ["normal"] : []), ...(italic ? ["italic"] : [])];
  const wght = axes?.wght ? [Number(axes.wght.min), Number(axes.wght.max)] : null;
  const variable = !!(font.variable && wght && !weights);
  const version = font.npmVersion || "latest";
  const multi = subsets.length > 1;
  const suffix = (subset, style) => `${subset === "latin" ? "" : `-${subset}`}${style === "italic" ? "-italic" : ""}`;
  const files = [];

  if (variable) {
    for (const subset of subsets) for (const style of styles) files.push({
      file: `${base}-var${suffix(subset, style)}.woff2`, url: `${CDN}/${font.id}:vf@${version}/${subset}-wght-${style}.woff2`,
      weight: wght[0] === wght[1] ? String(wght[0]) : `${wght[0]} ${wght[1]}`, style, subset, variable: true,
      unicodeRange: multi ? font.unicodeRange?.[subset] ?? null : null,
    });
    return { variable, weights: font.weights.filter((w) => w >= wght[0] && w <= wght[1]), weightRange: wght, files };
  }

  const wanted = weights ?? defaultWeights(font.weights);
  const missing = wanted.filter((w) => !font.weights.includes(w));
  if (missing.length) throw new Error(`${font.family} has no weight ${missing.join(", ")}. Available: ${font.weights.join(", ")}.`);
  if (!wanted.length) throw new Error(`${font.family} publishes no weights.`);
  for (const subset of subsets) for (const w of wanted) for (const style of styles) files.push({
    file: `${base}-${w}${suffix(subset, style)}.woff2`,
    url: font.variants?.[w]?.[style]?.[subset]?.url?.woff2 ?? `${CDN}/${font.id}@${version}/${subset}-${w}-${style}.woff2`,
    weight: String(w), style, subset, variable: false,
    unicodeRange: multi ? font.unicodeRange?.[subset] ?? null : null,
  });
  return { variable, weights: wanted, weightRange: null, files };
}

/** Downloads every planned file into memory and checks it really is a woff2. Nothing touches the disk here. */
export async function downloadFiles(files) {
  return Promise.all(files.map(async (f) => {
    let res;
    try { res = await fetchBuffer(f.url); }
    catch (e) {
      // The variable package can lag behind the static one: retry on the latest published version.
      if (!f.variable || !is404(e) || f.url.includes("@latest/")) throw new Error(`Could not download ${f.file}: ${e.message}`);
      res = await fetchBuffer(f.url.replace(/@[^/@]+\//, "@latest/")).catch((e2) => { throw new Error(`Could not download ${f.file}: ${e2.message}`); });
    }
    if (res.buf.subarray(0, 4).toString("latin1") !== "wOF2") throw new Error(`${f.file}: the download is not a woff2 file.`);
    return { ...f, buf: res.buf };
  }));
}

/** License text shipped in the family's npm package, or null when it cannot be fetched. */
export async function fetchLicense(font) {
  for (const v of [...new Set([font.npmVersion, "latest"].filter(Boolean))]) {
    try {
      const { buf } = await fetchBuffer(`https://cdn.jsdelivr.net/npm/@fontsource/${font.id}@${v}/LICENSE`);
      const text = buf.toString("utf8");
      if (text.trim().length > 40 && !/^\s*</.test(text)) return text;
    } catch { /* try the next version */ }
  }
  return null;
}

/** OFL-InterTight.txt, like the demo brand; other licenses keep their own id as prefix. */
export const licenseFileName = (font) => `${/^OFL/i.test(font.license ?? "") ? "OFL" : String(font.license || "LICENSE").replace(/[^A-Za-z0-9.]+/g, "-")}-${fileBase(font.family)}.txt`;

// ---------- CSS ----------
/** One @font-face per file, in the form tokens.css uses (font-display: block, ./assets/fonts/ relative to the brand). */
export function fontFaceCss(family, files) {
  const withStyle = files.some((f) => f.style === "italic");
  return files.map((f) =>
    `@font-face { font-family: "${family}"; font-weight: ${f.weight}; ${withStyle ? `font-style: ${f.style}; ` : ""}font-display: block; src: url("./assets/fonts/${f.file}") format("${f.variable ? "woff2-variations" : "woff2"}");${f.unicodeRange ? ` unicode-range: ${f.unicodeRange};` : ""} }`
  ).join("\n");
}

const commentRanges = (css) => [...css.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => [m.index, m.index + m[0].length]);
const outside = (ranges, i) => !ranges.some(([a, b]) => i >= a && i < b);
const unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, "$2").trim();

/** The @font-face rules of a stylesheet (commented-out ones are ignored). */
export function parseFontFaces(css) {
  const ranges = commentRanges(css);
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].filter((m) => outside(ranges, m.index)).map((m) => {
    const prop = (name) => (m[1].match(new RegExp(`(?:^|;|\\s)${name}\\s*:\\s*([^;]+)`, "i")) || [])[1]?.trim() ?? null;
    const src = prop("src");
    const url = src ? (src.match(/url\(\s*(["']?)([^"')]+)\1\s*\)/) || [])[2] ?? null : null;
    return { start: m.index, end: m.index + m[0].length, family: unquote(prop("font-family") ?? ""), weight: prop("font-weight") ?? "400", style: prop("font-style") ?? "normal", src: url };
  });
}

/** Value of a custom property as declared (first declaration outside comments), or null. */
export function readVar(css, name) {
  const ranges = commentRanges(css);
  const re = new RegExp(`(^|[\\s;{])(${name}\\s*:\\s*)([^;}]*)`, "g");
  for (const m of css.matchAll(re)) if (outside(ranges, m.index + m[1].length)) return { value: m[3].trim(), start: m.index + m[1].length + m[2].length, end: m.index + m[0].length };
  return null;
}

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|math|emoji|fangsong|system-ui|ui-[a-z-]+|-apple-system|blinkmacsystemfont|inherit|initial|unset)$/i;

/** `"New Family", <fallbacks that were already there>`: only the brand's own family (the first name) is replaced. */
export function fontStack(current, family, role) {
  let rest = [];
  if (current && !/var\(/.test(current)) {
    const parts = current.split(",").map((p) => p.trim()).filter(Boolean);
    rest = (parts.length && !GENERIC.test(unquote(parts[0])) ? parts.slice(1) : parts).filter((p) => unquote(p).toLowerCase() !== family.toLowerCase());
  }
  if (!rest.length) rest = [DEFAULT_FALLBACK[role] ?? DEFAULT_FALLBACK.body];
  return `"${family}", ${rest.join(", ")}`;
}

/**
 * tokens.css with the family's @font-face rules inserted (or replaced) and --font-<role> pointing at it.
 * Pure and idempotent: patching the result again returns the same string. Nothing else in the file is touched.
 */
export function patchTokens(css, { family, fontFace, role }) {
  if (!ROLES.includes(role)) throw new Error(`Unknown role "${role}". Use ${ROLES.join(", ")}.`);
  const block = fontFace.trim();
  const all = parseFontFaces(css);
  const own = all.filter((r) => r.family.toLowerCase() === family.toLowerCase());
  let out = css;
  if (own.length) {
    // Later rules of the family go away together with their line; the first one becomes the new block.
    for (const r of own.slice(1).reverse()) {
      let start = r.start;
      while (start > 0 && (out[start - 1] === " " || out[start - 1] === "\t")) start--;
      if (start > 0 && out[start - 1] === "\n") start--; else start = r.start;
      out = out.slice(0, start) + out.slice(r.end);
    }
    out = out.slice(0, own[0].start) + block + out.slice(own[0].end);
  } else if (all.length) {
    const at = all[all.length - 1].end;
    out = out.slice(0, at) + "\n" + block + out.slice(at);
  } else {
    const ranges = commentRanges(out);
    const root = [...out.matchAll(/(^|\n)[ \t]*:root\s*\{/g)].find((m) => outside(ranges, m.index + m[1].length));
    const at = root ? root.index + root[1].length : 0;
    out = out.slice(0, at) + block + "\n\n" + out.slice(at);
  }

  const name = `--font-${role}`;
  const cur = readVar(out, name);
  if (cur) out = out.slice(0, cur.start) + fontStack(cur.value, family, role) + out.slice(cur.end);
  else {
    const decl = `${name}: ${fontStack(null, family, role)};`;
    const ranges = commentRanges(out);
    const root = [...out.matchAll(/:root\s*\{/g)].find((m) => outside(ranges, m.index));
    if (root) { const at = root.index + root[0].length; out = out.slice(0, at) + `\n  ${decl}` + out.slice(at); }
    else out = out.replace(/\n*$/, "\n") + `\n:root {\n  ${decl}\n}\n`;
  }
  return out;
}

/** Weight tokens of the role that the installed files do not cover (the browser would fall back to the nearest weight). */
export function weightWarnings(css, role, plan) {
  const covers = (w) => plan.variable ? w >= plan.weightRange[0] && w <= plan.weightRange[1] : plan.weights.includes(w);
  const out = [];
  for (const name of ROLE_WEIGHT_VARS[role] ?? []) {
    const v = readVar(css, name)?.value;
    if (v && /^\d+$/.test(v) && !covers(Number(v))) out.push(`${name} is ${v}, but the installed weights are ${plan.variable ? plan.weightRange.join("–") : plan.weights.join(", ")}: the browser would use the nearest one. Install that weight with --weights or change the token.`);
  }
  return out;
}

/** Families declared in tokens.css and the role each --font-* variable points at. */
export function describeTokens(css) {
  const faces = parseFontFaces(css);
  const roles = {};
  for (const role of ROLES) {
    const value = readVar(css, `--font-${role}`)?.value ?? null;
    const first = value && !/var\(/.test(value) ? unquote(value.split(",")[0]) : null;
    roles[role] = { family: first, value, declared: !!first && faces.some((f) => f.family.toLowerCase() === first.toLowerCase()) };
  }
  const families = [];
  for (const f of faces) {
    let fam = families.find((x) => x.family.toLowerCase() === f.family.toLowerCase());
    if (!fam) families.push(fam = { family: f.family, roles: ROLES.filter((r) => roles[r].family?.toLowerCase() === f.family.toLowerCase()), faces: [] });
    fam.faces.push({ weight: f.weight, style: f.style, src: f.src });
  }
  return { families, roles };
}
