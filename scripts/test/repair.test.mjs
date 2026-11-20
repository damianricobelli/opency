// Auto-repair: introduces defects in a real piece, renders, repairs and renders again.
// Renders launch a headless browser, so this file takes a few seconds.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { balanceHeadline, findTag, logoForSurface, renumberPager, pagersArePadded, setTexture, setLang, planRepairs, skipReason } from "../lib/repair.mjs";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ID = "2026-12-01-repair";
let ws, dir;

const node = (argv) => spawnSync(process.execPath, argv, { cwd: ws, encoding: "utf8", env: { ...process.env, OPENCY_HOME: ws, BRAND: "" } });
const cli = (...argv) => node([path.join(PKG, "bin/opency.mjs"), ...argv]);
const repair = (...argv) => node([path.join(PKG, "scripts/repair.mjs"), ...argv]);
const render = () => {
  const r = node([path.join(PKG, "scripts/render.mjs"), ID]);
  assert.equal(r.status, 0, r.stderr);
  return readFile(path.join(dir, "render/report.json"), "utf8").then(JSON.parse);
};
const slide = (n) => path.join(dir, `slide-0${n}.html`);
const edit = async (n, fn) => writeFile(slide(n), fn(await readFile(slide(n), "utf8")));
const codes = (report, n) => report.slides.find((s) => s.n === n).issues.map((i) => i.code);
// Every text the render saw, minus the pager (the one text a repair is allowed to change).
const copyOf = (report) => report.slides.map((s) => s.texts.filter((t) => t.id !== "pager").map((t) => `${t.id}=${t.text}`));
// Source files of the piece (not render/ or versions/), to prove what was and was not written.
const snapshot = async () => Object.fromEntries(await Promise.all((await readdir(dir)).filter((f) => /\.(html|json)$/.test(f)).sort().map(async (f) => [f, await readFile(path.join(dir, f), "utf8")])));

before(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), "opency-repair-"));
  assert.equal(cli("init", ws).status, 0);
  assert.equal(cli("brand", "new", "cafe", "--name", "Test Coffee").status, 0);
  // A logo per surface: dark artwork for light slides, light artwork for dark ones.
  const bdir = path.join(ws, "brands/cafe");
  const svg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60"><rect width="200" height="60" fill="${fill}"/></svg>`;
  await writeFile(path.join(bdir, "assets/logos/dark.svg"), svg("#121212"));
  await writeFile(path.join(bdir, "assets/logos/light.svg"), svg("#F7F4EE"));
  const brand = JSON.parse(await readFile(path.join(bdir, "brand.json"), "utf8"));
  brand.logos = { onLight: "assets/logos/dark.svg", onDark: "assets/logos/light.svg" };
  await writeFile(path.join(bdir, "brand.json"), JSON.stringify(brand, null, 2));
  const created = cli("new", "repair", "--layouts", "cover-type,steps,closer", "--date", "2026-12-01");
  assert.equal(created.status, 0, created.stderr);
  dir = path.join(bdir, "pieces", ID);
});
after(async () => { await rm(ws, { recursive: true, force: true }); });

test("needs a render report", () => {
  const r = repair(ID);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Render first/);
  assert.equal(repair().status, 1, "usage error without a piece");
  assert.equal(repair("does-not-exist").status, 1);
});

test("repairs what is safe, leaves the copy alone, and is idempotent", { timeout: 120000 }, async () => {
  // Defects. The headline gets a fixed measure (monospace, in ch) so the orphan does not depend on the machine's fonts.
  await edit(1, (h) => h
    .replace(/(<h1 id="headline"[^>]*)>[^<]*</, '$1 style="text-wrap: wrap; font-family: monospace; font-size: 48px; max-width: 26ch">Mistakes that stall your sales<')
    .replace('<html lang="en"', '<html lang="fr"'));
  await edit(2, (h) => h.replace(/(<span id="pager">)[^<]*/, "$107/09").replace('data-texture="fine"', 'data-texture="film"'));
  await edit(3, (h) => h.replace("assets/logos/dark.svg", "assets/logos/light.svg"));

  const first = await render();
  assert.ok(codes(first, 1).includes("headline_orphan"), codes(first, 1).join(", "));
  assert.ok(codes(first, 1).includes("material_drift"));
  assert.ok(codes(first, 3).includes("logo_low_contrast"), codes(first, 3).join(", "));
  const sources = await snapshot();

  // --dry-run: reports the plan, writes nothing
  const dry = repair(ID, "--dry-run", "--json");
  assert.equal(dry.status, 0, dry.stderr);
  const planned = JSON.parse(dry.stdout);
  assert.deepEqual(planned.changedFiles, ["slide-01.html", "slide-02.html", "slide-03.html"]);
  assert.deepEqual(await snapshot(), sources, "--dry-run changes no file");
  assert.ok(!existsSync(path.join(dir, "versions")), "--dry-run saves no version");

  // the real run
  const run = repair(ID, "--json");
  assert.equal(run.status, 0, run.stderr);
  const out = JSON.parse(run.stdout);
  assert.deepEqual(Object.keys(out), ["piece", "fixed", "skipped", "changedFiles"]);
  assert.equal(out.piece, ID);
  assert.deepEqual(out.fixed, planned.fixed);
  assert.deepEqual(out.fixed.map((f) => `${f.code}@${f.slide}`).sort(), ["headline_orphan@1", "html_lang@1", "logo_low_contrast@3", "material_drift@2", "pager_numbering@2"]);
  assert.ok(out.fixed.every((f) => f.where && f.action));
  assert.ok(out.skipped.some((s) => s.code === "missing_alt_text" && s.slide === "copy" && s.reason), "copy findings are skipped with a reason");
  assert.ok(!out.skipped.some((s) => ["headline_orphan", "logo_low_contrast"].includes(s.code)));

  assert.match(await readFile(slide(1), "utf8"), /<html lang="en"/);
  assert.match(await readFile(slide(2), "utf8"), /<span id="pager">02\/03<\/span>/);
  assert.match(await readFile(slide(2), "utf8"), /<main class="canvas[^"]*" data-texture="fine">/);
  assert.match(await readFile(slide(3), "utf8"), /src="\.\.\/\.\.\/assets\/logos\/dark\.svg"/);
  assert.equal(await readFile(path.join(dir, "versions/v1/slide-02.html"), "utf8"), sources["slide-02.html"], "the state before the repair is saved as a version");
  const piece = JSON.parse(await readFile(path.join(dir, "piece.json"), "utf8"));
  assert.equal(piece.history.at(-1).change, "before auto-repair");

  // render again: the repaired codes are gone and no text changed
  const second = await render();
  const all = second.slides.flatMap((s) => s.issues.map((i) => i.code));
  for (const k of ["headline_orphan", "logo_low_contrast", "material_drift"]) assert.ok(!all.includes(k), `${k} still reported: ${all.join(", ")}`);
  assert.deepEqual(copyOf(second), copyOf(first), "copy is untouched");
  assert.equal(second.slides[1].texts.find((t) => t.id === "pager").text, "02/03");

  // second run: nothing to do, nothing written, no new version
  const repaired = await snapshot();
  const again = repair(ID, "--json");
  assert.equal(again.status, 0, again.stderr);
  assert.deepEqual(JSON.parse(again.stdout).fixed, []);
  assert.deepEqual(JSON.parse(again.stdout).changedFiles, []);
  assert.deepEqual(await snapshot(), repaired, "the second run is a no-op");

  const human = repair(ID);
  assert.equal(human.status, 0);
  assert.match(human.stdout, /· copy missing_alt_text .* — skipped: /);
  assert.match(human.stdout, /render/i);
});

// ---------- The edits themselves (no browser) ----------
const SLIDE = `<!doctype html>
<html lang="es">
<head><style>
  #plain { text-wrap: wrap; }
</style></head>
<body>
<main class="canvas on-primary" data-texture="film" style="--grain: 0.4">
  <h1 id="headline" class="t-cover">Uno dos tres</h1>
  <h2 id="plain" class="t-title" style="color: var(--ink)">Uno dos tres</h2>
  <h3 class="custom">Uno dos tres</h3>
  <p class="twin">a</p><p class="twin">b</p>
  <footer data-chrome><img id="logo" class="logo" src="../../assets/logos/a.svg" alt="Marca"><span id="pager">09/09</span></footer>
</main>
</body>
</html>`;
const BASE = ".t-cover, .t-title { font-family: x; text-wrap: balance; }";

test("headline: balances once, and only where balance is not already in effect", () => {
  assert.deepEqual(balanceHeadline(SLIDE, "#headline", BASE), { already: true }, "its class already balances it");
  const a = balanceHeadline(SLIDE, "#plain", BASE);
  assert.match(a.html, /<h2 id="plain" class="t-title" style="color: var\(--ink\); text-wrap: balance">/, "the slide's own rule overrode the class");
  assert.deepEqual(balanceHeadline(a.html, "#plain", BASE), { already: true });
  const b = balanceHeadline(SLIDE, "h3.custom", BASE);
  assert.match(b.html, /<h3 class="custom" style="text-wrap: balance">Uno dos tres<\/h3>/);
  assert.deepEqual(balanceHeadline(SLIDE, "p.twin", BASE), { missing: true }, "ambiguous: two elements share the label");
  assert.equal(findTag(SLIDE, "#nope"), null);
  assert.equal(a.html.replace(/<[^>]+>/g, ""), SLIDE.replace(/<[^>]+>/g, ""), "text is untouched");
});

test("logo, pager, texture and lang edits", () => {
  const logos = { onLight: "l.svg", onDark: "d.svg", onPrimary: "p.svg" };
  assert.deepEqual(logoForSurface(SLIDE, logos), { surface: "on-primary", logo: "p.svg" });
  assert.equal(logoForSurface(SLIDE, { onDark: "d.svg" }).logo, "d.svg");
  assert.equal(logoForSurface(SLIDE.replace("on-primary", "on-bg"), logos).logo, "l.svg");
  assert.equal(logoForSurface(SLIDE.replace("on-primary", "on-bg"), {}).logo, null);

  assert.match(renumberPager(SLIDE, 2, 5).html, /<span id="pager">02\/05<\/span>/);
  assert.match(renumberPager(SLIDE.replace("09/09", "9 / 9"), 2, 5, false).html, /<span id="pager">2 \/ 5<\/span>/);
  assert.deepEqual(renumberPager(SLIDE, 9, 9), { already: true });
  assert.deepEqual(renumberPager(SLIDE.replace("09/09", "Swipe"), 1, 2), { missing: true }, "a pager that is not a counter is left alone");
  assert.equal(pagersArePadded([SLIDE]), true);
  assert.equal(pagersArePadded([SLIDE.replace("09/09", "1/3")]), false);

  assert.match(setTexture(SLIDE, "fine").html, /<main class="canvas on-primary" data-texture="fine">/);
  assert.match(setTexture(SLIDE, "").html, /<main class="canvas on-primary">/);
  assert.deepEqual(setTexture(SLIDE, "film"), { already: true });
  assert.match(setLang(SLIDE, "en").html, /<html lang="en">/);
  assert.deepEqual(setLang(SLIDE, "es"), { already: true });
});

test("plan: unsafe findings are never fixed", () => {
  const report = {
    slides: [{ n: 1, file: "slide-01.html", issues: [
      { code: "unreadable_contrast", where: "#headline", msg: "" }, { code: "text_overflow", where: "#headline", msg: "" },
      { code: "illegible_text_size", where: "#pager", msg: "" }, { code: "image_upscaled", where: "img", msg: "" },
      { code: "material_drift", where: "", msg: "mixed photo treatments: a, b. One per piece" }, { code: "some_future_code", where: "", msg: "" },
    ] }],
    copy: [{ code: "copy_ai_phrase:contraste", where: "slide 1 #headline", msg: "" }, { code: "copy_too_many_hashtags", where: "instagram", msg: "" }, { code: "unsourced_figure", where: "slide 1", msg: "" }],
  };
  const html = SLIDE.replace("09/09", "01/01");
  const plan = planRepairs({ report, piece: { language: "es" }, brand: { loaded: true, raw: { defaults: { texture: "fine" } } }, slides: [{ file: "slide-01.html", html }], baseCss: BASE });
  assert.deepEqual(plan.fixed, []);
  assert.deepEqual(plan.files, {});
  assert.equal(plan.skipped.length, 9);
  assert.ok(plan.skipped.every((s) => s.reason.length > 10));
  assert.match(skipReason("copy_emoji"), /never rewritten/);
});
