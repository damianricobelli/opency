// Composing with data instead of HTML.
//
// A layout is an HTML slide whose editable texts are elements with an `id` and no tags inside
// (a `<span class="hl">` highlight is allowed). Those are its SLOTS. Composing a slide means choosing
// a layout and giving each slot its text; the HTML, the brand paths, the logo and the pager are the
// engine's job. The agent only falls back to writing HTML when no layout fits.
//
//   describeSlide(html)                 → the slots (and photo) a slide exposes
//   fillSlide(html, spec, context)      → the slide with the texts in place, plus what went wrong
//
// Slot text is plain text. `*word*` marks the one word to highlight in the accent color.

import { parse } from "node-html-parser";

/** Chrome and decoration: ids the engine owns, never slots. */
const OWNED = new Set(["brand", "pager", "logo", "mark", "arrow"]);
/** Over this share of a slot's budget the text does not fit: change the layout, do not shrink the type. */
export const BUDGET_TOLERANCE = 1.2;

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toMarkup = (text) => escapeHtml(text).replace(/\*([^*\n]+)\*/g, '<span class="hl">$1</span>');
const plain = (el) => el.text.replace(/\s+/g, " ").trim();
const plainLength = (text) => String(text).replace(/\*/g, "").trim().length;

function isSlot(el) {
  const id = el.getAttribute("id");
  if (!id || OWNED.has(id)) return false;
  if (el.closest("[data-chrome]")) return false;
  const children = el.childNodes.filter((n) => n.nodeType === 1);
  if (children.some((c) => !(c.tagName === "SPAN" && c.classList.contains("hl")))) return false;
  return plain(el).length > 0;
}

const slotsOf = (root) => root.querySelectorAll("[id]").filter(isSlot);

/** What a slide can take: its text slots, whether it has a photo, and its surface. */
export function describeSlide(html) {
  const root = parse(html);
  const canvas = root.querySelector("main.canvas");
  const photo = root.querySelector("img[data-asset]");
  const role = (el) => [...el.classList.values()].find((c) => c.startsWith("t-") || c === "label") ?? null;
  return {
    surface: canvas?.classNames.match(/\b(on-[a-z-]+|photo-slide)\b/)?.[1] ?? null,
    slots: slotsOf(root).map((el) => ({
      id: el.getAttribute("id"),
      text: plain(el),
      max: el.getAttribute("data-max") ? Number(el.getAttribute("data-max")) : null,
      role: role(el),
    })),
    photo: photo ? { asset: photo.getAttribute("data-asset") } : null,
    bars: root.querySelectorAll(".bar i").length || null,
  };
}

/** The element that goes away with a slot: its list item, row or card when the slot is its only text. */
function removable(el) {
  const parent = el.parentNode;
  if (!parent?.tagName) return el;
  const groups = ["LI"];
  const rowLike = parent.classList && ["row", "item", "card", "tile", "meta"].some((c) => parent.classList.contains(c));
  if (groups.includes(parent.tagName) || rowLike) {
    const target = parent.classList?.contains("meta") && parent.parentNode?.classList?.contains("row") ? parent.parentNode : parent;
    const others = target.querySelectorAll("[id]").filter((x) => x !== el && isSlot(x));
    // A row that holds a label and its value goes together; a row with unrelated slots stays.
    if (others.length <= 1) return target;
  }
  return el;
}

/**
 * @param {string} html      the slide (already copied into the piece by new-piece)
 * @param {object} spec      { slots: {id: text|null}, remove: [ids], image: {asset}, bars: [percent…] }
 * @param {object} context   { n, sample: {id: sampleText} (the layout's sample copy), assets: [] (assets.json),
 *                             written: [ids] slots already given their copy in an earlier call }
 * @returns {{ html: string, filled: string[], left: string[], issues: object[] }}
 */
export function fillSlide(html, spec = {}, { n = 0, sample = {}, assets = [], written = [] } = {}) {
  const root = parse(html, { comment: true });
  const issues = [];
  const issue = (code, severity, where, msg) => issues.push({ code, severity, slide: n, where, msg });
  const byId = new Map(slotsOf(root).map((el) => [el.getAttribute("id"), el]));
  const filled = [];

  const removals = new Set(spec.remove ?? []);
  for (const [id, value] of Object.entries(spec.slots ?? {})) {
    const el = byId.get(id);
    if (!el) { issue("unknown_slot", "error", `#${id}`, `this slide has no slot "${id}". Slots: ${[...byId.keys()].join(", ")}`); continue; }
    if (value === null || value === "") { removals.add(id); continue; }
    const text = String(value).trim();
    const max = Number(el.getAttribute("data-max")) || null;
    const length = plainLength(text);
    if (max && length > max * BUDGET_TOLERANCE) issue("over_budget", "warning", `#${id}`, `${length} characters; this slot is designed for ~${max}. Shorten the text or use another layout (do not shrink the type)`);
    if ((text.match(/\*[^*\n]+\*/g) ?? []).length > 1) issue("too_many_highlights", "warning", `#${id}`, "only one word or phrase per slide takes the accent");
    el.set_content(toMarkup(text));
    filled.push(id);
  }

  for (const id of removals) {
    const el = byId.get(id);
    if (!el) { issue("unknown_slot", "error", `#${id}`, `cannot remove "${id}": this slide has no such slot`); continue; }
    removable(el).remove();
    byId.delete(id);
  }

  if (spec.image) {
    const img = root.querySelector("img[data-asset]");
    const asset = assets.find((a) => a.id === spec.image.asset);
    if (!img) issue("no_photo_slot", "error", "img", "this layout has no photo: use cover-photo, photo-card or cobrand");
    else if (!asset) issue("unknown_asset", "error", "img", `asset "${spec.image.asset}" is not registered. Use stock_import or asset_add first`);
    else {
      if (asset.vetoed) issue("vetoed_asset", "error", "img", `asset "${asset.id}" was vetoed by the user`);
      if (!asset.analysis?.complete) issue("asset_not_analyzed", "warning", "img", `asset "${asset.id}" has no analysis yet: run asset_analyze so crops cannot cut a face`);
      img.setAttribute("data-asset", asset.id);
      img.setAttribute("src", `../../assets/${asset.file}`);
      const f = asset.analysis?.focalPoint;
      if (f) img.setAttribute("style", `--fx:${Math.round(f.x * 100)}%;--fy:${Math.round(f.y * 100)}%`);
    }
  }

  if (spec.bars) {
    const bars = root.querySelectorAll(".bar i");
    if (!bars.length) issue("no_bars", "error", ".bar", "this layout has no bars: use data-bars");
    spec.bars.forEach((v, i) => { if (bars[i]) bars[i].setAttribute("style", `--v:${Math.max(0, Math.min(100, Number(v)))}%`); });
  }

  // Sample copy left in place is the layout talking, not the brand.
  const left = [...byId.entries()].filter(([id, el]) => !filled.includes(id) && !written.includes(id) && sample[id] !== undefined && plain(el) === sample[id]).map(([id]) => id);
  if (left.length) issue("sample_copy_left", "error", left.map((id) => `#${id}`).join(" "), `still showing the layout's sample text. Give these slots their copy, or remove them with null`);

  return { html: root.toString(), filled, left, issues };
}
