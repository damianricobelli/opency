// Identity: presets, the proposal from a website and the contrast repair.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRESETS, repair, proposeFromImport, applyColors, readColors, contrast, ROLES } from "../lib/identity.mjs";
import { briefIn, optionIndex, suggestionsFor } from "../lib/brief.mjs";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tokens = await readFile(path.join(PKG, "brands/_demo/tokens.css"), "utf8");

test("every preset passes its base text combinations after repair", () => {
  for (const p of PRESETS) {
    const { colors: c, derived } = repair(p.colors);
    for (const [fg, bg] of [["ink", "bg"], ["ink", "bg-alt"], ["ink-inverse", "primary"], ["ink-inverse", "secondary"]]) assert.ok(contrast(c[fg], c[bg]) >= 4.5, `${p.id}: ${fg} on ${bg}`);
    const onDark = derived["accent-inverse"] ?? c.accent;
    assert.ok(contrast(onDark, c.primary) >= 3 && contrast(onDark, c.secondary) >= 3, `${p.id}: accent on the dark surfaces`);
  }
});

test("repair fixes what fails, fills what is missing and says what it changed", () => {
  const r = repair({ bg: "#FFFFFF", ink: "#9AA0A6", primary: "#102A43", accent: "#102A43" });
  assert.ok(contrast(r.colors.ink, r.colors.bg) >= 7);
  assert.ok(r.notes.some((n) => n.startsWith("ink:")));
  for (const role of ROLES) assert.match(r.colors[role], /^#[0-9A-F]{6}$/, role);
  assert.ok(r.derived["accent-inverse"], "an accent equal to the primary gets an inverse");
  assert.deepEqual(repair(r.colors).notes.filter((n) => !n.startsWith("accent-inverse")), [], "repairing twice changes nothing");
});

test("a website's report becomes a proposal: its own background and text, a vivid accent, a quiet dark surface", () => {
  const light = proposeFromImport({ page: { background: "#ffffff", text: "#111827" }, button: { background: "#6d28d9", radius: "12px" }, backgrounds: [{ color: "#ffffff" }, { color: "#0b1020" }], inks: [{ color: "#111827" }], type: { h1: { family: "Sora Variable", weight: "700" }, body: { family: "system-ui" } } });
  assert.equal(light.colors.bg, "#FFFFFF");
  assert.equal(light.colors.accent, "#6D28D9");
  assert.equal(light.colors.primary, "#0B1020", "the vivid button color is not taken for the dark surface");
  assert.deepEqual(light.fonts, { display: "Sora", body: null, mono: null });
  const dark = proposeFromImport({ page: { background: "#08090a", text: "#f7f8f8" }, backgrounds: [{ color: "#08090a" }, { color: "#e4f222" }], inks: [{ color: "#f7f8f8" }] });
  assert.ok(contrast(dark.colors["ink-inverse"], dark.colors.primary) >= 4.5);
  assert.notEqual(dark.colors.primary, dark.colors.accent);
});

test("applyColors rewrites the roles and nothing else", () => {
  const { colors, derived } = repair(PRESETS[0].colors);
  const out = applyColors(tokens, colors, derived, { radius: "10px" });
  assert.deepEqual(readColors(out), colors);
  assert.match(out, /--radius:\s+10px;/);
  assert.match(out, /--accent-inverse: #[0-9A-F]{6};/);
  assert.equal(out.split("\n").length, tokens.split("\n").length + 1, "one line added (accent-inverse), none lost");
  assert.ok(!/--accent-inverse: #/.test(applyColors(out, repair(PRESETS[2].colors).colors, {})), "a stale inverse does not outlive its identity");
});

test("the wizard's questions: chapters, and suggestions that follow the objective in any language", () => {
  const es = briefIn("start", "es");
  assert.deepEqual(Object.keys(es.chapters), ["brand", "identity", "goal"]);
  assert.equal(es.questions.filter((q) => q.required).map((q) => q.id).join(), "name,identity,objective,audience");
  assert.equal(optionIndex("start", "objective", "Crear comunidad"), optionIndex("start", "objective", "Build community"));
  assert.deepEqual(suggestionsFor("start", "audience", 0, "en"), ["Small-business owners", "B2B founders", "Whoever decides the purchase"]);
  assert.equal(suggestionsFor("start", "audience", -1, "es").length, 2, "free-text objective: the generic suggestions");
});
