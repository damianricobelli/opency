// Turning a library layout into a slide of a piece.
//
// One place knows how a layout is adopted by a brand: paths, format, language, pager, logo variant for the
// surface, the brand's one texture, and the two things a recipe may decide per slide: the SURFACE
// (on-bg | on-alt | on-primary | on-secondary) and the PATTERN (grid | dots | rings | rays | glow).
// `new-piece` uses it to create a piece; `compose variant` uses it to recompose a slide in place.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, readJSON } from "./project.mjs";

export const SURFACES = ["on-bg", "on-alt", "on-primary", "on-secondary"];
export const PATTERNS = ["grid", "dots", "rings", "rays", "glow"];
export const toneOf = (surface) => (surface === "on-bg" || surface === "on-alt" ? "light" : "dark");
const pad = (x) => String(x).padStart(2, "0");

/** layout name → absolute path of its HTML in the workspace library. */
export async function layoutFiles() {
  const lib = await readJSON(path.join(ROOT, "templates/layouts/piece.json"), { slides: [] });
  return Object.fromEntries(lib.slides.map((s) => [s.layout, path.join(ROOT, "templates/layouts", `slide-${pad(s.n)}.html`)]));
}
export async function readLayout(name) {
  const files = await layoutFiles();
  if (!files[name]) throw new Error(`Unknown layout "${name}". Available: ${Object.keys(files).join(", ")}`);
  return readFile(files[name], "utf8");
}

/**
 * @param {string} html     the source slide (a library layout, a template slide or a slide of another piece)
 * @param {object} o        { brand (loadBrand result), id, n, total, format, layout, language,
 *                            surface?, pattern?, own: true when the source is a library layout (brand texture + logo apply),
 *                            mark: false to leave the brand mark as it is (duplicating a piece) }
 */
export function prepareSlide(html, { brand, id, n, total, format, layout, language, surface = null, pattern = null, own = true, mark = true }) {
  if (surface && SURFACES.includes(surface)) html = html.replace(/(<main class="canvas[^"]*?)\bon-(?:bg|alt|primary|secondary)\b/, `$1${surface}`);
  const current = html.match(/class="canvas[^"]*\b(on-primary|on-secondary|photo-slide)\b/)?.[1];
  const logos = brand.raw?.logos ?? {};
  const logo = current === "on-primary" ? (logos.onPrimary ?? logos.onDark) : current ? logos.onDark : logos.onLight;
  html = html
    .replace(/data-format="[^"]*"/, `data-format="${format}"`)
    .replace(/<html lang="[^"]*"/, `<html lang="${language}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${id} · slide ${n} · ${layout}</title>`)
    .replace(/href="[^"]*tokens\.css"/, 'href="../../tokens.css"')
    .replace(/href="[^"]*base\.css"/, 'href="../../../../templates/base/base.css"')
    .replace(/src="(?:\.\.\/)+(?:brands\/[^/]+\/)?assets\//g, 'src="../../assets/')
    .replace(/(<span id="pager">)[^<]*(<\/span>)/, `$1${pad(n)}/${pad(total)}$2`)
    .replaceAll("{{FORMAT}}", format).replaceAll("{{PIECE_ID}}", id).replaceAll("{{N}}", pad(n)).replaceAll("{{TOTAL}}", pad(total));
  // One material per piece: the texture is the brand's, not the source layout's
  if (brand.loaded && own && brand.raw?.defaults && "texture" in brand.raw.defaults) {
    const tex = brand.raw.defaults.texture;
    html = html.replace(/(<main class="canvas[^"]*")([^>]*)>/, (m, head, rest) => {
      rest = rest.replace(/\s*data-texture="[^"]*"/, "").replace(/\s*style="--grain:[^"]*"/, "");
      return `${head}${tex ? ` data-texture="${tex}"` : ""}${rest}>`;
    });
  }
  if (pattern && PATTERNS.includes(pattern) && current !== "photo-slide") {
    html = html.replace(/(<main class="canvas[^"]*")([^>]*)>/, (m, head, rest) => `${head} data-pattern="${pattern}"${rest.replace(/\s*data-pattern="[^"]*"/, "")}>`);
  }
  if (brand.loaded && mark) {
    const el = logo
      ? `<img id="logo" class="logo" data-role="logo" src="../../${logo}" alt="${brand.name}">`
      : `<span id="brand">${brand.handle || brand.name}</span>`;
    html = html.replace(/<span id="brand">[^<]*<\/span>/, el).replaceAll("{{MARCA}}", brand.handle || brand.name);
  }
  return html;
}

// ---- Can the accent be read as text on each surface? (WCAG 3:1, large text) ----
const hex = (css, name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1] ?? null;
function luminance(h) {
  let x = h.slice(1); if (x.length === 3) x = [...x].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
/** surface → true | false | undefined (a token that is not a plain hex cannot be judged here; the render measures it). */
export function accentLegibility(tokensCss) {
  const accent = hex(tokensCss, "accent"), inverse = hex(tokensCss, "accent-inverse") ?? accent;
  const bg = { "on-bg": hex(tokensCss, "bg"), "on-alt": hex(tokensCss, "bg-alt"), "on-primary": hex(tokensCss, "primary"), "on-secondary": hex(tokensCss, "secondary") };
  return Object.fromEntries(Object.entries(bg).map(([surface, color]) => {
    const fg = toneOf(surface) === "dark" ? inverse : accent;
    return [surface, fg && color ? contrast(fg, color) >= 3.1 : undefined];
  }));
}
