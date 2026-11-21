// The compositor: from what a slide has to SAY to how it is laid out.
//
// The agent decides the narrative, one design direction and each slide's job. This module decides the
// layout: for every slide it lists the recipes that can show exactly that content, scores them against
// explicit design criteria and picks one, with the reason in words. No model runs here and nothing is
// invented: the same intent always resolves to the same piece.
//
//   resolvePiece(intent, context) → { slides: [{ recipe, layout, surface, reason, spec, alternatives }], unresolved, pattern }
//
// A slide's intent:
//   { role, kicker?, claim, support?, labels?: [left, right], cta?, emphasis?, image?: { asset }, proof?: { kind, … }, alt? }
// Proof kinds: number · steps · comparison · bars · quote · chat · window · cards · logos · definition · prompt · event · cobrand
//
// The criteria (each one adds or subtracts points; the sum picks the recipe):
//   fit        the copy fills its slot the way the layout was drawn for (not lost in it, not squeezed)
//   job        the recipe was designed for this slide's role
//   dominant   it follows the piece's dominant mode (type, photo, data, artifact)
//   image      a usable photo is used; a photo that cannot be cropped safely is not
//   rhythm     no layout twice in a row, no three slides of the same family or the same tone in a row
//   peak       hero recipes (poster, big number, definition) happen once per piece
//   density    airy, balanced or dense, as the direction asks
//   accent     a highlighted word only goes on a surface where the brand's accent is readable
//   taste      what the user liked or rejected in earlier pieces of this brand

import { toneOf } from "./piece.mjs";

export const ROLES = ["hook", "context", "point", "proof", "how", "compare", "offer", "close"];
export const DIRECTION = {
  dominantMode: ["type", "photo", "data", "artifact", "mixed"],
  density: ["airy", "balanced", "dense"],
  variance: ["calm", "varied"],
  continuityDevice: ["none", "pattern", "corner-labels", "kicker"],
};
const ALL = ["on-bg", "on-alt", "on-primary", "on-secondary"];
const LIGHT = ["on-bg", "on-alt"];
const FULL_BLEED = new Set(["photo_cover", "photo_duotone", "photo_prompt", "photo_event", "photo_cobrand"]);

class Unfit extends Error {}
const unfit = (why) => { throw new Unfit(why); };
const len = (t) => String(t ?? "").replace(/\*/g, "").trim().length;
/** The claim with its one emphasized word marked for the accent color. */
function headline(s) {
  const c = String(s.claim ?? "").trim();
  if (!s.emphasis || c.includes("*")) return c;
  const i = c.toLowerCase().indexOf(String(s.emphasis).toLowerCase());
  return i < 0 ? c : `${c.slice(0, i)}*${c.slice(i, i + s.emphasis.length)}*${c.slice(i + s.emphasis.length)}`;
}
const need = (v, what) => (v === undefined || v === null || v === "" ? unfit(`needs ${what}`) : v);
const list = (v, what, max) => {
  if (!Array.isArray(v) || !v.length) unfit(`needs ${what}`);
  if (v.length > max) unfit(`holds ${max} ${what}; this slide has ${v.length} (split it in two slides)`);
  return v;
};
/** ids a1…aN filled from a list, the rest removed. */
const spread = (prefix, items, total, pick = (x) => x) => Object.fromEntries(Array.from({ length: total }, (_, i) => [`${prefix}${i + 1}`, items[i] !== undefined ? pick(items[i], i) : null]));

/**
 * id        stable name, reported with every slide
 * family    type | photo | structure | artifact | voice (rhythm and variants work on families)
 * roles     the jobs it was drawn for, best first
 * fields    the content fields it can show; a slide with a field outside this list is not eligible
 * proof     the proof kind it shows (null: none)
 * surfaces  the surfaces it works on (first = the layout's own); null = fixed by the layout
 * main      the slot whose fill decides `fit`
 */
export const RECIPES = [
  { id: "type_cover", layout: "cover-type", family: "type", roles: ["hook"], fields: ["kicker", "claim", "support"], proof: null, surfaces: ["on-bg", "on-alt", "on-primary", "on-secondary"], density: "airy", main: "headline",
    what: "Typographic cover: a large headline, one accent shape that bleeds off the canvas.",
    map: (s) => ({ slots: { kicker: s.kicker ?? null, headline: headline(s), support: s.support ?? null } }) },
  { id: "type_poster", layout: "poster", family: "type", roles: ["hook", "point", "close"], fields: ["kicker", "labels", "claim", "support"], proof: null, surfaces: ["on-secondary", "on-primary", "on-bg", "on-alt"], density: "airy", main: "headline", peak: true,
    what: "A color field with one very short line in hero type and a small label on each top corner.",
    map: (s) => {
      const labels = [...(s.labels ?? [])];
      if (s.kicker) labels.length < 2 ? labels.unshift(s.kicker) : unfit("has two corner labels and no room for the kicker");
      return { slots: { "meta-left": labels[0] ?? null, "meta-right": labels[1] ?? null, headline: headline(s), support: s.support ?? null } };
    } },
  { id: "type_statement", layout: "statement", family: "type", roles: ["point", "context", "proof", "offer"], fields: ["kicker", "claim", "support"], proof: null, surfaces: ["on-primary", "on-secondary", "on-bg", "on-alt"], density: "balanced", main: "headline",
    what: "One sentence that owns the slide, with a short accent rule above it.",
    map: (s) => ({ slots: { kicker: s.kicker ?? null, headline: headline(s), support: s.support ?? null } }) },
  { id: "type_number", layout: "big-number", family: "type", roles: ["proof", "point", "hook"], fields: ["kicker", "claim", "support"], proof: "number", surfaces: ["on-alt", "on-bg", "on-primary", "on-secondary"], density: "airy", main: "headline", peak: true,
    what: "One quantity at twice hero size and the line that explains it.",
    map: (s) => ({ slots: { kicker: s.kicker ?? null, number: `${need(s.proof.value, "proof.value")}${s.proof.unit ?? ""}`, headline: headline(s), support: s.support ?? null } }) },
  { id: "number_poster", layout: "poster", family: "type", roles: ["proof", "point"], fields: ["kicker", "labels", "claim"], proof: "number", surfaces: ["on-secondary", "on-primary", "on-bg", "on-alt"], density: "airy", main: "support", peak: true,
    what: "The quantity as a poster: the number in hero type on a color field, the claim under it.",
    map: (s) => {
      const labels = [...(s.labels ?? [])];
      if (s.kicker) labels.length < 2 ? labels.unshift(s.kicker) : unfit("has two corner labels and no room for the kicker");
      return { slots: { "meta-left": labels[0] ?? null, "meta-right": labels[1] ?? null, headline: `${need(s.proof.value, "proof.value")}${s.proof.unit ?? ""}`, support: String(s.claim).replace(/\*/g, "") } };
    } },
  { id: "type_closer", layout: "closer", family: "type", roles: ["close"], fields: ["kicker", "claim", "cta"], proof: null, surfaces: ["on-primary", "on-secondary", "on-bg", "on-alt"], density: "balanced", main: "headline",
    what: "A closing line and one call to action in a bar.",
    map: (s) => ({ slots: { kicker: s.kicker ?? null, headline: headline(s), "cta-text": need(s.cta, "a cta (one action that names its object)") } }) },
  { id: "definition", layout: "definition", family: "artifact", roles: ["hook", "context", "point"], fields: ["kicker", "claim"], proof: "definition", surfaces: ["on-secondary", "on-primary", "on-bg", "on-alt"], density: "airy", main: "meaning", peak: true, ownTitle: true,
    what: "A dictionary entry: the word in hero type with its pronunciation, origin and meaning.",
    map: (s) => ({ slots: { term: need(s.proof.term, "proof.term"), phonetic: s.proof.phonetic ?? null, origin: s.proof.origin ?? null, meaning: need(s.proof.meaning, "proof.meaning"), kicker: s.kicker ?? null } }) },

  { id: "photo_cover", layout: "cover-photo", family: "photo", roles: ["hook"], fields: ["kicker", "claim", "support", "image"], proof: null, surfaces: null, tone: "dark", needsImage: true, density: "balanced", main: "headline",
    what: "Full-bleed photo with a veil, a chip and the headline on top.",
    map: (s) => ({ slots: { tag: s.kicker ?? null, headline: headline(s), support: s.support ?? null }, image: s.image }) },
  { id: "photo_duotone", layout: "photo-duotone", family: "photo", roles: ["hook", "point", "context"], fields: ["kicker", "labels", "claim", "support", "image"], proof: null, surfaces: null, tone: "dark", needsImage: true, density: "airy", main: "headline",
    what: "Full-bleed photo tinted in one brand color, corner labels on top and the headline at the bottom.",
    map: (s) => {
      const labels = [...(s.labels ?? [])];
      if (s.kicker) labels.length < 2 ? labels.unshift(s.kicker) : unfit("has two corner labels and no room for the kicker");
      return { slots: { "meta-left": labels[0] ?? null, "meta-right": labels[1] ?? null, headline: headline(s), support: s.support ?? null }, image: s.image };
    } },
  { id: "photo_card", layout: "photo-card", family: "photo", roles: ["point", "context", "proof", "offer", "hook"], fields: ["kicker", "claim", "support", "image"], proof: null, surfaces: null, tone: "dark", needsImage: true, density: "balanced", main: "headline",
    what: "A photo on top that fades into a dark surface, the headline large on the seam.",
    map: (s) => ({ slots: { kicker: s.kicker ?? null, headline: headline(s), support: s.support ?? null }, image: s.image }) },
  { id: "photo_prompt", layout: "prompt", family: "artifact", roles: ["hook", "point", "offer", "how"], fields: ["claim", "support", "image"], proof: "prompt", surfaces: null, tone: "dark", needsImage: true, density: "balanced", main: "headline",
    what: "A photo, a headline and a message box with the request written in it: the product in one gesture.",
    map: (s) => ({ slots: { headline: headline(s), support: s.support ?? null, prompt: need(s.proof.text, "proof.text") }, image: s.image }) },
  { id: "photo_event", layout: "event", family: "photo", roles: ["hook", "offer"], fields: ["kicker", "claim", "image"], proof: "event", surfaces: null, tone: "dark", needsImage: true, density: "dense", main: "headline", ownTitle: true,
    what: "An event poster over a photo: the name in hero type between two rows of facts.",
    map: (s) => ({ slots: { ...spread("f", list(s.proof.facts, "facts", 6), 6), headline: need(s.proof.name, "proof.name"), tag: s.kicker ?? null }, image: s.image }) },
  { id: "photo_cobrand", layout: "cobrand", family: "photo", roles: ["hook", "offer", "context"], fields: ["claim", "support", "image"], proof: "cobrand", surfaces: null, tone: "dark", needsImage: true, density: "airy", main: "support", ownTitle: true,
    what: "A photo with two brand names joined by a cross and one line of text.",
    map: (s) => ({ slots: { a: need(s.proof.a, "proof.a"), x: "×", b: need(s.proof.b, "proof.b"), support: s.support ?? String(s.claim).replace(/\*/g, "") }, image: s.image }) },

  { id: "steps", layout: "steps", family: "structure", roles: ["how", "point", "context"], fields: ["claim"], proof: "steps", surfaces: ["on-bg", "on-alt"], density: "dense", main: "headline",
    what: "A numbered list of up to four steps in full-width rows.",
    map: (s) => ({ slots: { headline: headline(s), ...spread("step-", list(s.proof.items, "steps", 4), 4) } }) },
  { id: "steps_cards", layout: "news-cards", family: "artifact", roles: ["context", "how"], fields: ["kicker", "claim"], proof: "steps", surfaces: ["on-alt", "on-bg"], density: "dense", main: "headline",
    what: "The steps as four numbered cards, the first one featured.",
    map: (s) => { const items = list(s.proof.items, "steps", 4); return { slots: { ...spread("t", items, 4, (_, i) => String(i + 1).padStart(2, "0")), ...spread("n", items, 4), kicker: s.kicker ?? null, headline: headline(s) } }; } },
  { id: "comparison", layout: "comparison", family: "structure", roles: ["compare", "point", "proof"], fields: ["claim"], proof: "comparison", surfaces: ["on-bg", "on-alt"], density: "dense", main: "headline",
    what: "Two columns, three short points each; the second one boxed in the accent.",
    map: (s) => {
      const b = need(s.proof.before, "proof.before"), a = need(s.proof.after, "proof.after");
      return { slots: { headline: headline(s), "before-label": need(b.label, "before.label"), ...spread("before-", list(b.items, "points per column", 3), 3), "now-label": need(a.label, "after.label"), ...spread("now-", list(a.items, "points per column", 3), 3) } };
    } },
  { id: "data_bars", layout: "data-bars", family: "structure", roles: ["proof", "compare", "point"], fields: ["claim"], proof: "bars", surfaces: ["on-bg", "on-alt"], density: "dense", main: "headline", data: true,
    what: "A horizontal bar chart of up to four real quantities, one highlighted, with its source.",
    map: (s) => {
      const rows = list(s.proof.rows, "bars", 4);
      const top = Math.max(...rows.map((r) => Number(r.percent ?? r.amount ?? 0)), 0);
      if (!top) unfit("each bar needs a `percent` (0–100) or an `amount` to scale");
      const hi = rows.findIndex((r) => r.highlight);
      return {
        slots: { headline: headline(s), ...spread("l", rows, 4, (r) => r.label), ...spread("v", rows, 4, (r) => r.value), source: need(s.proof.source, "proof.source (where the figures come from)") },
        bars: rows.map((r) => (r.percent !== undefined ? Number(r.percent) : Math.round((Number(r.amount) / top) * 100))),
        highlight: hi >= 0 ? hi + 1 : rows.indexOf([...rows].sort((x, y) => Number(y.percent ?? y.amount) - Number(x.percent ?? x.amount))[0]) + 1,
      };
    } },

  { id: "chat", layout: "chat", family: "artifact", roles: ["proof", "how", "point", "offer"], fields: ["claim"], proof: "chat", surfaces: ["on-primary", "on-secondary"], density: "dense", main: "headline",
    what: "A conversation in up to four bubbles that ends in a confirmation chip.",
    map: (s) => {
      const m = list(s.proof.messages, "messages", 4);
      m.forEach((x, i) => { if ((x.from === "brand" ? "out" : x.from === "customer" ? "in" : x.from) !== (i % 2 ? "out" : "in")) unfit("messages must alternate, starting with the customer (from: in, out, in, out)"); });
      return { slots: { headline: headline(s), "in-1": m[0]?.text ?? null, "out-1": m[1]?.text ?? null, "in-2": m[2]?.text ?? null, "out-2": m[3]?.text ?? null, status: s.proof.status ?? null } };
    } },
  { id: "app_window", layout: "app-window", family: "artifact", roles: ["proof", "how", "point", "context", "hook"], fields: ["claim"], proof: "window", surfaces: ["on-alt", "on-bg"], density: "dense", main: "headline",
    what: "A headline and a drawn software window with up to five rows and their status.",
    map: (s) => { const rows = list(s.proof.rows, "rows", 5); return { slots: { headline: headline(s), "win-title": need(s.proof.title, "proof.title"), ...spread("r", rows, 5, (r) => r.name), ...spread("s", rows, 5, (r) => r.status ?? "") } }; } },
  { id: "news_cards", layout: "news-cards", family: "artifact", roles: ["hook", "context", "point"], fields: ["kicker", "claim"], proof: "cards", surfaces: ["on-alt", "on-bg"], density: "dense", main: "headline",
    what: "Up to four cards with a tag and a line each, the first one featured, and the title below.",
    map: (s) => { const items = list(s.proof.items, "cards", 4); return { slots: { ...spread("t", items, 4, (c) => c.tag), ...spread("n", items, 4, (c) => c.text), kicker: s.kicker ?? null, headline: headline(s) } }; } },
  { id: "logo_grid", layout: "logo-grid", family: "artifact", roles: ["proof", "context"], fields: ["kicker", "claim"], proof: "logos", surfaces: ["on-bg", "on-alt"], density: "dense", main: "headline",
    what: "A headline and a grid of up to six customer or partner names (with their permission).",
    map: (s) => ({ slots: { kicker: s.kicker ?? null, headline: headline(s), ...spread("l", list(s.proof.names, "names", 6), 6) } }) },

  { id: "testimonial", layout: "testimonial", family: "voice", roles: ["proof", "point"], fields: ["claim"], proof: "quote", surfaces: ["on-primary", "on-secondary"], density: "balanced", main: "quote", ownTitle: true,
    what: "A real quote, verbatim, with the name and role of the person who said it.",
    map: (s) => ({ slots: { quote: need(s.proof.text, "proof.text"), name: need(s.proof.name, "proof.name (who said it)"), role: s.proof.role ?? null } }) },
  { id: "quote_statement", layout: "statement", family: "voice", roles: ["proof", "point"], fields: ["kicker", "claim"], proof: "quote", surfaces: ["on-primary", "on-secondary", "on-bg", "on-alt"], density: "airy", main: "headline", ownTitle: true,
    what: "A short quote set as a statement, signed underneath.",
    map: (s) => ({ slots: { kicker: s.kicker ?? null, headline: `“${String(need(s.proof.text, "proof.text")).replace(/^[“"«]|[”"»]$/g, "")}”`, support: [need(s.proof.name, "proof.name (who said it)"), s.proof.role].filter(Boolean).join(" · ") } }) },
];

export const PROOF_KINDS = [...new Set(RECIPES.map((r) => r.proof).filter(Boolean))];
const FIELDS = ["kicker", "labels", "claim", "support", "cta", "image"];
const present = (s, f) => (f === "labels" ? Array.isArray(s.labels) && s.labels.length > 0 : s[f] !== undefined && s[f] !== null && s[f] !== "");
const MODE_FAMILY = { type: ["type"], photo: ["photo"], data: ["structure"], artifact: ["artifact"] };
const DEFAULT_BUDGET = { label: 30, "t-body": 70, "t-intro": 95, "t-cue": 60 };

/** Why a photo cannot carry a slide, or null when it can. */
export function photoBlocker(asset, id, format, fullBleed) {
  if (!asset) return `asset "${id}" is not registered (stock_import or asset_add first)`;
  if (asset.vetoed) return `asset "${id}" was vetoed by the user`;
  if (!asset.analysis?.complete) return `asset "${id}" has no finished analysis, so no crop of it is known to be safe (asset_analyze with its focal point and protected regions)`;
  if (!asset.analysis.focalPoint) return `asset "${id}" has no focal point (asset_analyze)`;
  const cov = asset.quality?.coverage?.[format];
  if (asset.quality?.vector || !cov) return null;
  if (cov === "2K" || cov === "1080") return null;
  const pct = Number(String(cov).replace("%", ""));
  if (fullBleed) return `asset "${id}" is too small to cover a ${format} canvas (${cov} of the size needed)`;
  return pct < 70 ? `asset "${id}" is too small even for a partial block (${cov})` : null;
}

function evaluate(recipe, slide, ctx) {
  const { budgets, assets, format, direction } = ctx;
  if ((recipe.proof ?? null) !== (slide.proof?.kind ?? null)) return { why: slide.proof ? `shows ${recipe.proof ?? "no"} proof, not "${slide.proof.kind}"` : `needs a ${recipe.proof} proof` };
  const avoid = (direction.avoid ?? []).map((x) => String(x).toLowerCase());
  if ([recipe.id, recipe.layout, recipe.family].some((x) => avoid.includes(x))) return { why: "ruled out by direction.avoid" };
  const extra = FIELDS.filter((f) => f !== "image" && present(slide, f) && !recipe.fields.includes(f));
  if (extra.length) return { why: `cannot show ${extra.join(" and ")}` };
  if (!recipe.ownTitle && !present(slide, "claim")) return { why: "needs a claim" };
  let photoNote = null;
  if (recipe.needsImage) {
    if (!slide.image?.asset) return { why: "needs a photo (image.asset)" };
    const blocker = photoBlocker(assets.find((a) => a.id === slide.image.asset), slide.image.asset, format, FULL_BLEED.has(recipe.id));
    if (blocker) return { why: blocker, photo: true };
  } else if (slide.image?.asset) photoNote = "the photo is not used";
  let spec;
  try { spec = recipe.map(slide); } catch (e) { if (e instanceof Unfit) return { why: e.message }; throw e; }
  const slots = budgets[recipe.layout] ?? {};
  let fill = null;
  for (const [id, text] of Object.entries(spec.slots)) {
    if (text === null) continue;
    const slot = slots[id];
    if (!slot) return { why: `layout ${recipe.layout} has no slot "${id}"` };
    const max = slot.max ?? DEFAULT_BUDGET[slot.role] ?? 60;
    if (len(text) > max * 1.1) return { why: `${id} is ${len(text)} characters and this layout holds ~${max}` };
    if (id === recipe.main) fill = len(text) / max;
  }
  return { spec, fill, photoNote };
}

function score(recipe, surface, slide, ev, ctx, prev) {
  const { direction, taste, used } = ctx;
  const parts = [];
  const add = (points, text) => { if (points) parts.push({ points, text }); };
  const role = slide.role ?? "point";
  const ri = recipe.roles.indexOf(role);
  add(ri === 0 ? 16 : ri > 0 ? 9 : -6, ri >= 0 ? `drawn for a ${role} slide` : `not drawn for a ${role} slide`);
  if (ev.fill !== null) {
    const f = ev.fill, pts = f < 0.25 ? -8 : f < 0.45 ? 2 : f <= 0.9 ? 12 : f <= 1 ? 5 : -4;
    add(pts, f < 0.25 ? "the copy is lost in a layout this roomy" : f <= 0.9 ? "the copy fills the layout as drawn" : "the copy is at the edge of what the layout holds");
  }
  const mode = direction.dominantMode;
  if (mode && mode !== "mixed" && !slide.proof) add(MODE_FAMILY[mode]?.includes(recipe.family) ? 14 : -4, MODE_FAMILY[mode]?.includes(recipe.family) ? `follows the ${mode}-led direction` : `off the ${mode}-led direction`);
  if (recipe.needsImage) add(12, "uses the photo, which has a safe crop");
  else if (slide.image?.asset) add(ctx.photoUsable[slide.image.asset] ? -14 : 0, "leaves a usable photo out");
  if (direction.density) add(recipe.density === direction.density ? 6 : 0, `${recipe.density} like the direction asks`);
  const tone = recipe.tone ?? toneOf(surface);
  const v = direction.variance === "calm" ? 0.5 : direction.variance === "varied" ? 1.5 : 1;
  if (prev.length) {
    const last = prev[prev.length - 1], before = prev[prev.length - 2];
    add(last.layout === recipe.layout ? -30 : 0, "repeats the layout of the slide before");
    add(surface && last.surface === surface ? -5 * v : 0, "same surface as the slide before");
    add(before && last.family === recipe.family && before.family === recipe.family ? -10 * v : 0, "third slide of the same family in a row");
    // The run this choice would create: slides already placed with this tone, plus the next ones that can only be this tone.
    let run = 1;
    for (let i = prev.length - 1; i >= 0 && prev[i].tone === tone; i--) run++;
    for (const forced of ctx.ahead) { if (forced !== tone) break; run++; }
    add(run >= 3 ? -14 * v : 0, `would make ${run} ${tone} slides in a row`);
    add(last.tone !== tone ? 4 * v : 0, `turns ${tone} after a ${last.tone} slide`);
    if (recipe.peak) add(last.tone !== tone ? 4 : 0, "a peak that contrasts with what comes before");
  }
  if (recipe.peak) add(used.has(recipe.id) || [...used].some((id) => RECIPES.find((r) => r.id === id)?.peak && RECIPES.find((r) => r.id === id).layout === recipe.layout) ? -9 : 0, "this hero gesture was already used in the piece");
  if (recipe.surfaces) add(surface === recipe.surfaces[0] ? 3 : 0, "the layout's own surface");
  const t = taste?.recipes?.[recipe.id];
  if (t) add(t > 0 ? Math.min(10, 5 * t) : Math.max(-16, 8 * t), t > 0 ? "the user liked this structure before" : "the user rejected this structure before");
  if (ctx.accentOk && surface && ctx.accentOk[surface] === false && Object.values(ev.spec.slots).some((t) => /\*[^*]+\*/.test(String(t ?? "")))) add(-40, "the accent word would not be readable on this surface");
  // "Another version" means another structure first; the same recipe on another surface only when nothing else fits.
  const triedHere = ctx.tried ?? [];
  if (triedHere.includes(`${recipe.id}@${surface ?? ""}`)) add(-45, "already shown for this slide");
  else if (triedHere.some((k) => k.split("@")[0] === recipe.id)) add(-22, "this structure was already shown for this slide");
  const total = 50 + parts.reduce((a, p) => a + p.points, 0);
  const why = parts.filter((p) => p.points > 0).sort((a, b) => b.points - a.points).slice(0, 3).map((p) => p.text);
  return { total: Math.round(total * 10) / 10, why };
}

/**
 * @param {object} intent   { direction, slides: [slide intent…] }
 * @param {object} context  { budgets: {layout: {slotId: {max, role}}}, assets: [], format, taste: {recipes: {id: n}}, tried: [[keys] per slide] }
 */
export function resolvePiece(intent, { budgets, assets = [], format = "4:5", taste = null, tried = [], accentOk = null } = {}) {
  const direction = intent.direction ?? {};
  const photoUsable = Object.fromEntries(assets.map((a) => [a.id, !photoBlocker(a, a.id, format, true)]));
  const used = new Set(), prev = [], slides = [], unresolved = [];
  // Look ahead: a slide whose eligible recipes all share one tone is fixed, and its neighbors plan around it.
  const base = { budgets, assets, format, direction, taste, used, photoUsable, accentOk };
  const forced = (intent.slides ?? []).map((slide) => {
    const tones = new Set();
    for (const recipe of RECIPES) if (evaluate(recipe, slide, base).spec) for (const surface of recipe.surfaces ?? [null]) tones.add(recipe.tone ?? toneOf(surface));
    return tones.size === 1 ? [...tones][0] : null;
  });
  for (const [i, slide] of (intent.slides ?? []).entries()) {
    const ctx = { ...base, tried: tried[i] ?? [], ahead: forced.slice(i + 1) };
    const candidates = [], rejected = [];
    for (const recipe of RECIPES) {
      const ev = evaluate(recipe, slide, ctx);
      if (!ev.spec) { rejected.push({ recipe: recipe.id, why: ev.why, photo: !!ev.photo }); continue; }
      for (const surface of recipe.surfaces ?? [null]) {
        const s = score(recipe, surface, slide, ev, ctx, prev);
        candidates.push({ recipe, surface, ev, score: s.total, why: s.why });
      }
    }
    if (!candidates.length) {
      const relevant = rejected.filter((r) => !/proof, not|needs a .* proof/.test(r.why));
      unresolved.push({ n: i + 1, role: slide.role ?? null, reasons: (relevant.length ? relevant : rejected).slice(0, 8) });
      prev.push({ layout: null, family: null, tone: null });
      continue;
    }
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const tone = best.recipe.tone ?? toneOf(best.surface);
    used.add(best.recipe.id);
    prev.push({ layout: best.recipe.layout, family: best.recipe.family, tone, surface: best.surface });
    const notes = [];
    const photoIssue = rejected.find((r) => r.photo);
    if (slide.image?.asset && !best.recipe.needsImage) notes.push(photoIssue ? `photo not used: ${photoIssue.why}` : "photo not used: no photo recipe can show this content");
    let spec = best.ev.spec;
    if (accentOk && best.surface && accentOk[best.surface] === false && Object.values(spec.slots).some((t) => /\*[^*]+\*/.test(String(t ?? "")))) {
      spec = { ...spec, slots: Object.fromEntries(Object.entries(spec.slots).map(([k, t]) => [k, typeof t === "string" ? t.replace(/\*/g, "") : t])) };
      notes.push("emphasis dropped: the accent color is not readable on this surface");
    }
    const seen = new Set([best.recipe.id]);
    const alternatives = [];
    for (const c of candidates.slice(1)) { if (seen.has(c.recipe.id)) continue; seen.add(c.recipe.id); alternatives.push({ recipe: c.recipe.id, family: c.recipe.family, surface: c.surface, score: c.score }); }
    slides.push({
      n: i + 1, recipe: best.recipe.id, layout: best.recipe.layout, family: best.recipe.family, surface: best.surface, tone, score: best.score,
      reason: best.why.join("; ") || "the only recipe that shows exactly this content",
      key: `${best.recipe.id}@${best.surface ?? ""}`,
      options: candidates.length, alternatives, notes,
      spec: { layout: best.recipe.layout, ...spec, ...(slide.alt ? { alt: slide.alt } : {}), role: slide.role, claim: String(slide.claim ?? "").replace(/\*/g, "") },
    });
  }
  const pattern = direction.pattern ?? (direction.continuityDevice === "pattern" ? "grid" : null);
  return { slides, unresolved, pattern };
}

/** What the agent needs to write an intent: every recipe, what it shows and what it needs. */
export function describeRecipes(budgets = {}) {
  return RECIPES.map((r) => ({
    recipe: r.id, layout: r.layout, family: r.family, what: r.what, roles: r.roles, proof: r.proof,
    shows: r.fields.filter((f) => f !== "image"), photo: !!r.needsImage, surfaces: r.surfaces ?? "fixed (photo)",
    budget: Object.fromEntries(Object.entries(budgets[r.layout] ?? {}).filter(([, v]) => v.max).map(([k, v]) => [k, v.max])),
  }));
}

/** The shape of each proof kind, for the tool description and the errors. */
export const PROOF_SHAPES = {
  number: '{ kind: "number", value: "38", unit: "%" }',
  steps: '{ kind: "steps", items: ["…", "…"] }  (up to 4)',
  comparison: '{ kind: "comparison", before: { label, items: [≤3] }, after: { label, items: [≤3] } }',
  bars: '{ kind: "bars", rows: [{ label, value: "3 h", percent: 66, highlight?: true }] (≤4), source: "…" }',
  quote: '{ kind: "quote", text, name, role }  (real and verbatim)',
  chat: '{ kind: "chat", messages: [{ from: "in"|"out", text }] (≤4, alternating, customer first), status: "Booked" }',
  window: '{ kind: "window", title, rows: [{ name, status }] (≤5) }',
  cards: '{ kind: "cards", items: [{ tag, text }] (≤4) }',
  logos: '{ kind: "logos", names: [≤6] }',
  definition: '{ kind: "definition", term, phonetic?, origin?, meaning }',
  prompt: '{ kind: "prompt", text }  (needs image)',
  event: '{ kind: "event", name, facts: [≤6 short facts: day, date, time, place…] }  (needs image)',
  cobrand: '{ kind: "cobrand", a, b }  (needs image)',
};
