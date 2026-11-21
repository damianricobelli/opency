#!/usr/bin/env node
// First-run setup in four short chapters: brand → identity → goal → first piece.
// Every answer is saved as it arrives, so the setup can stop anywhere and pick up where it was.
//
//   npx @opency/cli start                                  where the setup stands and what comes next (same as `onboard status`)
//   npx @opency/cli onboard status [--json]
//   npx @opency/cli onboard begin "<Brand name>" [--what "…"] [--url site.com] [--frequency "…"] [--language es]
//   npx @opency/cli onboard set [--what …] [--frequency …] [--objective …] [--audience …] [--offer …] [--url …] [--handle @x] [--country AR]
//   npx @opency/cli onboard presets [--json]               the house identities to start from
//   npx @opency/cli onboard identity --from-site [url] | --preset <id> | --colors '{"primary":"#…",…}'
//                                    [--fonts "display=Fraunces,body=Inter,mono=JetBrains Mono"] [--confirmed] [--json]
//   npx @opency/cli onboard board [--json]                 renders the brand board: palette, contrast, type, logo and sample slides
//   npx @opency/cli onboard ideas [--json]                 three first pieces that fit the brand's objective, as intent skeletons
//   All of them: --brand <slug>.
//
// `identity` always passes the palette through the contrast repair, backs tokens.css up to history/<date>/,
// installs open-licensed typefaces by name and saves the site's logo for the surface it reads on.
// On a brand that already has pieces it needs --confirmed: changing the identity changes how the next ones look.

import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile, readdir, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { ROOT, BRANDS, parseArgs, readJSON, writeJSON, resolveBrand, brandDir, loadBrand, listBrands, slugify, today, launchBrowser, ensureWorkspace } from "./lib/project.mjs";
import { PRESETS, findPreset, repair, proposeFromImport, applyColors, readColors, contrast, ROLES } from "./lib/identity.mjs";
import { briefIn, optionIndex, suggestionsFor } from "./lib/brief.mjs";

ensureWorkspace();
const args = parseArgs(process.argv.slice(2));
for (const flag of ["json", "confirmed", "from-site"]) if (typeof args[flag] === "string" && flag !== "from-site") { args._.push(args[flag]); args[flag] = true; }
const [cmd = "status", target] = args._;
const here = path.dirname(fileURLToPath(import.meta.url));
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const out = (data, text) => console.log(args.json ? JSON.stringify(data, null, 2) : text);
const run = (script, argv, timeout = 180000) => spawnSync(process.execPath, [path.join(here, script), ...argv.map(String)], { encoding: "utf8", timeout, env: { ...process.env, OPENCY_HOME: ROOT } });
const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function brandOrNull() {
  if (typeof args.brand === "string") return existsSync(brandDir(args.brand)) ? args.brand : fail(`Brand "${args.brand}" does not exist.`);
  try { return await resolveBrand(args); } catch { return null; }
}
const brandFile = (slug) => path.join(brandDir(slug), "brand.json");
const hasPieces = async (slug) => (await readdir(path.join(brandDir(slug), "pieces"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory());

// ---------- Status ----------
async function status(slug) {
  const lang = str(args.lang) ?? "en";
  const copy = briefIn("start", lang);
  const chapter = (id, done, have, missing, next) => ({ id, title: id === "piece" ? "Your first piece" : copy.chapters[id], done, have, missing, ...(done ? {} : { next }) });
  if (!slug || slug.startsWith("_")) {
    const others = await listBrands();
    return {
      brand: null, brands: others, complete: false, progress: "0 of 4",
      chapters: [chapter("brand", false, {}, ["name"], { tool: "onboarding_start", how: "Ask for the brand's name (and its website, if it has one), then call onboarding_start with them. CLI: opency onboard begin \"<Name>\" --url site.com" }), chapter("identity", false, {}, ["identity"]), chapter("goal", false, {}, ["objective", "audience"]), chapter("piece", false, {}, ["first piece"])],
      next: { chapter: "brand", say: "Ask what the brand is called and whether it has a website. Two fields, nothing else yet." },
    };
  }
  const b = (await readJSON(brandFile(slug), {})) ?? {};
  const loaded = !!b.name && !/\{\{/.test(b.name);
  const tokens = await readFile(path.join(brandDir(slug), "tokens.css"), "utf8").catch(() => "");
  const demo = await readFile(path.join(brandDir("_demo"), "tokens.css"), "utf8").catch(() => "");
  const custom = JSON.stringify(readColors(tokens)) !== JSON.stringify(readColors(demo));
  const identityDone = !!b.identity?.source || custom;
  const pieces = await hasPieces(slug);
  const rendered = pieces.filter((d) => existsSync(path.join(brandDir(slug), "pieces", d.name, "render/report.json")));
  const goals = b.goals ?? {};
  const oi = optionIndex("start", "objective", goals.objective);
  const chapters = [
    chapter("brand", loaded, { name: b.name, what: b.profile?.what ?? null, url: b.profile?.url ?? null, frequency: b.profile?.frequency ?? null }, loaded ? [] : ["name"],
      { tool: "onboarding_start", how: "Ask for the brand's name and call onboarding_start." }),
    chapter("identity", identityDone, { source: b.identity?.source ?? (custom ? "set by hand" : null), colors: readColors(tokens), logos: Object.keys(b.logos ?? {}) }, identityDone ? [] : ["identity"],
      { tool: "brand_identity", how: b.profile?.url ? `Call brand_identity with source="website" (it reads ${b.profile.url}), show the board it returns and ask if it looks like the brand.` : "Ask: read it from a website, start from a preset (brand_presets shows them), or give colors and typefaces. Then call brand_identity and show the board it returns.", options: copy.questions.find((q) => q.id === "identity").options }),
    chapter("goal", !!goals.objective && !!goals.audience, { objective: goals.objective ?? null, audience: goals.audience ?? null, offer: goals.offer ?? null }, [!goals.objective && "objective", !goals.audience && "audience"].filter(Boolean),
      { tool: "onboarding_start", how: "Ask the objective as a choice, then the audience with the suggestions for that objective, then (optional) what to tell or sell first. Save with onboarding_start.",
        ask: { objective: { question: copy.questions.find((q) => q.id === "objective").ask, options: copy.questions.find((q) => q.id === "objective").options }, audience: { question: copy.questions.find((q) => q.id === "audience").ask, suggestions: suggestionsFor("start", "audience", oi, lang) }, offer: { question: copy.questions.find((q) => q.id === "offer").ask, suggestions: suggestionsFor("start", "offer", oi, lang) } } }),
    chapter("piece", rendered.length > 0, { pieces: pieces.length, rendered: rendered.length }, rendered.length ? [] : ["first piece"],
      { tool: "piece_ideas", how: "Call piece_ideas, offer the three ideas in one line each, and design the one the user picks with piece_design. Ask only for the facts that idea needs." }),
  ];
  const done = chapters.filter((c) => c.done).length, open = chapters.find((c) => !c.done);
  return {
    brand: slug, name: b.name ?? null, complete: !open, progress: `${done} of 4`, chapters,
    next: open ? { chapter: open.id, title: open.title, ...open.next } : { say: "Setup is complete. Offer the next piece or a weekly plan (campaign_create, piece_design)." },
  };
}
const statusText = (s) => [
  s.brand ? `Setup of ${s.name ?? s.brand} · ${s.progress}` : `No brand yet · ${s.progress}`,
  ...s.chapters.map((c, i) => `  ${c.done ? "✓" : "·"} ${i + 1}. ${c.title}${c.missing.length ? `  (missing: ${c.missing.join(", ")})` : ""}`),
  s.next.how ? `→ Next: ${s.next.title}. ${s.next.how}` : `→ ${s.next.say}`,
].join("\n");

// ---------- Brand board ----------
async function board(slug) {
  const dir = brandDir(slug), b = (await readJSON(brandFile(slug), {})) ?? {};
  const tokens = await readFile(path.join(dir, "tokens.css"), "utf8");
  const c = readColors(tokens);
  // On the dark surfaces the accent is --accent-inverse when the brand defines one.
  const inverse = tokens.match(/^[ \t]*--accent-inverse:\s*(#[0-9a-fA-F]{6})/m)?.[1];
  if (inverse) c["accent-inverse"] = inverse.toUpperCase();
  const ok = (fg, bg) => (c[fg] && c[bg] ? contrast(c[fg], c[bg]) : null);
  const pairs = [["ink", "bg"], ["ink", "bg-alt"], ["ink-inverse", "primary"], ["ink-inverse", "secondary"], ["accent", "bg"], [inverse ? "accent-inverse" : "accent", "primary"]].map(([fg, bg]) => ({ fg, bg, ratio: ok(fg, bg) })).filter((p) => p.ratio);
  const fam = (role) => tokens.match(new RegExp(`--font-${role}:\\s*"?([^",;]+)`))?.[1]?.trim() ?? "—";
  const logo = (surface) => { const f = surface === "dark" ? (b.logos?.onPrimary ?? b.logos?.onDark) : b.logos?.onLight; return f ? `<img class="logo" src="../${escapeHtml(f)}" alt="">` : `<span>${escapeHtml(b.handle || b.name || slug)}</span>`; };
  const what = str(b.profile?.what);
  const slide = (surface, inner, tone) => `<div class="mini"><main class="canvas ${surface}"${b.defaults?.texture ? ` data-texture="${b.defaults.texture}"` : ""}><div class="safe"><div class="content" style="justify-content:space-between">${inner}</div><footer class="chrome-bar">${logo(tone)}<span>01/05</span></footer></div></main></div>`;
  const html = `<!doctype html><html lang="${escapeHtml(b.language ?? "en")}" data-format="4:5"><head><meta charset="utf-8"><title>${escapeHtml(b.name ?? slug)} · brand board</title>
<link rel="stylesheet" href="../tokens.css"><link rel="stylesheet" href="../../../templates/base/base.css">
<style>
  body { width: 1800px; height: 1120px; background: #EDEBE7; color: #16161A; padding: 56px; display: grid; grid-template-columns: 640px 1fr; gap: 48px; font-family: var(--font-body); overflow: hidden; }
  .left { display: grid; align-content: space-between; gap: 28px; }
  .tag { font-family: var(--font-mono); font-size: 15px; letter-spacing: .12em; text-transform: uppercase; color: #6B6B72; }
  h1 { font-family: var(--font-display); font-weight: var(--weight-display); letter-spacing: var(--tracking-display); font-size: 76px; line-height: 1; margin: 10px 0 0; }
  .what { font-size: 22px; line-height: 1.35; color: #44444B; margin-top: 14px; max-width: 30ch; }
  .swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .sw { border-radius: 14px; height: 108px; padding: 12px 14px; display: flex; flex-direction: column; justify-content: flex-end; font-family: var(--font-mono); font-size: 13px; letter-spacing: .04em; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .08); }
  .sw b { font-weight: 500; text-transform: uppercase; letter-spacing: .1em; font-size: 12px; opacity: .8; }
  .pairs { display: flex; flex-wrap: wrap; gap: 8px; }
  .pair { font-family: var(--font-mono); font-size: 13px; padding: 7px 11px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .1); }
  .pair.bad { background: #FFE9E4; box-shadow: inset 0 0 0 1px #E0624A; }
  .type { display: grid; gap: 14px; background: #fff; border-radius: 18px; padding: 24px 26px; }
  .type .d { font-family: var(--font-display); font-weight: var(--weight-display); letter-spacing: var(--tracking-display); font-size: 46px; line-height: 1.02; }
  .type .b { font-family: var(--font-body); font-size: 19px; line-height: 1.4; color: #33333A; }
  .type .m { font-family: var(--font-mono); font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: #55555C; }
  .type small { font-family: var(--font-mono); font-size: 12px; color: #8A8A92; letter-spacing: .06em; }
  .right { display: flex; gap: 18px; align-items: center; }
  .mini { flex: none; width: 320px; height: 400px; border-radius: 18px; overflow: hidden; box-shadow: 0 30px 60px -30px rgb(0 0 0 / .35); }
  .mini > .canvas { width: 1080px; height: 1350px; transform: scale(.2963); transform-origin: 0 0; }
  .mini .content { position: absolute; }
</style></head><body>
<section class="left">
  <div><p class="tag">Brand board · ${escapeHtml(b.identity?.source ? `identity from ${b.identity.source}` : "identity")}</p><h1>${escapeHtml(b.name ?? slug)}</h1>${what ? `<p class="what">${escapeHtml(what)}</p>` : ""}</div>
  <div class="swatches">${ROLES.map((r) => { const bg = c[r] ?? "#ccc"; const fg = contrast("#FFFFFF", bg) > contrast("#111111", bg) ? "#FFFFFF" : "#111111"; return `<div class="sw" style="background:${bg};color:${fg}"><b>${r}</b>${bg}</div>`; }).join("")}</div>
  <div class="pairs">${pairs.map((p) => `<span class="pair${p.ratio < (p.fg.startsWith("accent") ? 3 : 4.5) ? " bad" : ""}">${p.fg} on ${p.bg} · ${p.ratio.toFixed(1)}:1 ${p.ratio >= 4.5 ? "✓" : p.ratio >= 3 ? "△ large only" : "✗"}</span>`).join("")}</div>
  <div class="type"><p class="d">${escapeHtml(b.name ?? "Brand")} Aa Bb 123</p><small>display · ${escapeHtml(fam("display"))}</small><p class="b">${escapeHtml(what ?? "Body text sets the pace of every slide: short lines, one idea each.")}</p><small>body · ${escapeHtml(fam("body"))}</small><p class="m">Labels · dates · sources</p><small>mono · ${escapeHtml(fam("mono"))}</small></div>
</section>
<section class="right">
  ${slide("on-primary", `<p class="label muted">${escapeHtml(b.handle || b.profile?.url || "Cover")}</p><div><div class="rule" style="margin-bottom:44px"></div><h2 class="t-cover" style="max-width:9ch">${escapeHtml(b.name ?? slug)}</h2></div>`, "dark")}
  ${slide("on-bg", `<p class="label muted">Statement</p><div><h2 class="t-title" style="max-width:14ch">${escapeHtml(what && what.length <= 70 ? what : "One idea per piece, said in one line.")}</h2><p class="t-intro muted" style="margin-top:30px;max-width:24ch">Supporting line in the body typeface.</p></div>`, "light")}
  ${slide("on-secondary", `<div class="corners"><span class="label">Type</span><span class="label">No. 01</span></div><h2 class="t-hero">Aa</h2><p class="t-intro">${escapeHtml(fam("display"))} · ${escapeHtml(fam("body"))}</p>`, "dark")}
</section></body></html>`;
  const bdir = path.join(dir, "board");
  await mkdir(bdir, { recursive: true });
  await writeFile(path.join(bdir, "board.html"), html);
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1800, height: 1120 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(bdir, "board.html")).href, { waitUntil: "networkidle" });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: path.join(bdir, "board.png") });
  await browser.close();
  return { file: path.relative(ROOT, path.join(bdir, "board.png")), colors: c, fonts: { display: fam("display"), body: fam("body"), mono: fam("mono") }, contrast: pairs.map((p) => ({ ...p, ratio: Number(p.ratio.toFixed(2)) })) };
}

// ---------- Identity ----------
async function saveLogo(slug, rel) {
  const dir = brandDir(slug), src = path.join(dir, rel);
  if (!existsSync(src)) return null;
  const ext = path.extname(src).toLowerCase(), dest = path.join(dir, "assets/logos", `logo${ext}`);
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest);
  // Which surface does it read on? The mean brightness of its opaque pixels decides.
  let tone = "dark";
  try {
    const { data, info } = await sharp(src, { density: 200 }).resize(200, 200, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let sum = 0, n = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] > 40) { sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; n++; }
    if (n) tone = sum / n / 255 > 0.6 ? "light" : "dark";
  } catch { /* unreadable: assume a dark logo */ }
  return { file: `assets/logos/logo${ext}`, slot: tone === "dark" ? "onLight" : "onDark" };
}

async function identity(slug) {
  const dir = brandDir(slug), b = (await readJSON(brandFile(slug), {})) ?? {};
  if ((await hasPieces(slug)).length && !args.confirmed) fail(`${slug} already has pieces made with its identity. Show the change to the user and run again with --confirmed.`);
  const notes = [];
  let plan, source, fonts = {}, extra = {}, texture, logo = null;
  if (args.preset) {
    const p = findPreset(args.preset);
    if (!p) fail(`Unknown preset "${args.preset}". Presets: ${PRESETS.map((x) => x.id).join(", ")}`);
    plan = repair(p.colors); source = `preset:${p.id}`; fonts = { ...p.fonts }; texture = p.texture;
    extra = { radius: p.radius, "weight-display": p.weights.display, "weight-title": p.weights.title, "tracking-display": p.tracking.display, "tracking-title": p.tracking.title };
  } else if (args["from-site"]) {
    const url = str(args["from-site"]) ?? b.profile?.url;
    if (!url) fail("No website to read: pass --from-site <url>.");
    const r = run("brand.mjs", ["import", url, "--brand", slug]);
    if (r.status !== 0) fail((r.stderr || r.stdout).replace(/^✗ /, "").trim());
    const report = await readJSON(path.join(dir, "import/report.json"), null);
    if (!report) fail("The website was opened but nothing could be read from it.");
    plan = proposeFromImport(report); source = `website:${new URL(report.url).host}`;
    fonts = Object.fromEntries(Object.entries(plan.fonts).filter(([, v]) => v));
    if (plan.displayWeight) extra["weight-display"] = Math.min(900, Math.max(400, plan.displayWeight));
    if (plan.radius && /^\d+(\.\d+)?px$/.test(plan.radius)) extra.radius = `${Math.min(40, Math.round(parseFloat(plan.radius) * 1.6))}px`;
    for (const [role, where] of Object.entries(plan.sources)) notes.push(`${role}: ${where}`);
    if (plan.logo) logo = await saveLogo(slug, plan.logo);
    b.profile = { ...b.profile, url: b.profile?.url ?? url };
    if (!b.profile.what && report.description) { b.profile.what = report.description.slice(0, 200); notes.push("what it does: taken from the site's description (confirm it with the user)"); }
    if (report.lang && (!b.language || b.language === "en")) b.language = report.lang.slice(0, 2).toLowerCase();
    const ig = (report.social ?? []).find((h) => /instagram\.com\/[^/?#]+/.test(h));
    if (ig && !b.handle) b.handle = "@" + ig.match(/instagram\.com\/([^/?#]+)/)[1];
  } else if (args.colors) {
    let given; try { given = JSON.parse(args.colors); } catch { fail("--colors must be JSON: {\"primary\":\"#…\",\"accent\":\"#…\",\"bg\":\"#…\",\"ink\":\"#…\"}"); }
    const unknown = Object.keys(given).filter((k) => !ROLES.includes(k));
    if (unknown.length) fail(`Unknown role(s): ${unknown.join(", ")}. Roles: ${ROLES.join(", ")}`);
    plan = repair({ ...readColors(await readFile(path.join(dir, "tokens.css"), "utf8")), ...given }); source = "manual";
  } else fail("Say where the identity comes from: --from-site [url], --preset <id> or --colors '{…}'.");
  if (typeof args.fonts === "string") for (const part of args.fonts.split(",")) { const [role, fam] = part.split("=").map((x) => x.trim()); if (["display", "body", "mono"].includes(role) && fam) fonts[role] = fam; }
  notes.push(...plan.notes.map((n) => `contrast repair — ${n}`));

  // tokens.css: back up, then write colors and shape; typefaces are patched by `fonts add --apply`.
  const tokensPath = path.join(dir, "tokens.css");
  const before = await readFile(tokensPath, "utf8");
  const hist = path.join(dir, "history", today());
  await mkdir(hist, { recursive: true });
  if (!existsSync(path.join(hist, "tokens.css"))) await writeFile(path.join(hist, "tokens.css"), before);
  await writeFile(tokensPath, applyColors(before, plan.colors, plan.derived, extra));
  const installed = {};
  for (const [role, family] of Object.entries(fonts)) {
    const r = run("fonts.mjs", ["add", family, "--role", role, "--apply", "--json", "--brand", slug], 120000);
    if (r.status === 0) installed[role] = family;
    else notes.push(`typeface ${family} (${role}) was not installed: ${(r.stderr || r.stdout).replace(/^✗ /, "").trim().split(". ")[0].replace(/\.$/, "").slice(0, 120)}. The current ${role} typeface stays; a commercial family arrives as .woff2 files.`);
  }
  b.identity = { source, setAt: today(), fonts: installed };
  if (texture) b.defaults = { ...b.defaults, texture };
  if (logo) { b.logos = { ...b.logos, [logo.slot]: logo.file }; notes.push(`logo saved for ${logo.slot === "onLight" ? "light" : "dark"} surfaces; the other surfaces show the brand's name until a second version arrives`); }
  await writeJSON(brandFile(slug), b);
  const made = await board(slug);
  return { brand: slug, source, colors: plan.colors, derived: plan.derived, accentAsText: plan.accentAsText, fonts: installed, logo, notes, board: made.file, contrast: made.contrast,
    next: "Show the board to the user and ask whether it looks like the brand. To change one thing: identity --colors '{\"accent\":\"#…\"}' or --fonts \"display=…\"." };
}

// ---------- First-piece ideas ----------
const IDEAS = [
  [ // Generate more sales
    { id: "offer", title: "The offer, in five slides", why: "Sells one thing by answering the question a buyer actually has.", format: "4:5 carousel", needs: ["what is being sold and how to get it", "one fact that proves it (a result, a number, a real quote)"],
      slides: [{ role: "hook", hint: "the problem the buyer recognizes, in under 8 words" }, { role: "context", hint: "why it keeps happening" }, { role: "proof", proof: "number | quote", hint: "one real fact with its source" }, { role: "how", proof: "steps", hint: "how buying or booking works, 3 steps" }, { role: "close", hint: "one action that names its object" }] },
    { id: "before-after", title: "Before and after", why: "Shows the change instead of promising it.", format: "4:5 carousel", needs: ["three things that are true before", "three things that are true after"],
      slides: [{ role: "hook", hint: "the situation today" }, { role: "compare", proof: "comparison", hint: "three points per side, 2 to 4 words each" }, { role: "close", hint: "the first step" }] },
    { id: "one-line-offer", title: "One poster", why: "A single slide for a single offer: the fastest thing to publish.", format: "4:5 post", needs: ["the offer in one short line"], slides: [{ role: "hook", hint: "the offer, 26 characters or fewer, with two corner labels (what, until when)" }] },
  ],
  [ // Show what I know
    { id: "method", title: "Your method, step by step", why: "Teaching is what gets saved and shared.", format: "4:5 carousel", needs: ["a method you actually use, in 3 or 4 steps"],
      slides: [{ role: "hook", hint: "the result the method gives" }, { role: "context", hint: "the mistake most people make" }, { role: "how", proof: "steps", hint: "the steps, one line each" }, { role: "point", hint: "the one thing to remember" }, { role: "close", hint: "save it, or ask for the template" }] },
    { id: "opinion", title: "An opinion you can defend", why: "A clear position is what makes a profile worth following.", format: "4:5 carousel", needs: ["something you believe that your field gets wrong"],
      slides: [{ role: "hook", hint: "the opinion as a poster line" }, { role: "context", hint: "what everyone does instead" }, { role: "point", hint: "why it does not work" }, { role: "close", hint: "what to do instead, and an invitation to disagree" }] },
    { id: "definition", title: "A word you own", why: "Naming an idea makes it yours.", format: "4:5 post", needs: ["a term from your field and your own one-line meaning for it"], slides: [{ role: "hook", proof: "definition", hint: "term, pronunciation or origin, your meaning" }] },
  ],
  [ // Present something new
    { id: "announcement", title: "The announcement", why: "What it is, who it is for and what to do, in that order.", format: "4:5 carousel", needs: ["what is new, in one line", "the date or availability", "how to get it"],
      slides: [{ role: "hook", hint: "what is new, as a poster, with the date in a corner label" }, { role: "point", hint: "who it is for and what changes for them" }, { role: "how", proof: "steps", hint: "how to get it" }, { role: "close", hint: "one action" }] },
    { id: "show-it", title: "Show it working", why: "A product is believed when it is seen.", format: "4:5 carousel", needs: ["a real screen, conversation or list from the product"],
      slides: [{ role: "hook", hint: "what it lets you do" }, { role: "proof", proof: "chat | window | prompt", hint: "the product itself: a conversation, a screen with real rows, or the request a user types" }, { role: "close", hint: "try it" }] },
    { id: "event", title: "The event poster", why: "Day, time and place, readable in a second.", format: "4:5 post", needs: ["name, day, date, time and place", "a photo of your own"], slides: [{ role: "hook", proof: "event", hint: "needs a photo with its analysis done" }] },
  ],
  [ // Build community
    { id: "story", title: "A story from the inside", why: "People follow people, not announcements.", format: "4:5 carousel", needs: ["something that actually happened", "ideally a photo of your own"],
      slides: [{ role: "hook", hint: "the moment, not the moral" }, { role: "context", hint: "what was at stake" }, { role: "point", hint: "what changed" }, { role: "close", hint: "a question for the reader" }] },
    { id: "roundup", title: "This week, in four cards", why: "A recurring format gives people a reason to come back.", format: "4:5 post", needs: ["four things that happened, one line each"], slides: [{ role: "hook", proof: "cards", hint: "four items with a tag each, and the issue number as kicker" }] },
    { id: "question", title: "One question", why: "The simplest way to start a conversation.", format: "4:5 post", needs: ["a question your audience has an opinion on"], slides: [{ role: "hook", hint: "the question as a poster line" }] },
  ],
];
async function ideas(slug) {
  const b = (await readJSON(brandFile(slug), {})) ?? {};
  const oi = optionIndex("start", "objective", b.goals?.objective);
  const list = IDEAS[oi >= 0 && oi < IDEAS.length ? oi : 1];
  return {
    brand: slug, objective: b.goals?.objective ?? null, audience: b.goals?.audience ?? null, offer: b.goals?.offer ?? null,
    ideas: list,
    how: "Offer the three in one line each, in the user's language. For the one they pick, ask ONLY for what `needs` lists and they have not told you, write the copy in the brand's voice and call piece_design with one slide per entry (role, claim, and the proof named). Never invent the facts a slide needs.",
  };
}

// ---------- Commands ----------
try {
  if (cmd === "status") {
    const s = await status(await brandOrNull());
    out(s, statusText(s));
  } else if (cmd === "begin") {
    const name = str(target) ?? str(args.name);
    if (!name) fail('Usage: npx @opency/cli onboard begin "<Brand name>" [--url site.com] [--what "…"]');
    let slug = slugify(name).slice(0, 40) || "brand";
    if (existsSync(brandDir(slug))) fail(`brands/${slug} already exists. Continue with: npx @opency/cli onboard status --brand ${slug}`);
    const r = run("brand.mjs", ["new", slug, "--name", name]);
    if (r.status !== 0) fail((r.stderr || r.stdout).replace(/^✗ /, "").trim());
    await writeFile(path.join(BRANDS, ".active"), slug + "\n");
    const b = await readJSON(brandFile(slug));
    b.profile = { what: str(args.what), url: str(args.url), frequency: str(args.frequency) };
    if (str(args.language)) b.language = args.language.slice(0, 2).toLowerCase();
    b.onboarding = { startedAt: today() };
    await writeJSON(brandFile(slug), b);
    const s = await status(slug);
    out(s, `✓ brands/${slug} created and set as the active brand\n${statusText(s)}`);
  } else if (cmd === "set") {
    const slug = await brandOrNull(); if (!slug || slug.startsWith("_")) fail('No brand yet. Start with: npx @opency/cli onboard begin "<Brand name>"');
    const b = (await readJSON(brandFile(slug), {})) ?? {};
    for (const k of ["what", "url", "frequency"]) if (str(args[k])) b.profile = { ...b.profile, [k]: str(args[k]) };
    for (const k of ["objective", "audience", "offer"]) if (str(args[k])) b.goals = { ...b.goals, [k]: str(args[k]) };
    for (const k of ["handle", "country", "language", "name"]) if (str(args[k])) b[k] = k === "language" ? args[k].slice(0, 2).toLowerCase() : str(args[k]);
    await writeJSON(brandFile(slug), b);
    const s = await status(slug);
    out(s, `✓ saved\n${statusText(s)}`);
  } else if (cmd === "presets") {
    const rows = PRESETS.map((p) => ({ id: p.id, name: p.name, mood: p.mood, colors: p.colors, fonts: p.fonts, texture: p.texture }));
    out({ presets: rows, how: "Describe two or three that fit what the brand does, in a line each, and let the user choose. Apply with brand_identity source=\"preset\"." }, rows.map((p) => `${p.id.padEnd(10)} ${p.name} — ${p.mood}\n${"".padEnd(11)}${Object.values(p.colors).join(" ")} · ${p.fonts.display} / ${p.fonts.body}`).join("\n"));
  } else if (cmd === "identity") {
    const slug = await brandOrNull(); if (!slug || slug.startsWith("_")) fail('No brand yet. Start with: npx @opency/cli onboard begin "<Brand name>"');
    const r = await identity(slug);
    out(r, [`✓ identity of ${slug} from ${r.source}`, `  ${Object.entries(r.colors).map(([k, v]) => `${k} ${v}`).join(" · ")}`, Object.keys(r.fonts).length ? `  typefaces: ${Object.entries(r.fonts).map(([k, v]) => `${k} ${v}`).join(" · ")}` : null, ...r.notes.map((n) => `  · ${n}`), `→ ${r.board}`, `  ${r.next}`].filter(Boolean).join("\n"));
  } else if (cmd === "board") {
    const slug = await brandOrNull(); if (!slug) fail("No brand yet.");
    const r = await board(slug);
    out(r, `✓ ${r.file}`);
  } else if (cmd === "ideas") {
    const slug = await brandOrNull(); if (!slug || slug.startsWith("_")) fail('No brand yet. Start with: npx @opency/cli onboard begin "<Brand name>"');
    const r = await ideas(slug);
    out(r, r.ideas.map((i, n) => `${n + 1}. ${i.title} (${i.format}) — ${i.why}\n   ${i.slides.map((s) => `${s.role}${s.proof ? `[${s.proof}]` : ""}`).join(" → ")}\n   needs: ${i.needs.join("; ")}`).join("\n"));
  } else {
    console.log((await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  }
} catch (e) { fail(e.message); }
