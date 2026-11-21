// A brand's identity as data: seven color roles and three type families.
//
//   PRESETS                         house identities to start from when there is no website and no brandbook
//   proposeFromImport(report)       reads `brand import`'s report and proposes the seven roles
//   repair(colors)                  makes every base combination pass contrast, and says what it changed
//   applyColors(tokensCss, colors)  writes the roles into tokens.css, touching nothing else
//   readColors(tokensCss)           the roles currently in tokens.css (plain hex only)
//
// Nothing here decides taste: a proposal is shown to the user on a brand board before anything is designed with it.

export const ROLES = ["primary", "secondary", "accent", "bg", "bg-alt", "ink", "ink-inverse"];

// ---------- Color math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const normHex = (h) => { let x = String(h ?? "").trim().replace(/^#/, ""); if (x.length === 3) x = [...x].map((c) => c + c).join(""); return /^[0-9a-fA-F]{6}/.test(x) ? `#${x.slice(0, 6).toUpperCase()}` : null; };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase();
export const luminance = (h) => { const [r, g, b] = rgb(h).map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export function saturation(h) { const [r, g, b] = rgb(h).map((c) => c / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2; return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)); }
const isDark = (h) => luminance(h) < 0.2;
/** Moves `color` toward black or white until `text` reads on it at `min`:1. */
function tuneBackground(color, text, min) {
  if (contrast(text, color) >= min) return color;
  const toward = luminance(text) > 0.5 ? "#000000" : "#FFFFFF";
  for (let t = 0.08; t <= 1; t += 0.08) { const c = mix(color, toward, t); if (contrast(text, c) >= min) return c; }
  return toward;
}
/** Moves `color` away from `bg` until it reads on it at `min`:1. */
function tuneForeground(color, bg, min) {
  if (contrast(color, bg) >= min) return color;
  const toward = luminance(bg) > 0.5 ? "#000000" : "#FFFFFF";
  for (let t = 0.08; t <= 1; t += 0.08) { const c = mix(color, toward, t); if (contrast(c, bg) >= min) return c; }
  return toward;
}

// ---------- Presets ----------
/** texture: one of base.css's materials. Fonts are open-licensed families, installed by name. */
export const PRESETS = [
  { id: "editorial", name: "Editorial", mood: "Warm paper, a serif that carries the page, one burnt accent. Studios, food, culture, personal brands.",
    colors: { primary: "#1A1714", secondary: "#3B3A2E", accent: "#D9532B", bg: "#F4EFE6", "bg-alt": "#E8E0D2", ink: "#1A1714", "ink-inverse": "#F7F3EC" },
    fonts: { display: "Instrument Serif", body: "Inter", mono: "JetBrains Mono" }, weights: { display: 400, title: 400 }, tracking: { display: "-0.02em", title: "-0.015em" }, texture: "paper", radius: "10px" },
  { id: "studio", name: "Studio", mood: "Black, white and one loud color. Tight grotesque headlines. Agencies, design, product.",
    colors: { primary: "#0E0E0E", secondary: "#2A2A2A", accent: "#E8FF4D", bg: "#FAFAF7", "bg-alt": "#EDEDE8", ink: "#0E0E0E", "ink-inverse": "#FAFAF7" },
    fonts: { display: "Inter Tight", body: "Inter", mono: "JetBrains Mono" }, weights: { display: 800, title: 700 }, tracking: { display: "-0.035em", title: "-0.025em" }, texture: "fine", radius: "6px" },
  { id: "tech", name: "Product", mood: "Deep ink blue, a clean geometric sans, an electric accent. Software, data, B2B.",
    colors: { primary: "#0D1526", secondary: "#1D2D50", accent: "#4F7CFF", bg: "#F6F7FB", "bg-alt": "#E7EAF3", ink: "#0D1526", "ink-inverse": "#F6F7FB" },
    fonts: { display: "Space Grotesk", body: "Inter", mono: "JetBrains Mono" }, weights: { display: 700, title: 600 }, tracking: { display: "-0.03em", title: "-0.02em" }, texture: "fine", radius: "14px" },
  { id: "natural", name: "Natural", mood: "Forest green, cream and clay. A soft serif. Wellness, food, craft, outdoors.",
    colors: { primary: "#1F3A2D", secondary: "#4A5D3A", accent: "#C8693A", bg: "#F3EEE3", "bg-alt": "#E5DECE", ink: "#1C2620", "ink-inverse": "#F3EEE3" },
    fonts: { display: "Fraunces", body: "DM Sans", mono: "JetBrains Mono" }, weights: { display: 600, title: 600 }, tracking: { display: "-0.025em", title: "-0.02em" }, texture: "paper", radius: "20px" },
  { id: "bold", name: "Bold", mood: "Saturated color fields and heavy type. Fitness, events, youth brands, launches.",
    colors: { primary: "#B4301F", secondary: "#141414", accent: "#FFC83D", bg: "#FFF6EA", "bg-alt": "#F5E6D0", ink: "#141414", "ink-inverse": "#FFF6EA" },
    fonts: { display: "Archivo", body: "Inter", mono: "JetBrains Mono" }, weights: { display: 800, title: 700 }, tracking: { display: "-0.035em", title: "-0.025em" }, texture: "coarse", radius: "4px" },
  { id: "luxe", name: "Quiet luxury", mood: "Near-black, bone and a muted metal. A high-contrast serif. Fashion, hospitality, real estate, premium services.",
    colors: { primary: "#16130F", secondary: "#3A332B", accent: "#B89A6A", bg: "#EFEBE4", "bg-alt": "#E0DACF", ink: "#16130F", "ink-inverse": "#EFEBE4" },
    fonts: { display: "Playfair Display", body: "DM Sans", mono: "JetBrains Mono" }, weights: { display: 500, title: 500 }, tracking: { display: "-0.02em", title: "-0.015em" }, texture: "film", radius: "2px" },
  { id: "friendly", name: "Friendly", mood: "Soft violet, warm white and a coral accent. Rounded and approachable. Education, communities, consumer apps.",
    colors: { primary: "#3B2A6B", secondary: "#6B4FB3", accent: "#FF7A59", bg: "#FBF8F4", "bg-alt": "#F0EAF7", ink: "#231A3D", "ink-inverse": "#FBF8F4" },
    fonts: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans", mono: "JetBrains Mono" }, weights: { display: 800, title: 700 }, tracking: { display: "-0.03em", title: "-0.02em" }, texture: "fine", radius: "28px" },
  { id: "mono", name: "Monochrome", mood: "One ink, one paper, no accent color: the accent is weight and scale. Law, finance, architecture, writers.",
    colors: { primary: "#111214", secondary: "#3A3D42", accent: "#111214", bg: "#FFFFFF", "bg-alt": "#F2F3F4", ink: "#111214", "ink-inverse": "#FFFFFF" },
    fonts: { display: "Inter Tight", body: "Inter", mono: "IBM Plex Mono" }, weights: { display: 700, title: 600 }, tracking: { display: "-0.03em", title: "-0.02em" }, texture: "fine", radius: "0px" },
];
export const findPreset = (id) => PRESETS.find((p) => p.id === String(id).toLowerCase() || p.name.toLowerCase() === String(id).toLowerCase());

// ---------- Repair ----------
/**
 * Every base combination has to pass as body text (4.5:1). Returns the fixed roles, the derived tokens
 * (--on-accent, --accent-inverse when the accent cannot be read on the dark surfaces) and what was changed.
 */
export function repair(input) {
  const c = Object.fromEntries(ROLES.map((r) => [r, normHex(input[r])]));
  const notes = [];
  const set = (role, value, why) => { if (value !== c[role]) { notes.push(`${role}: ${c[role] ?? "—"} → ${value} (${why})`); c[role] = value; } };
  c.bg ??= "#FFFFFF"; c.ink ??= isDark(c.bg) ? "#FFFFFF" : "#111214";
  set("ink", tuneForeground(c.ink, c.bg, 7), "text on the background");
  c["bg-alt"] ??= mix(c.bg, c.ink, 0.07);
  set("bg-alt", tuneBackground(c["bg-alt"], c.ink, 7), "text on the alternate background");
  c.primary ??= isDark(c.bg) ? mix(c.ink, c.bg, 0.04) : c.ink;
  c["ink-inverse"] ??= luminance(c.primary) > 0.4 ? "#111214" : "#FFFFFF";
  set("ink-inverse", tuneForeground(c["ink-inverse"], c.primary, 7), "text on the primary surface");
  c.secondary ??= mix(c.primary, c.accent ?? c.ink, 0.3);
  set("secondary", tuneBackground(c.secondary, c["ink-inverse"], 4.5), "inverse text has to read on it");
  c.accent ??= c.primary;
  const derived = { "on-accent": contrast(c.ink, c.accent) >= contrast(c["ink-inverse"], c.accent) ? "var(--ink)" : "var(--ink-inverse)" };
  const worstDark = Math.min(contrast(c.accent, c.primary), contrast(c.accent, c.secondary));
  if (worstDark < 3) {
    let inv = tuneForeground(c.accent, c.primary, 3.2);
    inv = tuneForeground(inv, c.secondary, 3.2);
    derived["accent-inverse"] = inv;
    notes.push(`accent-inverse: ${inv} (the accent ${c.accent} cannot be read on the dark surfaces)`);
  }
  const accentAsText = { "on-bg": contrast(c.accent, c.bg) >= 3, "on-alt": contrast(c.accent, c["bg-alt"]) >= 3 };
  return { colors: c, derived, notes, accentAsText };
}

// ---------- From a website ----------
/** A proposal from `brand import`'s report. The site's own background and text are kept; the rest is chosen by weight. */
export function proposeFromImport(report) {
  const hexes = (list) => (list ?? []).map((x) => normHex(x.color)).filter(Boolean);
  const bg = normHex(report.page?.background) ?? hexes(report.backgrounds)[0] ?? "#FFFFFF";
  const ink = normHex(report.page?.text) ?? hexes(report.inks)[0] ?? "#111214";
  const fromVars = Object.values(report.cssVariables ?? {}).map(normHex).filter(Boolean);
  const pool = [normHex(report.button?.background), ...hexes(report.buttons), ...hexes(report.backgrounds), ...hexes(report.inks), ...fromVars].filter(Boolean);
  const far = (a, b) => contrast(a, b) > 1.25 || Math.abs(saturation(a) - saturation(b)) > 0.25;
  const vivid = [...new Set(pool)].filter((h) => saturation(h) > 0.3 && luminance(h) > 0.03 && luminance(h) < 0.85);
  const accent = vivid[0] ?? null;
  // A dark surface is near-black or a deep, quiet color: a vivid brand color is an accent, not a panel.
  const darks = [...new Set(pool)].filter((h) => (luminance(h) < 0.05 || (isDark(h) && saturation(h) < 0.35))).sort((x, y) => luminance(x) - luminance(y));
  const lightSite = !isDark(bg);
  const primary = lightSite ? (darks[0] ?? (isDark(ink) ? ink : "#111214")) : (pool.find((h) => luminance(h) > 0.6 && saturation(h) < 0.25) ?? (luminance(ink) > 0.6 ? mix(ink, bg, 0.03) : "#F5F3EE"));
  const second = vivid.find((h) => h !== accent && far(h, accent ?? h)) ?? (accent ? mix(primary, accent, 0.35) : null);
  const colors = { primary, secondary: second, accent: accent ?? primary, bg, "bg-alt": null, ink, "ink-inverse": null };
  const sources = { bg: "page background", ink: "page text", accent: accent ? (accent === normHex(report.button?.background) ? "main button" : "most used vivid color") : "none found: the primary is used", primary: lightSite ? (darks[0] ? "darkest surface on the site" : "the text color, as the dark surface") : "a light surface, for contrast with the dark site" };
  // "Inter Variable", "Sora VF", "__Inter_abc123" → the family's public name; system stacks are not a choice.
  const family = (f) => { const n = String(f ?? "").replace(/^__|_[0-9a-f]{6}$|_Fallback.*$/gi, "").replace(/_/g, " ").replace(/\s+(Variable|VF|Var)$/i, "").trim(); return !n || /^(system-ui|-apple-system|blinkmacsystemfont|segoe ui|arial|helvetica|helvetica neue|times|times new roman|georgia|sans-serif|serif|ui-sans-serif|ui-serif|roboto)$/i.test(n) ? null : n; };
  const families = { display: family(report.type?.h1?.family ?? report.type?.h2?.family), body: family(report.type?.body?.family), mono: null };
  const weight = Number(report.type?.h1?.weight) || null;
  return { ...repair(colors), sources, fonts: families, displayWeight: weight, radius: report.button?.radius ?? null, logo: report.logo?.saved ?? null };
}

// ---------- tokens.css ----------
export function readColors(css) {
  return Object.fromEntries(ROLES.map((r) => [r, normHex(css.match(new RegExp(`--${r}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1])]));
}
const setVar = (css, name, value) => {
  const re = new RegExp(`(^[ \\t]*--${name}:[ \\t]*)[^;]*;`, "m");
  return re.test(css) ? css.replace(re, (m, head) => `${head}${value};`) : null;
};
/** Writes roles and derived tokens. Unknown names are added after --accent-base, so the file keeps its shape. */
export function applyColors(css, colors, derived = {}, extra = {}) {
  let out = css;
  const all = { ...colors, ...derived, ...extra };
  // A stale --accent-inverse from the previous identity would outlive it.
  if (!("accent-inverse" in all)) out = out.replace(/^[ \t]*--accent-inverse:[^;]*;[^\n]*\n/m, "");
  for (const [name, value] of Object.entries(all)) {
    if (value === null || value === undefined) continue;
    const next = setVar(out, name, value);
    if (next !== null) out = next;
    else out = out.replace(/(^[ \t]*--accent-base:[^;]*;[^\n]*\n)/m, `$1  --${name}: ${value};\n`);
  }
  return out;
}
