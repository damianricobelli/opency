// The compositor: deterministic recipe choice, eligibility, rhythm, photos, taste and variants.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePiece, RECIPES, PROOF_KINDS, PROOF_SHAPES, photoBlocker } from "../lib/recipes.mjs";
import { describeSlide, fillSlide } from "../lib/compose.mjs";
import { accentLegibility, prepareSlide } from "../lib/piece.mjs";
import { profile } from "../lib/taste.mjs";
import { rankStock, textRoom } from "../lib/photo.mjs";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const lib = JSON.parse(await readFile(path.join(PKG, "templates/layouts/piece.json"), "utf8"));
const html = {}, budgets = {};
for (const s of lib.slides) {
  html[s.layout] = await readFile(path.join(PKG, "templates/layouts", `slide-${String(s.n).padStart(2, "0")}.html`), "utf8");
  budgets[s.layout] = Object.fromEntries(describeSlide(html[s.layout]).slots.map((x) => [x.id, { max: x.max, role: x.role }]));
}
const photo = (over = {}) => ({ id: "p1", file: "photos/p1.jpg", vetoed: false, quality: { coverage: { "4:5": "2K", "1:1": "2K", "9:16": "1080", "16:9": "1080" } }, analysis: { complete: true, focalPoint: { x: 0.5, y: 0.4 }, protectedRegions: [] }, ...over });
const ctx = (over = {}) => ({ budgets, format: "4:5", ...over });

const story = {
  direction: { dominantMode: "type", variance: "varied" },
  slides: [
    { role: "hook", labels: ["The rule", "No. 12"], claim: "Say one thing well.", support: "A piece that says two things is remembered for neither." },
    { role: "context", claim: "Readers give you two seconds, not twenty.", support: "The first line decides the rest." },
    { role: "how", claim: "How we cut a draft", proof: { kind: "steps", items: ["Write it all.", "Circle one line.", "Delete the rest."] } },
    { role: "proof", claim: "of saved posts carry one idea", proof: { kind: "number", value: "4", unit: "/5" } },
    { role: "close", claim: "One idea per piece.", cta: "Save this for your next draft" },
  ],
};

test("every recipe points at a real layout and only writes slots that exist", () => {
  for (const r of RECIPES) assert.ok(budgets[r.layout], `${r.id} → ${r.layout}`);
  assert.deepEqual([...PROOF_KINDS].sort(), Object.keys(PROOF_SHAPES).sort());
});

test("a story resolves to one recipe per slide, with a reason, and the same way every time", () => {
  const a = resolvePiece(story, ctx()), b = resolvePiece(story, ctx());
  assert.deepEqual(a, b);
  assert.equal(a.unresolved.length, 0);
  assert.deepEqual(a.slides.map((s) => s.recipe), ["type_poster", "type_statement", "steps", "type_number", "type_closer"]);
  for (const s of a.slides) assert.ok(s.reason.length > 10, `slide ${s.n} has a reason`);
});

test("the chosen specs fill their layouts with no sample copy left and nothing over budget", () => {
  const plan = resolvePiece(story, ctx());
  for (const s of plan.slides) {
    const sample = Object.fromEntries(describeSlide(html[s.layout]).slots.map((x) => [x.id, x.text]));
    const r = fillSlide(html[s.layout], s.spec, { n: s.n, sample });
    assert.deepEqual(r.issues, [], `slide ${s.n} (${s.recipe}): ${JSON.stringify(r.issues)}`);
  }
});

test("rhythm: no layout twice in a row and never three slides of one tone in a row", () => {
  const many = { direction: { dominantMode: "type" }, slides: Array.from({ length: 7 }, (_, i) => ({ role: "point", claim: `Point number ${i + 1} is short.`, support: "One line of support." })) };
  const plan = resolvePiece(many, ctx());
  plan.slides.forEach((s, i) => {
    if (i) assert.notEqual(s.layout, plan.slides[i - 1].layout, `slides ${i} and ${i + 1}`);
    if (i > 1) assert.ok(!(s.tone === plan.slides[i - 1].tone && s.tone === plan.slides[i - 2].tone), `three ${s.tone} slides at ${i + 1}`);
  });
});

test("copy that fits no recipe is reported, not squeezed", () => {
  const plan = resolvePiece({ slides: [{ role: "point", claim: "x".repeat(90) }] }, ctx());
  assert.equal(plan.slides.length, 0);
  assert.match(plan.unresolved[0].reasons.map((r) => r.why).join(" "), /characters and this layout holds/);
});

test("a content field no recipe can show makes the slide unresolved", () => {
  const plan = resolvePiece({ slides: [{ role: "how", claim: "Steps", support: "extra line", proof: { kind: "steps", items: ["a", "b"] } }] }, ctx());
  assert.match(plan.unresolved[0].reasons[0].why, /cannot show support/);
});

test("a photo is used only when its crop is known to be safe", () => {
  const slide = { role: "hook", kicker: "Story", claim: "Out before the sun is up", image: { asset: "p1" } };
  const safe = resolvePiece({ direction: { dominantMode: "photo" }, slides: [slide] }, ctx({ assets: [photo()] }));
  assert.equal(safe.slides[0].family, "photo");
  const unknown = resolvePiece({ direction: { dominantMode: "photo" }, slides: [slide] }, ctx({ assets: [photo({ analysis: { complete: false, focalPoint: null } })] }));
  assert.equal(unknown.slides[0].family, "type");
  assert.match(unknown.slides[0].notes[0], /no finished analysis/);
  assert.match(photoBlocker(photo({ vetoed: true }), "p1", "4:5", true), /vetoed/);
  assert.match(photoBlocker(photo({ quality: { coverage: { "4:5": "62%" } } }), "p1", "4:5", true), /too small/);
});

test("type goes where the subject is not", () => {
  const slide = { role: "hook", claim: "Out before the sun is up", image: { asset: "p1" } };
  const at = (y) => resolvePiece({ direction: { dominantMode: "photo" }, slides: [slide] }, ctx({ assets: [photo({ analysis: { complete: true, focalPoint: { x: 0.5, y }, protectedRegions: [] } })] })).slides[0].recipe;
  assert.equal(at(0.75), "photo_cover", "subject low: text on top");
  assert.notEqual(at(0.2), "photo_cover", "subject high: text at the bottom");
});

test("stock ranking: covers the format, right shape, no clichés, room for type", () => {
  const base = { provider: "openverse", alt: "a mountain road at dawn" };
  const ranked = rankStock([
    { ref: "small", w: 600, h: 750, ...base },
    { ref: "wide", w: 4000, h: 1800, ...base },
    { ref: "cliche", w: 2400, h: 3000, provider: "openverse", alt: "business people handshake in office" },
    { ref: "good", w: 2400, h: 3000, ...base, room: { zone: "top", calm: 0.8, zones: {} } },
    { ref: "busy", w: 2400, h: 3000, ...base, room: { zone: null, calm: 0.1, zones: {} } },
  ], { format: "4:5" });
  assert.deepEqual(ranked.map((r) => r.ref), ["good", "busy", "cliche", "wide", "small"]);
  assert.ok(ranked.at(-1).unusable);
  assert.match(ranked[2].fit.join(" "), /generic stock/);
});

test("text room: a flat half is calm, noise is not", async () => {
  const sharp = (await import("sharp")).default;
  const w = 200, h = 250, px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = y < h / 2 ? 40 : ((Math.floor(x / 10) * 7 + Math.floor(y / 10) * 13) % 3) * 127; px.fill(v, (y * w + x) * 3, (y * w + x) * 3 + 3); }
  const room = await textRoom(await sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer());
  assert.equal(room.zone, "top");
  assert.ok(room.zones.top > 0.9 && room.zones.bottom < 0.3, JSON.stringify(room.zones));
});

test("proof kinds reach their recipes: bars scale and highlight, chat must alternate", () => {
  const bars = resolvePiece({ slides: [{ role: "proof", claim: "Where the time goes", proof: { kind: "bars", source: "Internal log", rows: [{ label: "Idea", value: "1 h", amount: 1 }, { label: "Design", value: "3 h", amount: 3 }] } }] }, ctx());
  assert.deepEqual(bars.slides[0].spec.bars, [33, 100]);
  assert.equal(bars.slides[0].spec.highlight, 2);
  const filled = fillSlide(html["data-bars"], bars.slides[0].spec, { n: 1 });
  assert.equal((filled.html.match(/class="row/g) ?? []).length, 2, "empty rows are removed");
  const chat = resolvePiece({ slides: [{ role: "proof", claim: "It happens in the chat", proof: { kind: "chat", messages: [{ from: "out", text: "Hi" }] } }] }, ctx());
  assert.match(chat.unresolved[0].reasons.map((r) => r.why).join(" "), /alternate/);
});

test("direction.avoid rules a recipe out; taste moves the choice", () => {
  const slide = { role: "hook", claim: "Say one thing well.", support: "Short support line." };
  const base = resolvePiece({ slides: [slide] }, ctx()).slides[0].recipe;
  const avoided = resolvePiece({ direction: { avoid: [base] }, slides: [slide] }, ctx()).slides[0].recipe;
  assert.notEqual(avoided, base);
  const taste = profile({ inspirations: [], feedback: [{ verdict: "rejected", recipes: [base] }, { verdict: "rejected", recipes: [base] }, { verdict: "liked", recipes: [avoided] }, { verdict: "changes", recipes: [avoided] }] });
  assert.deepEqual(taste.recipes, { [base]: -2, [avoided]: 1 });
  assert.equal(resolvePiece({ slides: [slide] }, ctx({ taste })).slides[0].recipe, avoided);
});

test("another version: what was shown is pushed down, and a different structure comes first", () => {
  const first = resolvePiece(story, ctx());
  const second = resolvePiece(story, ctx({ tried: first.slides.map((s) => [s.key]) }));
  assert.ok(second.slides.every((s, i) => s.key !== first.slides[i].key), "every slide changes");
  assert.equal(second.slides[2].recipe, "steps_cards");
  assert.equal(second.slides[3].recipe, "number_poster");
});

test("an accent word is kept off surfaces where the accent cannot be read", () => {
  const ok = accentLegibility(":root{--accent:#FF5A1F;--bg:#F3EFE6;--bg-alt:#E6E0D3;--primary:#121212;--secondary:#2F3B35;}");
  assert.equal(ok["on-bg"], false);
  assert.equal(ok["on-primary"], true);
  const plan = resolvePiece({ slides: [{ role: "point", claim: "Readers give you two seconds.", emphasis: "two seconds" }] }, ctx({ accentOk: ok }));
  assert.equal(plan.slides[0].tone, "dark");
  assert.match(plan.slides[0].spec.slots.headline, /\*two seconds\*/);
});

test("prepareSlide applies the recipe's surface and the piece's pattern", () => {
  const brand = { loaded: true, name: "Test", handle: "@test", raw: { logos: {}, defaults: { texture: "fine" } } };
  const out = prepareSlide(html.statement, { brand, id: "2026-01-01-x", n: 2, total: 5, format: "1:1", layout: "statement", language: "es", surface: "on-alt", pattern: "dots" });
  assert.match(out, /<main class="canvas on-alt" data-pattern="dots" data-texture="fine"/);
  assert.match(out, /data-format="1:1"/);
  assert.match(out, />02\/05</);
  assert.match(out, /@test/);
});
