// `fonts` command: the pure parts (download plan, @font-face CSS, tokens.css patch) and argument validation run
// offline; the tests that download from Fontsource and load the fonts in a browser only run with OPENCY_TEST_NETWORK=1.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fileBase, rankFonts, parseWeights, defaultWeights, planFiles, fontFaceCss, fontStack, patchTokens, parseFontFaces, describeTokens, weightWarnings, licenseFileName } from "../lib/fonts.mjs";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NET = process.env.OPENCY_TEST_NETWORK === "1";
const today = new Date().toISOString().slice(0, 10);
let ws;

const node = (file, argv, env = {}) => spawnSync(process.execPath, [path.join(PKG, file), ...argv], { encoding: "utf8", cwd: ws, env: { ...process.env, OPENCY_HOME: ws, BRAND: "", ...env }, timeout: 300000 });
const fonts = (...argv) => node("scripts/fonts.mjs", argv);
const cli = (...argv) => node("bin/opency.mjs", argv);
const inBrand = (...p) => path.join(ws, "brands/acme", ...p);
const tokensOf = () => readFile(inBrand("tokens.css"), "utf8");

before(() => {
  return (async () => {
    ws = await mkdtemp(path.join(os.tmpdir(), "opency-fonts-"));
    const init = spawnSync(process.execPath, [path.join(PKG, "bin/opency.mjs"), "init", ws], { encoding: "utf8" });
    assert.equal(init.status, 0, init.stderr);
    const brand = cli("brand", "new", "acme", "--name", "Acme");
    assert.equal(brand.status, 0, brand.stderr);
  })();
});
after(async () => { await rm(ws, { recursive: true, force: true }); });

// ---------- Fixtures ----------
const TOKENS = `/* Brand tokens. An old rule kept as a note:
   @font-face { font-family: "Fraunces"; font-weight: 400; src: url("./assets/fonts/Old.woff2"); } */
@font-face { font-family: "Inter Tight"; font-weight: 700; font-display: block; src: url("./assets/fonts/InterTight-700.woff2") format("woff2"); }
@font-face { font-family: "Inter Tight"; font-weight: 800; font-display: block; src: url("./assets/fonts/InterTight-800.woff2") format("woff2"); }
@font-face { font-family: "Inter";       font-weight: 400; font-display: block; src: url("./assets/fonts/Inter-400.woff2") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 500; font-display: block; src: url("./assets/fonts/JetBrainsMono-500.woff2") format("woff2"); }

:root {
  --accent:       #FF5A1F;
  /* --font-display: "Commented", serif; */
  --font-display: "Inter Tight", "Inter", system-ui, sans-serif;  /* headlines */
  --font-body:    "Inter", system-ui, sans-serif;                 /* body text */
  --font-mono:    "JetBrains Mono", ui-monospace, monospace;      /* small uppercase labels */
  --weight-display: 800;
  --weight-title:   700;
}
`;
const FRAUNCES = { id: "fraunces", family: "Fraunces", subsets: ["latin", "latin-ext", "vietnamese"], weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], styles: ["italic", "normal"], variable: true, license: "OFL-1.1", npmVersion: "5.2.9", unicodeRange: { latin: "U+0000-00FF", "latin-ext": "U+0100-02BA" } };
const PLEX = { id: "ibm-plex-mono", family: "IBM Plex Mono", subsets: ["latin", "cyrillic"], weights: [100, 200, 300, 400, 500, 600, 700], styles: ["italic", "normal"], variable: false, license: "OFL-1.1", npmVersion: "5.3.0",
  variants: { 400: { normal: { latin: { url: { woff2: "https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@5.3.0/latin-400-normal.woff2" } } } } } };
const AXES = { wght: { default: "400", min: "100", max: "900", step: "1" } };
const CATALOG = [
  { id: "inter", family: "Inter" }, { id: "inter-tight", family: "Inter Tight" }, { id: "interstate", family: "Interstate" },
  { id: "winter-sun", family: "Winter Sun" }, { id: "playfair-display", family: "Playfair Display" }, { id: "dm-sans", family: "DM Sans" },
];

// ---------- Offline: pure logic ----------
test("file names follow the demo brand", () => {
  assert.equal(fileBase("Inter Tight"), "InterTight");
  assert.equal(fileBase("JetBrains Mono"), "JetBrainsMono");
  assert.equal(fileBase("IBM Plex Sans"), "IBMPlexSans");
  assert.equal(licenseFileName(FRAUNCES), "OFL-Fraunces.txt");
  assert.equal(licenseFileName({ family: "Roboto Slab", license: "Apache-2.0" }), "Apache-2.0-RobotoSlab.txt");
});

test("search ranking: exact first, then prefixes; closest names only as a fallback", () => {
  assert.deepEqual(rankFonts(CATALOG, "inter").map((f) => f.id), ["inter", "inter-tight", "interstate", "winter-sun"]);
  assert.deepEqual(rankFonts(CATALOG, "Playfair Display").map((f) => f.id), ["playfair-display"]);
  assert.deepEqual(rankFonts(CATALOG, "intr"), []);
  assert.equal(rankFonts(CATALOG, "intr", { fuzzy: true })[0].id, "inter");
  assert.equal(rankFonts(CATALOG, "inter", { limit: 2 }).length, 2);
});

test("weights: parsing and defaults never invent a weight", () => {
  assert.deepEqual(parseWeights("700, 400,700"), [400, 700]);
  assert.equal(parseWeights(undefined), null);
  assert.throws(() => parseWeights("bold"), /Invalid weight/);
  assert.throws(() => parseWeights(true), /needs a list/);
  assert.deepEqual(defaultWeights([100, 400, 700, 900]), [400, 700]);
  assert.deepEqual(defaultWeights([300, 500, 800]), [300, 800]);
  assert.deepEqual(defaultWeights([800]), [800]);
});

test("plan: one variable file by default, one file per explicit weight", () => {
  const v = planFiles(FRAUNCES, AXES);
  assert.equal(v.variable, true);
  assert.deepEqual(v.weightRange, [100, 900]);
  assert.deepEqual(v.files.map((f) => [f.file, f.url, f.weight]), [["Fraunces-var.woff2", "https://cdn.jsdelivr.net/fontsource/fonts/fraunces:vf@5.2.9/latin-wght-normal.woff2", "100 900"]]);

  const s = planFiles(FRAUNCES, AXES, { weights: [400, 700] });
  assert.equal(s.variable, false);
  assert.deepEqual(s.files.map((f) => f.file), ["Fraunces-400.woff2", "Fraunces-700.woff2"]);
  assert.equal(s.files[0].url, "https://cdn.jsdelivr.net/fontsource/fonts/fraunces@5.2.9/latin-400-normal.woff2");

  const p = planFiles(PLEX, null, { italic: true });
  assert.deepEqual(p.weights, [400, 700]);
  assert.deepEqual(p.files.map((f) => f.file), ["IBMPlexMono-400.woff2", "IBMPlexMono-400-italic.woff2", "IBMPlexMono-700.woff2", "IBMPlexMono-700-italic.woff2"]);
  assert.equal(p.files[0].url, PLEX.variants[400].normal.latin.url.woff2);

  const multi = planFiles(FRAUNCES, AXES, { subsets: ["latin", "latin-ext"] });
  assert.deepEqual(multi.files.map((f) => [f.file, f.unicodeRange]), [["Fraunces-var.woff2", "U+0000-00FF"], ["Fraunces-var-latin-ext.woff2", "U+0100-02BA"]]);
});

test("plan: refuses what the family does not publish", () => {
  assert.throws(() => planFiles(PLEX, null, { weights: [400, 800] }), /no weight 800\. Available: 100, 200, 300, 400, 500, 600, 700/);
  assert.throws(() => planFiles(PLEX, null, { subsets: ["greek"] }), /no "greek" subset\. Available: latin, cyrillic/);
  assert.throws(() => planFiles({ ...PLEX, styles: ["normal"] }, null, { italic: true }), /no italic/);
});

test("@font-face CSS matches the tokens.css form", () => {
  assert.equal(fontFaceCss("Fraunces", planFiles(FRAUNCES, AXES).files),
    '@font-face { font-family: "Fraunces"; font-weight: 100 900; font-display: block; src: url("./assets/fonts/Fraunces-var.woff2") format("woff2-variations"); }');
  const css = fontFaceCss("IBM Plex Mono", planFiles(PLEX, null, { weights: [400], italic: true }).files).split("\n");
  assert.equal(css[0], '@font-face { font-family: "IBM Plex Mono"; font-weight: 400; font-style: normal; font-display: block; src: url("./assets/fonts/IBMPlexMono-400.woff2") format("woff2"); }');
  assert.match(css[1], /font-style: italic;.*IBMPlexMono-400-italic\.woff2/);
});

test("font stack: replaces the brand family, keeps the fallbacks", () => {
  assert.equal(fontStack('"Inter Tight", "Inter", system-ui, sans-serif', "Fraunces", "display"), '"Fraunces", "Inter", system-ui, sans-serif');
  assert.equal(fontStack('"Inter Tight", "Inter", system-ui, sans-serif', "Inter", "display"), '"Inter", system-ui, sans-serif');
  assert.equal(fontStack("system-ui, sans-serif", "Fraunces", "body"), '"Fraunces", system-ui, sans-serif');
  assert.equal(fontStack(null, "IBM Plex Mono", "mono"), '"IBM Plex Mono", ui-monospace, monospace');
  assert.equal(fontStack("var(--font-body)", "Fraunces", "display"), '"Fraunces", system-ui, sans-serif');
});

test("patch: adds a new family after the existing rules and sets only its role", () => {
  const fontFace = fontFaceCss("Fraunces", planFiles(FRAUNCES, AXES).files);
  const out = patchTokens(TOKENS, { family: "Fraunces", fontFace, role: "display" });
  assert.equal(parseFontFaces(out).length, 5);
  assert.ok(out.includes(`JetBrainsMono-500.woff2") format("woff2"); }\n${fontFace}\n\n:root {`), "inserted right after the last @font-face");
  assert.ok(out.includes('  --font-display: "Fraunces", "Inter", system-ui, sans-serif;  /* headlines */'));
  // Everything else is byte-identical.
  const strip = (s) => s.split("\n").filter((l) => !l.includes("Fraunces-var") && !/^\s*--font-display:/.test(l)).join("\n");
  assert.equal(strip(out), strip(TOKENS));
  assert.ok(out.includes('/* --font-display: "Commented", serif; */'), "commented declarations stay");
  assert.ok(out.includes('font-family: "Fraunces"; font-weight: 400; src: url("./assets/fonts/Old.woff2")'), "commented rules stay");
  assert.equal(patchTokens(out, { family: "Fraunces", fontFace, role: "display" }), out, "idempotent");
});

test("patch: replaces the rules of a family already declared", () => {
  const fontFace = '@font-face { font-family: "Inter Tight"; font-weight: 100 900; font-display: block; src: url("./assets/fonts/InterTight-var.woff2") format("woff2-variations"); }';
  const out = patchTokens(TOKENS, { family: "Inter Tight", fontFace, role: "display" });
  const faces = parseFontFaces(out);
  assert.deepEqual(faces.map((f) => `${f.family} ${f.weight}`), ["Inter Tight 100 900", "Inter 400", "JetBrains Mono 500"]);
  assert.ok(!out.includes("InterTight-700.woff2") && !out.includes("InterTight-800.woff2"));
  assert.equal(out.split("\n").length, TOKENS.split("\n").length - 1, "the second old rule goes away with its line");
  assert.ok(out.includes('--font-display: "Inter Tight", "Inter", system-ui, sans-serif;'));
  assert.equal(patchTokens(out, { family: "Inter Tight", fontFace, role: "display" }), out, "idempotent");

  // Several rules replacing one, then the same again.
  const two = fontFaceCss("Inter", planFiles({ ...PLEX, id: "inter", family: "Inter", variants: {} }, null, { weights: [400, 700] }).files);
  const body = patchTokens(TOKENS, { family: "Inter", fontFace: two, role: "body" });
  assert.deepEqual(parseFontFaces(body).filter((f) => f.family === "Inter").map((f) => f.weight), ["400", "700"]);
  assert.equal(patchTokens(body, { family: "Inter", fontFace: two, role: "body" }), body, "idempotent");
});

test("patch: files without rules, without the variable or without :root", () => {
  const fontFace = fontFaceCss("Fraunces", planFiles(FRAUNCES, AXES).files);
  const noRules = patchTokens("/* tokens */\n:root {\n  --bg: #fff;\n}\n", { family: "Fraunces", fontFace, role: "body" });
  assert.equal(noRules, `/* tokens */\n${fontFace}\n\n:root {\n  --font-body: "Fraunces", system-ui, sans-serif;\n  --bg: #fff;\n}\n`);
  const empty = patchTokens("", { family: "Fraunces", fontFace, role: "mono" });
  assert.ok(empty.startsWith(fontFace) && empty.includes(':root {\n  --font-mono: "Fraunces", ui-monospace, monospace;\n}'));
  for (const css of [noRules, empty]) assert.equal(patchTokens(css, { family: "Fraunces", fontFace, role: css === empty ? "mono" : "body" }), css, "idempotent");
  assert.throws(() => patchTokens(TOKENS, { family: "Fraunces", fontFace, role: "headline" }), /Unknown role/);
});

test("tokens are described by family and role; uncovered weight tokens are flagged", () => {
  const d = describeTokens(TOKENS);
  assert.deepEqual(d.families.map((f) => [f.family, f.roles, f.faces.length]), [["Inter Tight", ["display"], 2], ["Inter", ["body"], 1], ["JetBrains Mono", ["mono"], 1]]);
  assert.deepEqual(d.roles.display, { family: "Inter Tight", value: '"Inter Tight", "Inter", system-ui, sans-serif', declared: true });
  const w = weightWarnings(TOKENS, "display", planFiles(FRAUNCES, AXES, { weights: [400, 700] }));
  assert.equal(w.length, 1);
  assert.match(w[0], /--weight-display is 800/);
  assert.deepEqual(weightWarnings(TOKENS, "display", planFiles(FRAUNCES, AXES)), []);
});

// ---------- Offline: the command ----------
test("argument validation fails with one line and exit 1, before any download", async () => {
  const cases = [
    [[], /^✗ Usage:/],
    [["search"], /^✗ Usage:.*fonts search/],
    [["add", "--role", "display"], /^✗ Usage:.*fonts add/],
    [["add", "Inter"], /^✗ --role must be one of display, body, mono/],
    [["add", "Inter", "--role", "headline"], /^✗ --role must be one of/],
    [["add", "Inter", "--role", "body", "--weights", "bold"], /^✗ Invalid weight "bold"/],
    [["add", "Inter", "--role", "body", "--weights"], /^✗ --weights needs a list/],
    [["add", "Inter", "--role", "body", "--subset"], /^✗ --subset needs a value/],
    [["add", "Inter", "--role", "body", "--brand", "nope"], /^✗ brands\/nope does not exist/],
    [["add", "Inter", "--role", "body", "--brand", "_demo"], /^✗ brands\/_demo is a demo brand/],
  ];
  const before = await readdir(inBrand("assets/fonts"));
  for (const [argv, expected] of cases) {
    const r = fonts(...argv);
    assert.equal(r.status, 1, `${argv.join(" ")} → ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, expected);
    assert.equal(r.stderr.trim().split("\n").length, 1, "one line");
    assert.equal(r.stdout, "");
  }
  assert.deepEqual(await readdir(inBrand("assets/fonts")), before);
});

test("list shows the files of the brand and what tokens.css declares", () => {
  const r = fonts("list", "--brand", "acme", "--json");
  assert.equal(r.status, 0, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.equal(d.brand, "acme");
  assert.ok(d.files.some((f) => f.file === "Inter-400.woff2" && f.family === "Inter" && f.bytes > 1000));
  assert.deepEqual(d.roles.display.family, "Inter Tight");
  assert.deepEqual(d.families.find((f) => f.family === "JetBrains Mono").roles, ["mono"]);
  assert.deepEqual(d.missing, []);
  assert.ok(d.licenses.includes("OFL-Inter.txt"));
  const human = fonts("list", "--brand", "acme");
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /display\s+Inter Tight/);
});

// ---------- Network: Fontsource and a real browser ----------
test("search finds Inter", { skip: !NET }, () => {
  const r = fonts("search", "inter", "--json");
  assert.equal(r.status, 0, r.stderr);
  const list = JSON.parse(r.stdout);
  assert.ok(list.length > 1 && list.length <= 12);
  assert.deepEqual({ family: list[0].family, id: list[0].id, variable: list[0].variable, license: list[0].license }, { family: "Inter", id: "inter", variable: true, license: "OFL-1.1" });
  assert.ok(list[0].weights.includes(400) && list[0].category);
  const human = fonts("search", "inter");
  assert.match(human.stdout.split("\n")[0], /^Inter\s+inter\s+sans-serif\s+100–900\s+variable\s+OFL-1\.1$/);
});

test("add without --apply only writes assets/fonts and prints what to add", { skip: !NET }, async () => {
  const tokens = await tokensOf();
  const r = fonts("add", "Space Grotesk", "--role", "display", "--brand", "acme");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /@font-face \{ font-family: "Space Grotesk"; font-weight: 300 700; .*SpaceGrotesk-var\.woff2/);
  assert.match(r.stdout, /--font-display: "Space Grotesk", "Inter", system-ui, sans-serif;/);
  assert.match(r.stdout, /Not applied/);
  assert.ok(existsSync(inBrand("assets/fonts/SpaceGrotesk-var.woff2")));
  assert.equal(await tokensOf(), tokens);
  assert.ok(!existsSync(inBrand("history")));
});

test("add a variable family for display with --apply; the second run changes nothing", { skip: !NET }, async () => {
  const original = await tokensOf();
  const r = fonts("add", "Fraunces", "--role", "display", "--apply", "--brand", "acme", "--json");
  assert.equal(r.status, 0, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.deepEqual({ family: d.family, id: d.id, role: d.role, variable: d.variable, applied: d.applied, license: d.license }, { family: "Fraunces", id: "fraunces", role: "display", variable: true, applied: true, license: "OFL-1.1" });
  assert.deepEqual(d.files, ["brands/acme/assets/fonts/Fraunces-var.woff2"]);
  assert.deepEqual(d.weights, [100, 200, 300, 400, 500, 600, 700, 800, 900]);
  assert.equal(d.tokensBackup, `brands/acme/history/${today}/tokens.css`);
  assert.equal((await readFile(inBrand("assets/fonts/Fraunces-var.woff2"))).subarray(0, 4).toString("latin1"), "wOF2");
  assert.match(await readFile(inBrand("assets/fonts/OFL-Fraunces.txt"), "utf8"), /SIL Open Font License/i);
  assert.equal(await readFile(path.join(ws, d.tokensBackup), "utf8"), original);

  const tokens = await tokensOf();
  assert.ok(tokens.includes('@font-face { font-family: "Fraunces"; font-weight: 100 900; font-display: block; src: url("./assets/fonts/Fraunces-var.woff2") format("woff2-variations"); }'));
  assert.ok(tokens.includes(d.fontFace));
  assert.match(tokens, /--font-display: "Fraunces", "Inter", system-ui, sans-serif;/);
  assert.match(tokens, /--font-body:\s+"Inter", system-ui, sans-serif;/);

  const again = fonts("add", "fraunces", "--role", "display", "--apply", "--brand", "acme", "--json");
  assert.equal(again.status, 0, again.stderr);
  const d2 = JSON.parse(again.stdout);
  assert.equal(d2.applied, true);
  assert.equal(d2.tokensBackup, null, "nothing changed, nothing to back up");
  assert.equal(await tokensOf(), tokens);
  assert.equal(await readFile(path.join(ws, d.tokensBackup), "utf8"), original, "the backup still holds the original");
  assert.deepEqual(await readdir(inBrand("history", today)), ["tokens.css"]);
});

test("add a static family with explicit weights", { skip: !NET }, async () => {
  const r = fonts("add", "IBM Plex Mono", "--role", "mono", "--weights", "400,500", "--apply", "--brand", "acme", "--json");
  assert.equal(r.status, 0, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.equal(d.variable, false);
  assert.deepEqual(d.weights, [400, 500]);
  assert.deepEqual(d.files, ["brands/acme/assets/fonts/IBMPlexMono-400.woff2", "brands/acme/assets/fonts/IBMPlexMono-500.woff2"]);
  for (const f of d.files) assert.ok(existsSync(path.join(ws, f)));
  assert.ok(existsSync(inBrand("assets/fonts/OFL-IBMPlexMono.txt")));
  const tokens = await tokensOf();
  assert.ok(tokens.includes('@font-face { font-family: "IBM Plex Mono"; font-weight: 500; font-display: block; src: url("./assets/fonts/IBMPlexMono-500.woff2") format("woff2"); }'));
  assert.match(tokens, /--font-mono:\s+"IBM Plex Mono", ui-monospace, monospace;/);
  assert.equal(d.tokensBackup, `brands/acme/history/${today}/tokens-2.css`, "an earlier backup of the day is not overwritten");
});

test("a weight the family does not have is refused and nothing is written", { skip: !NET }, async () => {
  const tokens = await tokensOf(), files = await readdir(inBrand("assets/fonts"));
  const r = fonts("add", "IBM Plex Mono", "--role", "body", "--weights", "400,800", "--apply", "--brand", "acme");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^✗ IBM Plex Mono has no weight 800\. Available: 100, 200, 300, 400, 500, 600, 700\.\n$/);
  assert.equal(r.stdout, "");
  assert.equal(await tokensOf(), tokens);
  assert.deepEqual(await readdir(inBrand("assets/fonts")), files);
});

test("an unknown family suggests the closest ones", { skip: !NET }, () => {
  const r = fonts("add", "Fraunce", "--role", "display", "--brand", "acme");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^✗ "Fraunce" is not on Fontsource\. Closest: Fraunces \(fraunces\)/);
});

test("brand check: the installed fonts really load in the browser", { skip: !NET }, () => {
  const r = cli("brand", "check", "--brand", "acme");
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /display\s+Fraunces\s+✓ loads/);
  assert.match(r.stdout, /mono\s+IBM Plex Mono\s+✓ loads/);
  const list = JSON.parse(fonts("list", "--brand", "acme", "--json").stdout);
  assert.equal(list.roles.display.family, "Fraunces");
  assert.deepEqual(list.missing, []);
});
