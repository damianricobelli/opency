// npx opentcy doctor — comprueba que los chequeos detectan lo que tienen que detectar y no marcan lo que está bien.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "../lib/project.mjs";
import { lintCopy, detectAddress, jaccard } from "../lib/copy-lint.mjs";

const codes = (issues) => issues.map((i) => i.code);
const slide = (headline, support, extra = []) => [{ n: 1, texts: [{ id: "h", role: "headline", text: headline }, ...(support ? [{ id: "s", role: "support", text: support }] : []), ...extra] }];

test("copy: frases de IA por familia", () => {
  const c = codes(lintCopy({ slides: slide("No es solo una app, es una experiencia", "Potenciá tu marca con una solución increíble") }));
  assert.ok(c.includes("copy_ai_phrase:contraste"));
  assert.ok(c.includes("copy_ai_phrase:verbo_folleto") || c.includes("copy_ai_phrase:adjetivo_vacio"));
});
test("copy: un texto concreto no dispara nada", () => {
  assert.deepEqual(lintCopy({ slides: slide("Los reportes se copian a mano", "Lo vemos en empresas que crecieron rápido."), address: "vos" }), []);
});
test("copy: las frases que la marca usa quedan exentas", () => {
  const voiceSamples = "Así de simple: pan, agua y tiempo.";
  assert.ok(!codes(lintCopy({ slides: slide("Así de simple", ""), voiceSamples })).some((c) => c.startsWith("copy_ai_phrase")));
});
test("copy: trato mezclado, sin falsos positivos por sustantivos", () => {
  assert.deepEqual(detectAddress("La prueba que mira el equipo entra en producción"), []);
  assert.deepEqual(detectAddress("Si tenés dudas, escribinos"), ["vos"]);
  assert.ok(codes(lintCopy({ slides: slide("Si tienes dudas, escríbenos", ""), address: "vos" })).includes("copy_address_mismatch"));
});
test("copy: cifras, validadas una por una", () => {
  const s = slide("Resultados", "", [{ id: "b", role: "body", text: "Bajamos 40% el tiempo y sumamos 120 clientes" }]);
  assert.equal(codes(lintCopy({ slides: s })).filter((c) => c === "unsourced_figure").length, 2);
  const one = lintCopy({ slides: s, sources: [{ claim: "tiempo de reporte 40% menor", source: "informe interno" }] });
  assert.equal(codes(one).filter((c) => c === "unsourced_figure").length, 1, "una fuente respalda solo su cifra");
  const both = lintCopy({ slides: s, sources: ["40% menos tiempo"], verified: [{ fact: "clientes", value: "120" }] });
  assert.ok(!codes(both).includes("unsourced_figure"));
});
test("copy: portada, bajada, caption", () => {
  const c = codes(lintCopy({ slides: slide("Llevamos tu negocio a un lugar mejor cada día de la semana", "Con nosotros tu negocio llega a un lugar mejor"), captions: { instagram: "Llevamos tu negocio a un lugar mejor\n\nMás info\n#love #fyp #a #b" } }));
  for (const k of ["cover_too_long", "copy_support_repeats_headline", "caption_repeats_cover", "copy_generic_cta", "copy_too_many_hashtags", "copy_filler_hashtags"]) assert.ok(c.includes(k), k);
  assert.ok(jaccard("uno dos tres", "cuatro cinco seis") === 0);
});

const render = (dir) => { try { execFileSync("node", ["scripts/render.mjs", dir], { cwd: ROOT, stdio: "pipe" }); } catch (e) { if (!e.stdout) throw e; } return JSON.parse(readFileSync(path.join(ROOT, dir, "render/report.json"), "utf8")); };

test("render: detecta los defectos del fixture", { timeout: 120000 }, () => {
  const r = render("scripts/test/fixtures/defects");
  const c = [...codes(r.slides[0].issues), ...codes(r.copy)];
  for (const k of ["unreadable_contrast", "headline_orphan", "critical_overlap", "illegible_text_size", "placeholder_left", "external_image", "brand_literal_color", "over_budget", "unsourced_figure", "copy_emoji", "copy_filler_hashtags", "missing_alt_text"]) assert.ok(c.includes(k), `falta ${k} en: ${c.join(", ")}`);
  assert.ok(c.includes("layer_out_of_bounds") || c.includes("outside_safe_area"));
});
test("render: la librería de layouts pasa limpia", { timeout: 240000 }, () => {
  const r = render("templates/layouts");
  assert.equal(r.summary.errors, 0);
  assert.equal(r.summary.warnings, 0, JSON.stringify(r.slides.flatMap((s) => s.issues)));
});
