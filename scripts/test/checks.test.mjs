// npx @opency/cli doctor — verifies that the checks catch what they should and do not flag what is fine.
// The copy linter has one block of lists per language: the Spanish samples come first (the default language),
// the English ones are marked (en).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "../lib/project.mjs";
import { lintCopy, detectAddress, jaccard } from "../lib/copy-lint.mjs";

const codes = (issues) => issues.map((i) => i.code);
const slide = (headline, support, extra = []) => [{ n: 1, texts: [{ id: "h", role: "headline", text: headline }, ...(support ? [{ id: "s", role: "support", text: support }] : []), ...extra] }];

test("copy: AI phrases by family", () => {
  const c = codes(lintCopy({ slides: slide("No es solo una app, es una experiencia", "Potenciá tu marca con una solución increíble") }));
  assert.ok(c.includes("copy_ai_phrase:contraste"));
  assert.ok(c.includes("copy_ai_phrase:verbo_folleto") || c.includes("copy_ai_phrase:adjetivo_vacio"));
});
test("copy: a concrete text triggers nothing", () => {
  assert.deepEqual(lintCopy({ slides: slide("Los reportes se copian a mano", "Lo vemos en empresas que crecieron rápido."), address: "vos" }), []);
});
test("copy: phrases the brand uses are exempt", () => {
  const voiceSamples = "Así de simple: pan, agua y tiempo.";
  assert.ok(!codes(lintCopy({ slides: slide("Así de simple", ""), voiceSamples })).some((c) => c.startsWith("copy_ai_phrase")));
});
test("copy: mixed form of address, no false positives from nouns", () => {
  assert.deepEqual(detectAddress("La prueba que mira el equipo entra en producción"), []);
  assert.deepEqual(detectAddress("Si tenés dudas, escribinos"), ["vos"]);
  assert.ok(codes(lintCopy({ slides: slide("Si tienes dudas, escríbenos", ""), address: "vos" })).includes("copy_address_mismatch"));
});
test("copy: figures, validated one by one", () => {
  const s = slide("Resultados", "", [{ id: "b", role: "body", text: "Bajamos 40% el tiempo y sumamos 120 clientes" }]);
  assert.equal(codes(lintCopy({ slides: s })).filter((c) => c === "unsourced_figure").length, 2);
  const one = lintCopy({ slides: s, sources: [{ claim: "tiempo de reporte 40% menor", source: "informe interno" }] });
  assert.equal(codes(one).filter((c) => c === "unsourced_figure").length, 1, "a source backs only its own figure");
  const both = lintCopy({ slides: s, sources: ["40% menos tiempo"], verified: [{ fact: "clientes", value: "120" }] });
  assert.ok(!codes(both).includes("unsourced_figure"));
});
test("copy: cover, supporting line, caption", () => {
  const c = codes(lintCopy({ slides: slide("Llevamos tu negocio a un lugar mejor cada día de la semana", "Con nosotros tu negocio llega a un lugar mejor"), captions: { instagram: "Llevamos tu negocio a un lugar mejor\n\nMás info\n#love #fyp #a #b" } }));
  for (const k of ["cover_too_long", "copy_support_repeats_headline", "caption_repeats_cover", "copy_generic_cta", "copy_too_many_hashtags", "copy_filler_hashtags"]) assert.ok(c.includes(k), k);
  assert.ok(jaccard("uno dos tres", "cuatro cinco seis") === 0);
});

// ---------- English copy (language: "en") ----------
const en = (headline, support, opts = {}) => codes(lintCopy({ slides: slide(headline, support), language: "en", ...opts }));
const aiFamilies = (c) => c.filter((x) => x.startsWith("copy_ai_phrase:")).map((x) => x.split(":")[1]);

test("copy (en): AI phrases by family, same category keys as Spanish", () => {
  const cases = {
    contraste: ["It's not a tool, it's a teammate", "It’s not about the price. It’s about the value", "This isn't just a newsletter, it's a community", "More than just a gym", "Not only fast but also reliable"],
    cierre_generico: ["It's that simple", "Don't miss out", "What are you waiting for?", "Stay tuned", "The possibilities are endless"],
    verbo_folleto: ["Unlock your potential", "Elevate your brand", "Supercharge growth", "We revolutionize retail", "Transform your business", "Take your marketing to the next level", "Unleash creativity", "Harness the power of AI", "We empower teams"],
    adjetivo_vacio: ["A game-changing platform", "Cutting-edge tech", "A seamless experience", "World-class support", "Best-in-class tools", "An innovative approach", "A robust solution", "A revolutionary idea", "Next-level results", "Unparalleled service"],
    apertura_gastada: ["Did you know most bread is frozen?", "Imagine a week without reports", "In today's fast-paced world, time matters", "In the ever-evolving retail market", "Now more than ever", "Let's dive in", "Ever wondered why?"],
    triada: ["Simple, fast and effective", "Reliable, scalable, and secure"],
  };
  for (const [family, texts] of Object.entries(cases)) for (const t of texts) assert.deepEqual(aiFamilies(en(t, "")), [family], t);
  // the offending phrase is echoed as found, in an English message
  const [issue] = lintCopy({ slides: slide("Stay Tuned", ""), language: "en" });
  assert.equal(issue.msg, `"Stay Tuned" — replace with a concrete fact in the brand's own words`);
});
test("copy (en): a concrete text triggers nothing", () => {
  assert.deepEqual(lintCopy({ slides: slide("Reports are copied by hand", "We see it in companies that grew fast."), language: "en" }), []);
  for (const t of ["We transform CSV exports into dashboards", "The parser is robust to malformed rows", "It took more than a year to build", "Eggs, flour and butter", "Seamless leggings in four colors", "Unlock your phone with a tap", "It's hard to imagine a slower process", "We meet 3 times a week", "It's not open on Mondays"])
    assert.deepEqual(en(t, ""), [], t);
});
test("copy (en): phrases the brand uses are exempt", () => {
  const voiceSamples = "It's that simple: bread, water and time.";
  assert.ok(aiFamilies(en("It's that simple", "")).includes("cierre_generico"));
  assert.deepEqual(aiFamilies(en("It's that simple", "", { voiceSamples })), []);
});
test("copy (en): the form-of-address check never fires", () => {
  // "vos", "usted" or a Spanish verb form inside English copy must not produce a mismatch, whatever the brand kit says
  for (const address of ["vos", "tú", "usted", null]) {
    const c = codes(lintCopy({ slides: slide("Our vos and usted guide", "Si tienes dudas, escríbenos"), captions: { instagram: "Ask for it as usted would." }, language: "en", address }));
    assert.ok(!c.includes("copy_address_mismatch"), String(address));
  }
});
test("copy (en): generic CTA and filler hashtags", () => {
  const caption = (last, tags = "#sourdough") => codes(lintCopy({ slides: slide("Bread at seven", ""), captions: { instagram: `We bake at four and deliver by seven.\n\n${last}\n${tags}` }, language: "en" }));
  for (const cta of ["Learn more", "Click here.", "Link in bio", "Check it out!", "Find out more", "Learn more: link in bio"]) assert.ok(caption(cta).includes("copy_generic_cta"), cta);
  for (const cta of ["Link in bio to book a 20-minute audit", "DM us BREAD and we'll send the delivery map."]) assert.deepEqual(caption(cta), [], cta);
  const c = caption("Order before noon on the site.", "#love #instagood #fyp #viral #marketing #business #success #motivation");
  assert.ok(c.includes("copy_filler_hashtags") && c.includes("copy_too_many_hashtags"));
  assert.deepEqual(caption("Order before noon on the site.", "#sourdough #bakery"), []);
});
test("copy (en): figures and similarity use the English lists", () => {
  assert.ok(en("Results", "We added 120 customers").includes("unsourced_figure"));
  assert.ok(!en("Results", "We added 120 customers", { verified: [{ fact: "customers", value: "120" }] }).includes("unsourced_figure"));
  assert.ok(en("Your reports take all week", "Reports that take your whole week").includes("copy_support_repeats_headline"));
  assert.ok(jaccard("these other things", "those many things before", "en") === 1, "English stop words are ignored");
});
test("copy: language falls back from piece to brand to Spanish", () => {
  const s = slide("Stay tuned", "No te lo pierdas");
  const where = (o) => lintCopy({ slides: s, ...o }).map((i) => i.where);
  assert.deepEqual(where({}), ["slide 1 #s"]);
  assert.deepEqual(where({ brandLanguage: "en" }), ["slide 1 #h"]);
  assert.deepEqual(where({ language: "es", brandLanguage: "en" }), ["slide 1 #s"]);
  assert.deepEqual(where({ language: "en-US", brandLanguage: "es" }), ["slide 1 #h"]);
  assert.deepEqual(where({ language: "pt", brandLanguage: "en" }), ["slide 1 #h"], "unsupported piece language falls back to the brand");
  assert.deepEqual(where({ language: "pt" }), ["slide 1 #s"]);
});
test("copy: Spanish regression, exactly the same codes and messages as before the English lists", () => {
  const input = {
    slides: [
      { n: 1, texts: [{ id: "h", role: "headline", text: "No es solo una app, es una experiencia" }, { id: "s", role: "support", text: "Potenciá tu marca con una solución increíble" }] },
      { n: 2, texts: [{ id: "b", role: "body", text: "¿Sabías que es simple, rápido y efectivo? Sumamos 120 clientes. Así de simple." }, { id: "c", role: "body", text: "Si tienes dudas, escríbenos. Unlock your potential, it's a game-changer" }] },
    ],
    captions: { instagram: "Una app nueva\n\nMás info\n#love #fyp #a #b", linkedin: "No dudes en contactarnos", x: { thread: ["Hoy más que nunca — llevá tu negocio al siguiente nivel"] } },
    address: "vos",
  };
  const expected = [
    "copy_ai_phrase:contraste", "copy_ai_phrase:adjetivo_vacio",
    "copy_ai_phrase:cierre_generico", "copy_ai_phrase:apertura_gastada", "unsourced_figure",
    "copy_ai_phrase:verbo_folleto", "copy_ai_phrase:adjetivo_vacio", "copy_address_mismatch",
    "copy_too_many_hashtags", "copy_filler_hashtags", "copy_generic_cta", "copy_generic_cta",
    "copy_ai_phrase:verbo_folleto", "copy_ai_phrase:apertura_gastada", "copy_dash",
  ];
  const base = lintCopy(input);
  assert.deepEqual(codes(base), expected);
  assert.equal(base[0].msg, `"No es solo una app, es" — replace with a concrete fact in the brand's own words`);
  assert.equal(base[7].msg, `form of address "tú" but the brand uses "vos"`);
  for (const extra of [{ language: "es" }, { brandLanguage: "es" }, { language: "es-AR", brandLanguage: "en" }]) assert.deepEqual(lintCopy({ ...input, ...extra }), base);
});

const render = (dir) => { try { execFileSync("node", ["scripts/render.mjs", dir], { cwd: ROOT, stdio: "pipe" }); } catch (e) { if (!e.stdout) throw e; } return JSON.parse(readFileSync(path.join(ROOT, dir, "render/report.json"), "utf8")); };

test("render: detects the fixture defects", { timeout: 120000 }, () => {
  const r = render("scripts/test/fixtures/defects");
  const c = [...codes(r.slides[0].issues), ...codes(r.copy)];
  for (const k of ["unreadable_contrast", "headline_orphan", "critical_overlap", "illegible_text_size", "placeholder_left", "external_image", "brand_literal_color", "over_budget", "unsourced_figure", "copy_emoji", "copy_filler_hashtags", "missing_alt_text"]) assert.ok(c.includes(k), `missing ${k} in: ${c.join(", ")}`);
  assert.ok(c.includes("layer_out_of_bounds") || c.includes("outside_safe_area"));
  for (const k of ["decorative_container", "orphan_divider"]) assert.ok(c.includes(k), k);
});
test("render: the layout library passes clean", { timeout: 240000 }, () => {
  const r = render("templates/layouts");
  assert.equal(r.summary.errors, 0);
  assert.equal(r.summary.warnings, 0, JSON.stringify(r.slides.flatMap((s) => s.issues)));
});
