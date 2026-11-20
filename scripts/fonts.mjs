#!/usr/bin/env node
// Brand typefaces by name: finds an open-licensed family on Fontsource, downloads its .woff2 into the brand
// and writes (or prints) the @font-face rules, so nobody has to hunt for font files.
//
//   npx @opency/cli fonts search "<query>" [--json]
//   npx @opency/cli fonts add "<Family or id>" --role display|body|mono [--weights 400,700] [--italic]
//                                              [--subset latin] [--apply] [--brand slug] [--json]
//   npx @opency/cli fonts list [--brand slug] [--json]
//
// `add` prefers ONE variable file when the family has a weight axis and no --weights were asked for; otherwise
// one file per weight (400 and 700 by default, or the closest the family has). A weight, italic or subset the
// family does not publish is refused: nothing synthetic is ever installed as if it were the original.
// Without --apply it only writes assets/fonts/ and prints what to add to tokens.css. With --apply it backs
// tokens.css up to history/<date>/ and patches the family's @font-face rules and --font-<role>, nothing else.
// Commercial typefaces are not on Fontsource: those still arrive as .woff2 files from the brand.

import { mkdir, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ROOT, parseArgs, resolveBrand, brandDir, readJSON, writeJSON, today } from "./lib/project.mjs";
import { ROLES, searchFonts, resolveFont, parseWeights, planFiles, downloadFiles, fetchLicense, licenseFileName, fontFaceCss, patchTokens, fontStack, readVar, weightWarnings, describeTokens } from "./lib/fonts.mjs";

const args = parseArgs(process.argv.slice(2));
// Boolean flags never take a value: `add --apply Inter` keeps "Inter" as the family.
for (const flag of ["json", "apply", "italic"]) if (typeof args[flag] === "string") { args._.push(args[flag]); args[flag] = true; }
const [cmd, ...rest] = args._;
const fail = (m) => { console.error(`✗ ${String(m).replace(/\s*\n\s*/g, " ")}`); process.exit(1); };
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const kb = (n) => `${Math.max(1, Math.round(n / 1024))} KB`;
const weightsLabel = (f) => f.weights.length > 2 ? `${f.weights[0]}–${f.weights[f.weights.length - 1]}` : f.weights.join(", ");

/** Where to save a backup without overwriting a different one made earlier the same day. */
async function backupPath(dir, content) {
  const folder = path.join(dir, "history", today());
  for (let i = 1; ; i++) {
    const file = path.join(folder, i === 1 ? "tokens.css" : `tokens-${i}.css`);
    if (!existsSync(file) || (await readFile(file, "utf8")) === content) return file;
  }
}

try {
  if (cmd === "search") {
    const query = rest.join(" ").trim();
    if (!query) fail('Usage: npx @opency/cli fonts search "<query>" [--json]');
    const results = await searchFonts(query, { limit: 12, fuzzy: true });
    if (args.json) console.log(JSON.stringify(results, null, 2));
    else if (!results.length) console.log(`No family matches "${query}" on Fontsource.`);
    else for (const f of results) console.log(`${f.family.padEnd(28)} ${f.id.padEnd(28)} ${f.category.padEnd(12)} ${weightsLabel(f).padEnd(10)} ${(f.variable ? "variable" : "static").padEnd(9)} ${f.license}`);

  } else if (cmd === "add") {
    const name = rest.join(" ").trim();
    if (!name) fail('Usage: npx @opency/cli fonts add "<Family or id>" --role display|body|mono [--weights 400,700] [--italic] [--subset latin] [--apply] [--brand slug]');
    if (!ROLES.includes(args.role)) fail(`--role must be one of ${ROLES.join(", ")}.`);
    const weights = parseWeights(args.weights);
    if (args.subset === true) fail("--subset needs a value, e.g. --subset latin or --subset latin,latin-ext");
    const subsets = [...new Set(String(args.subset ?? "latin").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))];
    if (!subsets.length) fail("--subset needs a value, e.g. --subset latin");

    const slug = await resolveBrand(args), dir = brandDir(slug);
    if (slug.startsWith("_") && process.env.OPENCY_ALLOW_DEMO_WRITE !== "1") fail(`brands/${slug} is a demo brand and is not modified. Use --brand <slug> with a brand of your own.`);
    const tokensFile = path.join(dir, "tokens.css");
    const tokens = existsSync(tokensFile) ? await readFile(tokensFile, "utf8") : null;
    if (args.apply && tokens === null) fail(`brands/${slug}/tokens.css does not exist: nothing to apply to.`);

    // Everything is resolved and downloaded before the first write: a refused weight leaves the brand untouched.
    const { font, axes } = await resolveFont(name);
    const plan = planFiles(font, axes, { weights, italic: !!args.italic, subsets });
    const [files, licenseText] = await Promise.all([downloadFiles(plan.files), fetchLicense(font)]);

    const fontsDir = path.join(dir, "assets/fonts");
    await mkdir(fontsDir, { recursive: true });
    for (const f of files) await writeFile(path.join(fontsDir, f.file), f.buf);
    let licenseFile = null;
    if (licenseText) {
      licenseFile = path.join(fontsDir, licenseFileName(font));
      await writeFile(licenseFile, licenseText);
    } else {
      // No license text available: keep at least its name and where the font comes from.
      licenseFile = path.join(fontsDir, "fonts.json");
      const record = await readJSON(licenseFile, {}) ?? {};
      (record.fonts ??= {})[font.id] = { family: font.family, license: font.license, source: font.source ?? null, page: `https://fontsource.org/fonts/${font.id}`, version: font.npmVersion ?? null, addedAt: today() };
      await writeJSON(licenseFile, record);
    }

    const fontFace = fontFaceCss(font.family, plan.files);
    const cssVariable = `--font-${args.role}`;
    const cssValue = fontStack(tokens ? readVar(tokens, cssVariable)?.value : null, font.family, args.role);
    const warnings = tokens ? weightWarnings(tokens, args.role, plan) : [];

    let applied = false, changed = false, tokensBackup = null;
    if (args.apply) {
      const next = patchTokens(tokens, { family: font.family, fontFace, role: args.role });
      applied = true;
      if (next !== tokens) {
        const backup = await backupPath(dir, tokens);
        await mkdir(path.dirname(backup), { recursive: true });
        await writeFile(backup, tokens);
        await writeFile(tokensFile, next);
        changed = true; tokensBackup = rel(backup);
      }
    }

    const result = {
      family: font.family, id: font.id, role: args.role, files: files.map((f) => rel(path.join(fontsDir, f.file))),
      license: font.license, fontFace, variable: plan.variable, weights: plan.weights, applied, tokensBackup,
      // Beyond the contract: handy for whoever applies the change by hand.
      weightRange: plan.weightRange, subsets, licenseFile: rel(licenseFile), cssVariable, cssValue, changed, warnings,
    };
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`✓ ${font.family} (${font.id}) · ${plan.variable ? `variable ${plan.weightRange.join("–")}` : `weights ${plan.weights.join(", ")}`}${args.italic ? " + italic" : ""} · ${subsets.join(", ")} · ${font.license}`);
      for (const f of files) console.log(`  ${rel(path.join(fontsDir, f.file))}  (${kb(f.buf.length)})`);
      console.log(`  ${rel(licenseFile)}${licenseText ? "" : "  (license text not available: name and source recorded)"}`);
      console.log(`\n${fontFace}\n\n${cssVariable}: ${cssValue};\n`);
      for (const w of warnings) console.log(`! ${w}`);
      if (!applied) console.log(`→ Not applied. Add the rules above to brands/${slug}/tokens.css, or run again with --apply.`);
      else if (changed) console.log(`✓ brands/${slug}/tokens.css updated (backup: ${tokensBackup}). Next: npx @opency/cli brand check --brand ${slug}`);
      else console.log(`✓ brands/${slug}/tokens.css already declares it: nothing to change.`);
    }

  } else if (cmd === "list") {
    const slug = await resolveBrand(args), dir = brandDir(slug), fontsDir = path.join(dir, "assets/fonts");
    const names = (await readdir(fontsDir).catch(() => [])).sort();
    const tokens = existsSync(path.join(dir, "tokens.css")) ? await readFile(path.join(dir, "tokens.css"), "utf8") : "";
    const { families, roles } = describeTokens(tokens);
    const declared = new Map();
    for (const fam of families) for (const face of fam.faces) if (face.src) declared.set(path.basename(face.src), fam.family);
    const files = [];
    for (const n of names.filter((x) => /\.(woff2?|ttf|otf)$/i.test(x))) files.push({ file: n, bytes: (await stat(path.join(fontsDir, n))).size, family: declared.get(n) ?? null });
    for (const fam of families) for (const face of fam.faces) face.exists = !!face.src && existsSync(path.resolve(dir, face.src));
    const missing = families.flatMap((fam) => fam.faces.filter((x) => !x.exists).map((x) => ({ family: fam.family, weight: x.weight, src: x.src })));
    const licenses = names.filter((x) => /\.txt$/i.test(x) || x === "fonts.json");
    const result = { brand: slug, files, families, roles, missing, licenses };
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`Files in brands/${slug}/assets/fonts/:`);
      if (!files.length) console.log("  (none)");
      for (const f of files) console.log(`  ${f.file.padEnd(34)} ${kb(f.bytes).padStart(7)}  ${f.family ? `→ ${f.family}` : "not declared in tokens.css"}`);
      console.log("\nDeclared in tokens.css:");
      if (!families.length) console.log("  (no @font-face rules)");
      for (const fam of families) console.log(`  ${fam.family.padEnd(24)} ${fam.faces.map((x) => `${x.weight}${x.style === "italic" ? "i" : ""}${x.exists ? "" : " ✗"}`).join(", ").padEnd(30)} ${fam.roles.length ? fam.roles.join(", ") : "(no role)"}`);
      console.log("\nRoles:");
      for (const r of ROLES) console.log(`  ${r.padEnd(8)} ${roles[r].family ? `${roles[r].family}${roles[r].declared ? "" : "  ✗ no @font-face for it"}` : "—"}`);
      for (const m of missing) console.log(`✗ ${m.family} ${m.weight}: ${m.src ?? "no src"} does not exist`);
    }

  } else {
    fail('Usage: npx @opency/cli fonts search "<query>" | add "<Family>" --role display|body|mono [--weights 400,700] [--italic] [--subset latin] [--apply] | list   [--brand slug] [--json]');
  }
} catch (e) {
  fail(e.message);
}
