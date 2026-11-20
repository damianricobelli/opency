#!/usr/bin/env node
// opency MCP server (stdio).
//
//   npx opency mcp          ·   claude mcp add opency -- npx -y opency mcp
//
// Exposes the engine (brands, brief, campaigns, stock, pieces, render, feed) as tools, the skill's
// instructions as resources and three starter prompts. Every tool runs the same script as the CLI,
// so MCP and terminal never drift apart.
//
// Nothing here publishes to social networks: opency leaves files ready and the user decides.

import { spawn } from "node:child_process";
import { readFile, writeFile, readdir, mkdir, cp, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sharp from "sharp";
import { PKG, ROOT, BRANDS, hasWorkspace, listBrands, loadBrand, brandDir, readJSON, readText, today } from "../scripts/lib/project.mjs";
import { BRIEFS, briefKinds, nextQuestions, missingAnswers, elicitationSchema } from "../scripts/lib/brief.mjs";
import { fetchBuffer, availableProviders, missingKeys } from "../scripts/lib/stock.mjs";

const VERSION = JSON.parse(await readFile(path.join(PKG, "package.json"), "utf8")).version;
const REFS = path.join(PKG, "skills/opency/references");

// ---------- helpers ----------
const Slug = z.string().regex(/^[a-z0-9_][a-z0-9_-]{0,63}$/, "lowercase letters, numbers and hyphens");
const PieceId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,95}$/, "piece id (YYYY-MM-DD-slug)");
const Brand = Slug.optional().describe("Brand slug. Defaults to the active brand.");
const Format = z.enum(["4:5", "1:1", "9:16", "16:9"]);
const clean = (s) => String(s).replace(/^-+/, "").trim(); // free text is never parsed as a flag

/** Runs an engine script against the current workspace. Never goes through a shell. */
function engine(script, argv, { timeout = 180000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(PKG, "scripts", script), ...argv.map(String)], { cwd: ROOT, env: { ...process.env, OPENCY_HOME: ROOT }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, code, out: out.trim(), err: err.trim() }); });
  });
}
const text = (t) => ({ type: "text", text: typeof t === "string" ? t : JSON.stringify(t, null, 2) });
const isBlock = (p) => p && typeof p === "object" && (p.type === "text" || p.type === "image") && !Array.isArray(p);
const ok = (...parts) => ({ content: parts.filter((p) => p !== null && p !== undefined && p !== false).map((p) => (isBlock(p) ? p : text(p))) });
const bad = (msg) => ({ isError: true, content: [text(msg)] });
const result = (r, ...extra) => (r.ok || r.code === 2 ? ok([r.out, r.err].filter(Boolean).join("\n") || "✓", ...extra) : bad([r.err, r.out].filter(Boolean).join("\n") || `failed (exit code ${r.code})`));
const withBrand = (brand) => (brand ? ["--brand", brand] : []);
const parse = (r) => { try { return JSON.parse(r.out); } catch { return null; } };

async function image(file, maxW = 1600) {
  const buf = await sharp(file).resize({ width: maxW, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  return { type: "image", data: buf.toString("base64"), mimeType: "image/jpeg" };
}
async function activeBrand(brand) {
  if (brand) { if (!existsSync(brandDir(brand))) throw new Error(`Brand "${brand}" does not exist. Brands: ${(await listBrands()).join(", ") || "(none)"}`); return brand; }
  const f = path.join(BRANDS, ".active");
  const a = existsSync(f) ? (await readFile(f, "utf8")).trim() : (await listBrands()).length === 1 ? (await listBrands())[0] : "";
  if (!a) throw new Error(`No active brand. Brands: ${(await listBrands()).join(", ") || "(none: use brand_create)"}`);
  return a;
}
const pieceDir = async (brand, id) => {
  const dir = path.join(brandDir(await activeBrand(brand)), "pieces", id);
  if (!existsSync(path.join(dir, "piece.json"))) throw new Error(`Piece "${id}" does not exist. Use piece_list.`);
  return dir;
};
const guard = (fn) => async (a, extra) => { try { return await fn(a ?? {}, extra); } catch (e) { return bad(e.message); } };
const NEEDS_WS = "This directory is not an opency workspace yet. Call workspace_init (it creates brands/, templates/ and the instructions).";

const server = new McpServer({ name: "opency", version: VERSION }, {
  instructions: `opency turns the agent into the content team of one or more brands: account manager, art director, designer and copywriter.
Order of work: 1) workspace_status. 2) skill_guide (read "core" in full before the first piece). 3) If the brand is not loaded: brief_interview kind=brand and the "onboarding" guide. 4) Before designing a campaign or an ambiguous piece: brief_interview. Nothing gets designed without knowing what it should get across. 5) campaign_plan → piece_create → piece_write → piece_render (look at the contact sheet it returns) → cold review → delivery.
Rules: never make up figures, prices, clients or testimonials; only registered (stock_import / asset_add) and analyzed (asset_analyze) images; get an explicit yes before brand_write on a loaded brand, before deleting, and before sharing anything outside the project. Answer and ask in the user's language; write copy in the brand's language. opency does not publish to social networks: it delivers files.`,
});

const tool = (name, title, description, inputSchema, handler, annotations = {}) =>
  server.registerTool(name, { title, description, inputSchema, annotations: { openWorldHint: false, ...annotations } }, guard(handler));
const RO = { readOnlyHint: true };

// ============================================================ Workspace and guide
tool("workspace_status", "Workspace status", "Starting point of every session: brands, active brand, what each one is missing, open campaigns, available stock providers and render environment.", {}, async () => {
  if (!hasWorkspace()) return ok({ workspace: ROOT, ready: false, next: NEEDS_WS });
  const active = await activeBrand().catch(() => null);
  const brands = [];
  for (const slug of await listBrands()) {
    const b = await loadBrand(slug);
    const cdir = path.join(b.dir, "campaigns");
    const campaigns = (await readdir(cdir, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name);
    const pieces = (await readdir(path.join(b.dir, "pieces"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).length;
    brands.push({ slug, name: b.name, active: slug === active, loaded: b.loaded, language: b.language, pillars: b.pillars.length, verifiedFacts: b.verified.length, hasVoiceSamples: b.voiceSamples.replace(/^#.*$/gm, "").trim().length > 40, campaigns, pieces });
  }
  const next = !brands.length ? 'No brands yet. Start with brief_interview kind="brand", then brand_create.' : brands.some((b) => b.active && !b.loaded) ? "The active brand is not loaded: brief_interview kind=\"brand\" and the onboarding guide." : "Ready. For a campaign: brief_interview kind=\"campaign\".";
  return ok({ workspace: ROOT, ready: true, version: VERSION, activeBrand: active, brands, stock: { available: availableProviders(), missingKeys: missingKeys() }, next });
}, RO);

tool("workspace_init", "Create the workspace", "Creates the agent instructions, the templates and a demo brand in the current directory. Overwrites nothing unless force is set.", { force: z.boolean().optional().describe("Updates instructions and templates even if they exist. Never touches the user's brands.") }, async ({ force }) => result(await engine("init.mjs", [ROOT, ...(force ? ["--force"] : [])])));

tool("doctor", "Check the environment", "Checks render browser, ffmpeg, stock keys and workspace. Use it if piece_render fails.", {}, async () => result(await engine("doctor.mjs", [])), RO);

const TOPICS = { core: null, brief: "brief.md", onboarding: "onboarding.md", planning: "planning.md", copy: "copy.md", "art-direction": "art-direction.md", assets: "assets.md", quality: "quality.md", review: "review.md", operations: "operations.md", publishing: "publishing.md", learning: "learning.md", layouts: null };
tool("skill_guide", "Skill instructions", 'Returns the working instructions. "core" is the core (read all of it at the start); the rest is read when the topic comes up: brief, onboarding, planning, copy, art-direction, assets, quality, review, operations, publishing, learning, layouts.', { topic: z.enum(Object.keys(TOPICS)).default("core") }, async ({ topic }) => {
  if (topic === "core") return ok((await readFile(path.join(PKG, "skills/opency/SKILL.md"), "utf8")).replace(/^---[\s\S]*?---\s*/, ""));
  if (topic === "layouts") return ok(await readFile(path.join(PKG, "templates/layouts/README.md"), "utf8"));
  return ok(await readFile(path.join(REFS, TOPICS[topic]), "utf8"));
}, RO);

// ============================================================ Brands
tool("brand_list", "List brands", "Brands in the workspace and which one is active.", {}, async () => result(await engine("brand.mjs", ["list"])), RO);

tool("brand_get", "Read a brand", "Everything to know before designing: brand.json (data, logos, pillars, verified facts), brand-kit.md (voice, color roles, instructions), tokens.css, voice samples, decisions, calendar and inspirations.", { brand: Brand, include: z.array(z.enum(["brand.json", "brand-kit.md", "tokens.css", "voice-samples.md", "decisions.md", "calendar.md", "inspirations.md"])).optional().describe("Defaults to everything.") }, async ({ brand, include }) => {
  const slug = await activeBrand(brand), dir = brandDir(slug);
  const files = include ?? ["brand.json", "brand-kit.md", "tokens.css", "voice-samples.md", "decisions.md", "calendar.md", "inspirations.md"];
  const parts = [`# Brand: ${slug}${(await loadBrand(slug)).loaded ? "" : "  (NOT LOADED: follow the onboarding guide before designing)"}`];
  for (const f of files) parts.push(`\n===== ${f} =====\n${(await readText(path.join(dir, f))) || "(empty)"}`);
  const tpl = (await readdir(path.join(dir, "templates"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name);
  if (tpl.length) parts.push(`\nSaved templates: ${tpl.join(", ")}`);
  return ok(parts.join("\n"));
}, RO);

tool("brand_create", "Create a brand", "Creates brands/<slug>/ with neutral tokens. Next: brand_import_site if there is a website, then propose palette, typefaces and voice before writing anything.", { slug: Slug, name: z.string().min(1).max(60) }, async ({ slug, name }) => result(await engine("brand.mjs", ["new", slug, "--name", clean(name)])));

tool("brand_use", "Set the active brand", "Sets the brand the other tools work with when none is given.", { brand: Slug }, async ({ brand }) => result(await engine("brand.mjs", ["use", brand])));

tool("brand_import_site", "Read a website", "Opens the brand's website and extracts colors by surface, ink colors, typefaces, logo, headings, CTAs and social links. It does not write the brand: it leaves a report so you can propose and the user can approve. Returns a screenshot of the home page.", { url: z.string().url(), brand: Brand }, async ({ url, brand }) => {
  const slug = await activeBrand(brand);
  if (!/^https?:\/\//.test(url)) return bad("Only http(s) URLs.");
  const r = await engine("brand.mjs", ["import", url, "--brand", slug], { timeout: 120000 });
  if (!r.ok) return result(r);
  const report = await readText(path.join(brandDir(slug), "import/report.json"));
  const shot = path.join(brandDir(slug), "import/home.png");
  return ok(r.out, `\n===== import/report.json =====\n${report}`, existsSync(shot) ? await image(shot, 1280) : null);
}, { openWorldHint: true });

tool("brand_check", "Verify palette and fonts", "Measures the contrast of every palette combination and confirms the fonts load. It must finish clean before the first piece.", { brand: Brand }, async ({ brand }) => result(await engine("brand.mjs", ["check", ...withBrand(brand)])), RO);

const BRAND_FILES = ["brand.json", "brand-kit.md", "tokens.css", "voice-samples.md", "calendar.md", "decisions.md", "inspirations.md"];
tool("brand_write", "Write a brand file", "Writes one of the brand's files. REQUIRES an explicit yes from the user if the brand is already loaded and the file is brand.json, brand-kit.md or tokens.css: show the proposal in text first. Keeps a copy of the previous version in history/.", { brand: Brand, file: z.enum(BRAND_FILES), content: z.string().max(200000), confirmedByUser: z.boolean().describe("true only if the user approved this change in this conversation.") }, async ({ brand, file, content, confirmedByUser }) => {
  const slug = await activeBrand(brand), dir = brandDir(slug);
  if (slug.startsWith("_")) return bad("Demo brands cannot be edited: create one with brand_create.");
  const b = await loadBrand(slug);
  const core = ["brand.json", "brand-kit.md", "tokens.css"].includes(file);
  if (core && b.loaded && !confirmedByUser) return bad(`${slug} is already loaded. Show the change to the user and call again with confirmedByUser=true once they say yes.`);
  if (file === "brand.json") { try { JSON.parse(content); } catch (e) { return bad(`brand.json is not valid JSON: ${e.message}`); } }
  const target = path.join(dir, file);
  if (existsSync(target) && core) { const h = path.join(dir, "history", today()); await mkdir(h, { recursive: true }); await cp(target, path.join(h, file)); }
  await writeFile(target, content.endsWith("\n") ? content : content + "\n");
  return ok(`✓ brands/${slug}/${file}${core ? ` (previous version in history/${today()}/)` : ""}. ${file === "tokens.css" ? "Run brand_check." : ""}`);
}, { destructiveHint: true });

// ============================================================ Brief
tool("brief_questions", "Brief questions", "The questions that must be answered before designing, by kind: brand (loading a brand), campaign, or piece (a single piece). Each one says whether it is required and where it can be inferred from so you do not have to ask. They are written in English: ask them in the user's language.", { kind: z.enum(briefKinds).default("campaign") }, async ({ kind }) => ok({ kind, ...BRIEFS[kind] }), RO);

tool("brief_interview", "Interview the user", `Runs the brief with the user. If the client supports it, it shows a form in short batches; otherwise it returns the next questions for you to ask in the chat (2 to 4 at a time, in the user's language, with your question tool if you have one).
Pass in "known" everything you already know from the request, the brand or the website: it is not asked again. With "campaign" the answers are saved to that campaign.`, {
  kind: z.enum(briefKinds).default("campaign"),
  known: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional().describe("Answers already known, keyed by question id."),
  campaign: Slug.optional().describe("Campaign to save into (kind=campaign only). It must exist: campaign_create."),
  brand: Brand,
  rounds: z.number().int().min(1).max(5).default(3),
}, async ({ kind, known = {}, campaign, brand, rounds }) => {
  const answers = { ...known };
  let asked = false, stopped = null;
  if (server.server.getClientCapabilities()?.elicitation) {
    for (let i = 0; i < rounds; i++) {
      const qs = nextQuestions(kind, answers, 4);
      if (!qs.length || (i > 0 && !qs.some((q) => q.required))) break;
      const res = await server.server.elicitInput({ message: i === 0 ? `${BRIEFS[kind].title}. ${BRIEFS[kind].intro}` : "A few more and I will get started:", requestedSchema: elicitationSchema(qs) }).catch(() => null);
      if (!res) break; // the client declared the capability but did not answer: continue in the chat
      asked = true;
      if (res.action !== "accept") { stopped = res.action; break; }
      for (const [k, v] of Object.entries(res.content ?? {})) if (v !== "" && v !== null && v !== undefined) answers[k] = String(v);
    }
  }
  let saved = null;
  if (kind === "campaign" && campaign && Object.keys(answers).length) {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "opency-"));
    try { await writeFile(path.join(tmp, "a.json"), JSON.stringify(answers)); const r = await engine("campaign.mjs", ["brief", campaign, "--answers", path.join(tmp, "a.json"), "--json", ...withBrand(brand)]); if (!r.ok) return result(r); saved = campaign; }
    finally { await rm(tmp, { recursive: true, force: true }); }
  }
  const missing = missingAnswers(kind, answers).map((q) => ({ id: q.id, ask: q.ask, options: q.options, why: q.why }));
  const optional = nextQuestions(kind, answers, 20).filter((q) => !q.required).map((q) => ({ id: q.id, ask: q.ask, options: q.options }));
  return ok({
    kind, mode: asked ? "form" : "chat", answers, savedTo: saved, readyToDesign: !missing.length,
    ...(stopped ? { note: `The user ${stopped === "decline" ? "declined" : "closed"} the form: continue in the chat, without pushing everything at once.` } : {}),
    missingRequired: missing, stillOpen: optional.slice(0, 6),
    next: missing.length ? `Ask the user ${asked ? "what is still missing" : "these questions"} in the chat, 2 to 4 at a time, in their language and their words. Whatever you can infer from the brand or the website, propose it instead of asking. Then ${kind === "campaign" ? "save with campaign_brief" : "continue"}.` : kind === "campaign" ? "Brief complete. Play the message back to the user in one sentence and propose the piece plan (campaign_plan)." : kind === "brand" ? "Use this to propose palette, typefaces, voice and verified facts; write with brand_write once the user says yes." : "Set the direction (thesis, mode, signature move) and create the piece.",
  });
});

// ============================================================ Campaigns
tool("campaign_create", "Create a campaign", "Creates the campaign and saves what is already known of the brief. A campaign is one message carried across several pieces.", { slug: Slug, name: z.string().min(1).max(80), answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(), brand: Brand }, async ({ slug, name, answers, brand }) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "opency-"));
  try { await writeFile(path.join(tmp, "a.json"), JSON.stringify(answers ?? {})); return result(await engine("campaign.mjs", ["new", slug, "--name", clean(name), "--answers", path.join(tmp, "a.json"), "--json", ...withBrand(brand)])); }
  finally { await rm(tmp, { recursive: true, force: true }); }
});

tool("campaign_brief", "Save brief answers", `Saves or corrects answers of a campaign brief and returns what is missing. Keys: ${BRIEFS.campaign.questions.map((q) => q.id).join(", ")}.`, { campaign: Slug, answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])), brand: Brand }, async ({ campaign, answers, brand }) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "opency-"));
  try { await writeFile(path.join(tmp, "a.json"), JSON.stringify(answers)); return result(await engine("campaign.mjs", ["brief", campaign, "--answers", path.join(tmp, "a.json"), "--json", ...withBrand(brand)])); }
  finally { await rm(tmp, { recursive: true, force: true }); }
});

tool("campaign_plan", "Save the piece plan", "Saves the plan the user approved: each piece proves the message from a different angle. Show the plan in text and wait for the yes before saving it.", { campaign: Slug, brand: Brand, pieces: z.array(z.object({ slug: z.string().min(1), angle: z.string().min(1).describe("The angle in one sentence."), intent: z.string().optional().describe("give an opinion, teach, show the product, case / proof, sell, news / event, community"), format: Format.optional(), channel: z.string().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), layouts: z.string().optional().describe("Comma-separated layouts.") })).min(1).max(40) }, async ({ campaign, brand, pieces }) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "opency-"));
  try { await writeFile(path.join(tmp, "p.json"), JSON.stringify(pieces)); return result(await engine("campaign.mjs", ["plan", campaign, "--file", path.join(tmp, "p.json"), "--json", ...withBrand(brand)])); }
  finally { await rm(tmp, { recursive: true, force: true }); }
});

tool("campaign_status", "Campaign status", "Brief (what is missing), plan, created pieces with their status and render errors, and the next step.", { campaign: Slug, brand: Brand }, async ({ campaign, brand }) => result(await engine("campaign.mjs", ["status", campaign, "--json", ...withBrand(brand)])), RO);

tool("campaign_list", "List campaigns", "The brand's campaigns.", { brand: Brand }, async ({ brand }) => result(await engine("campaign.mjs", ["list", "--json", ...withBrand(brand)])), RO);

// ============================================================ Images
tool("stock_search", "Search stock photos", `Searches free photos on Openverse and, if the user connected it, Unsplash, at once and returns the previews so you LOOK at them before choosing. Search in English and be specific ("barista pouring latte art close up", not "coffee"). The brand's own photos always come first (asset_list). Each result carries author, license and the largest format it covers without upscaling.`, { query: z.string().min(2).max(120), orientation: z.enum(["portrait", "landscape", "square"]).optional().describe("portrait for 4:5 and 9:16."), provider: z.enum(["auto", "unsplash", "openverse"]).default("auto"), n: z.number().int().min(1).max(24).default(8), page: z.number().int().min(1).max(12).default(1), previews: z.boolean().default(true).describe("Attaches the preview images (up to 8)."), brand: Brand }, async ({ query, orientation, provider, n, page, previews, brand }) => {
  const r = await engine("assets.mjs", ["stock", clean(query), "--json", "--provider", provider, "--n", n, "--page", page, ...(orientation ? ["--orientation", orientation] : []), ...withBrand(brand)], { timeout: 60000 });
  const data = parse(r);
  if (!r.ok || !data) return result(r);
  const parts = [{ ...data, next: data.results.length ? 'Look at the previews. Import ONLY the chosen one with stock_import, then asset_analyze.' : "No results: try another search, more specific and in English." }];
  if (previews) for (const item of data.results.slice(0, 8)) {
    try { const { buf } = await fetchBuffer(item.preview); parts.push(text(`▼ ${item.ref} · ${item.w}×${item.h} · ${item.license} · ${item.by}`), { type: "image", data: (await sharp(buf).resize({ width: 480, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer()).toString("base64"), mimeType: "image/jpeg" }); } catch { /* preview unavailable: the result stays in the list */ }
  }
  return ok(...parts);
}, { readOnlyHint: true, openWorldHint: true });

tool("stock_status", "Stock providers", "Which stock providers are available. Openverse always works. Unsplash is optional and uses the user's OWN free Access Key: if it is not connected and would help, tell the user to run `npx opency stock connect unsplash` in their terminal. Never ask them to paste the key in the chat.", {}, async () => result(await engine("stock.mjs", ["status", "--json"])), RO);

tool("stock_import", "Import a stock photo", "Downloads the chosen photo at full resolution, normalizes it (sRGB, no metadata), records author and license in assets.json and returns the image so you can analyze it. Then call asset_analyze.", { ref: z.string().regex(/^(unsplash|openverse):[A-Za-z0-9_-]{1,64}$/), description: z.string().min(3).max(200).describe("What the photo shows: the agent uses it to pick the photo later."), id: Slug.optional(), brand: Brand }, async ({ ref, description, id, brand }) => {
  const slug = await activeBrand(brand);
  const r = await engine("assets.mjs", ["stock-import", ref, "--desc", clean(description), ...(id ? ["--id", id] : []), "--brand", slug], { timeout: 120000 });
  if (!r.ok) return result(r);
  const newId = r.out.match(/✓ (\S+) →/)?.[1];
  const a = (await readJSON(path.join(brandDir(slug), "assets/assets.json"), { assets: [] })).assets.find((x) => x.id === newId);
  return ok(r.out, a ? await image(path.join(brandDir(slug), "assets", a.file), 1024) : null);
}, { openWorldHint: true });

tool("asset_add", "Register an image", "Registers a photo, logo or texture from a local file or a public URL the user provided. Returns the image so you can analyze it.", { source: z.string().min(1).describe("Local path or http(s) URL."), kind: z.enum(["photo", "logo", "texture", "stock"]).default("photo"), description: z.string().min(3).max(200), credit: z.string().max(200).optional(), license: z.string().max(80).optional(), id: Slug.optional(), brand: Brand }, async ({ source, kind, description, credit, license, id, brand }) => {
  const slug = await activeBrand(brand);
  const r = await engine("assets.mjs", ["add", source, "--kind", kind, "--desc", clean(description), ...(credit ? ["--credit", clean(credit)] : []), ...(license ? ["--license", clean(license)] : []), ...(id ? ["--id", id] : []), "--brand", slug], { timeout: 120000 });
  if (!r.ok) return result(r);
  const newId = r.out.match(/✓ (\S+) →/)?.[1];
  const a = (await readJSON(path.join(brandDir(slug), "assets/assets.json"), { assets: [] })).assets.find((x) => x.id === newId);
  return ok(r.out, a && !a.file.endsWith(".svg") ? await image(path.join(brandDir(slug), "assets", a.file), 1024) : null);
}, { openWorldHint: true });

const Rect = z.object({ kind: z.enum(["face", "hand", "subject", "text", "logo"]), x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) });
tool("asset_analyze", "Analyze a photo", "Required before using a photo: record the focal point and the regions that must not be cropped or covered (faces, hands, subject, text, logos), in 0 to 1 coordinates over the image. Look at it first with asset_view. With this the render detects cropped faces and text over the subject.", { id: Slug, focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(), protect: z.array(Rect).max(12).optional().describe("Empty list = I looked and there is nothing to protect."), done: z.boolean().default(true), brand: Brand }, async ({ id, focal, protect, done, brand }) => {
  const argv = ["analyze", id, ...(focal ? ["--focal", `${focal.x},${focal.y}`] : []), ...(protect ?? []).flatMap((p) => ["--protect", `${p.kind}:${p.x},${p.y},${p.w},${p.h}`]), ...(done ? ["--done"] : []), ...withBrand(brand)];
  return result(await engine("assets.mjs", argv));
});

tool("asset_list", "List images", "The brand's library: id, kind, size, format coverage, description, credit and whether each image is analyzed, pending or vetoed.", { kind: z.enum(["photo", "logo", "texture", "stock"]).optional(), brand: Brand }, async ({ kind, brand }) => {
  const slug = await activeBrand(brand);
  const assets = (await readJSON(path.join(brandDir(slug), "assets/assets.json"), { assets: [] })).assets.filter((a) => !kind || a.kind === kind);
  return ok(assets.map((a) => ({ id: a.id, kind: a.kind, file: `../../assets/${a.file}`, description: a.description, size: a.quality?.width ? `${a.quality.width}×${a.quality.height}` : "svg", tone: a.quality?.tone, coverage: a.quality?.coverage, credit: a.credit, license: a.license, analyzed: !!a.analysis?.complete, focalPoint: a.analysis?.focalPoint, vetoed: !!a.vetoed, usedIn: a.usage?.length ?? 0 })));
}, RO);

tool("asset_view", "View an image", "Returns the registered image so you can look at it (before analyzing or choosing it).", { id: Slug, brand: Brand }, async ({ id, brand }) => {
  const slug = await activeBrand(brand);
  const a = (await readJSON(path.join(brandDir(slug), "assets/assets.json"), { assets: [] })).assets.find((x) => x.id === id);
  if (!a) return bad(`Asset "${id}" does not exist.`);
  if (a.file.endsWith(".svg")) return ok(await readText(path.join(brandDir(slug), "assets", a.file)));
  return ok({ id: a.id, description: a.description, quality: a.quality, analysis: a.analysis, credit: a.credit }, await image(path.join(brandDir(slug), "assets", a.file), 1280));
}, RO);

tool("asset_veto", "Veto an image", "Marks a photo the user rejected so it is never used again (or re-enables it).", { id: Slug, reason: z.string().max(200).optional(), undo: z.boolean().default(false), brand: Brand }, async ({ id, reason, undo, brand }) => result(await engine("assets.mjs", [undo ? "unveto" : "veto", id, ...(reason ? ["--reason", clean(reason)] : []), ...withBrand(brand)])));

// ============================================================ Pieces
tool("layouts_list", "Available layouts", "The tested slide archetypes and the brand's saved templates. Returns the layouts' contact sheet.", { brand: Brand }, async ({ brand }) => {
  const lib = await readJSON(path.join(ROOT, "templates/layouts/piece.json"), { slides: [] });
  const slug = await activeBrand(brand).catch(() => null);
  const tpl = slug ? (await readdir(path.join(brandDir(slug), "templates"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name) : [];
  const sheet = path.join(ROOT, "templates/layouts/render/contact-sheet.png");
  return ok(await readText(path.join(ROOT, "templates/layouts/README.md")), `\nNames: ${lib.slides.map((s) => s.layout).join(", ")}\nBrand templates: ${tpl.join(", ") || "(none)"}`, existsSync(sheet) ? await image(sheet, 1800) : null);
}, RO);

tool("piece_create", "Create a piece", "Creates the piece by combining layouts (the usual way), from a brand template, or by duplicating/adapting another piece to another format. Write the full copy first: if a text does not fit a layout, change the layout, do not shrink the type.", {
  slug: z.string().min(1).max(60), brand: Brand,
  layouts: z.array(z.string()).min(1).max(20).optional().describe("One layout per slide, in order. Do not repeat the same one on every slide."),
  template: z.string().optional(), from: PieceId.optional().describe("Piece to duplicate or adapt."),
  slides: z.number().int().min(1).max(20).optional().describe("Blank slides, if no layouts are given."),
  format: Format.optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), campaign: Slug.optional(), intent: z.string().max(40).optional(), category: z.string().max(40).optional(),
}, async ({ slug, brand, layouts, template, from, slides, format, date, campaign, intent, category }) => {
  const argv = [clean(slug)];
  if (layouts) argv.push("--layouts", layouts.join(","));
  if (template) argv.push("--template", clean(template));
  if (from) argv.push("--from", from);
  if (slides) argv.push("--slides", slides);
  for (const [k, v] of Object.entries({ format, date, campaign, intent, category })) if (v) argv.push(`--${k}`, clean(v));
  const r = await engine("new-piece.mjs", [...argv, ...withBrand(brand)]);
  return result(r, r.ok ? "Next: piece_read to see the slides, piece_write for the copy and piece.json (direction, hook, captions, alt), then piece_render." : null);
});

tool("piece_list", "List pieces", "The brand's pieces with format, status, campaign and the result of the last render.", { brand: Brand, campaign: Slug.optional() }, async ({ brand, campaign }) => {
  const slug = await activeBrand(brand), pdir = path.join(brandDir(slug), "pieces");
  const rows = [];
  for (const d of (await readdir(pdir, { withFileTypes: true }).catch(() => [])).filter((x) => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = await readJSON(path.join(pdir, d.name, "piece.json"), null); if (!p || (campaign && p.campaign !== campaign)) continue;
    const rep = await readJSON(path.join(pdir, d.name, "render/report.json"), null);
    rows.push({ id: d.name, title: p.title, format: p.format, slides: p.slides?.length, status: p.status, version: p.version, campaign: p.campaign ?? null, plannedDate: p.plannedDate, render: rep ? `${rep.summary.errors} errors · ${rep.summary.warnings} warnings` : "not rendered" });
  }
  return ok(rows);
}, RO);

const PIECE_FILE = z.string().regex(/^(piece\.json|slide-\d{2}\.html)$/, "piece.json or slide-NN.html");
tool("piece_read", "Read a piece", "Returns piece.json and the slides' HTML (all of them, or the requested files). Also the quality report if there is one.", { piece: PieceId, files: z.array(PIECE_FILE).optional(), report: z.boolean().default(false), brand: Brand }, async ({ piece, files, report, brand }) => {
  const dir = await pieceDir(brand, piece);
  const all = files ?? ["piece.json", ...(await readdir(dir)).filter((f) => /^slide-\d{2}\.html$/.test(f)).sort()];
  const parts = [];
  for (const f of all) parts.push(`===== ${f} =====\n${await readText(path.join(dir, f)) || "(does not exist)"}`);
  if (report) parts.push(`===== render/report.md =====\n${await readText(path.join(dir, "render/report.md")) || "(not rendered)"}`);
  return ok(parts.join("\n\n"));
}, RO);

tool("piece_write", "Write slides or piece.json", "Writes one or more files of the piece. Rules: color and type only through var(--…) from tokens.css; registered images only, with data-asset and a relative src ../../assets/…; never external URLs. Save a version before a big change (piece_version).", { piece: PieceId, files: z.array(z.object({ file: PIECE_FILE, content: z.string().max(200000) })).min(1).max(21), brand: Brand }, async ({ piece, files, brand }) => {
  const dir = await pieceDir(brand, piece);
  for (const f of files) {
    if (f.file === "piece.json") { try { JSON.parse(f.content); } catch (e) { return bad(`piece.json is not valid JSON: ${e.message}`); } }
    else if (/<script\b/i.test(f.content)) return bad(`${f.file}: slides must not contain <script>.`);
  }
  for (const f of files) await writeFile(path.join(dir, f.file), f.content.endsWith("\n") ? f.content : f.content + "\n");
  return ok(`✓ ${files.map((f) => f.file).join(", ")}. Run piece_render.`);
});

tool("piece_render", "Render and check", "Renders the piece, runs pixel-level quality control (contrast over photos, safe areas, widows, cropped faces, figures without a source, copy) and returns the report and the CONTACT SHEET. Look at it: passing checks is not aesthetic approval. Nothing is delivered with errors.", { piece: PieceId, pdf: z.boolean().default(false).describe("Also outputs carousel.pdf for LinkedIn."), scale: z.number().int().min(1).max(4).default(1).describe("2 for 2K."), brand: Brand }, async ({ piece, pdf, scale, brand }) => {
  const dir = await pieceDir(brand, piece);
  const r = await engine("render.mjs", [dir, "--scale", scale, ...(pdf ? ["--pdf"] : [])], { timeout: 300000 });
  if (!r.ok) return result(r);
  const sheet = path.join(dir, "render/contact-sheet.png");
  const outputs = (await readdir(path.join(dir, "render")).catch(() => [])).filter((f) => !f.startsWith("."));
  return ok(await readText(path.join(dir, "render/report.md")), `\nFiles in ${path.relative(ROOT, dir)}/render/: ${outputs.join(", ")}`, existsSync(sheet) ? await image(sheet, 2000) : null);
});

tool("piece_view", "View a rendered slide", "Returns an already rendered slide at a larger size, or the contact sheet.", { piece: PieceId, slide: z.number().int().min(1).max(20).optional().describe("No number: the contact sheet."), brand: Brand }, async ({ piece, slide, brand }) => {
  const dir = await pieceDir(brand, piece);
  const n = String(slide ?? 0).padStart(2, "0");
  const file = slide ? [`slide-${n}.png`, `slide-${n}.jpg`].map((f) => path.join(dir, "render", f)).find(existsSync) : path.join(dir, "render/contact-sheet.png");
  if (!file || !existsSync(file)) return bad("Not rendered yet: run piece_render.");
  return ok(await image(file, slide ? 1080 : 2000));
}, RO);

tool("piece_version", "Piece versions", "save keeps a copy before a big change; list shows the history; diff shows the texts that changed (including the ones the user edited by hand: leave those alone); restore goes back to a version without losing the current one.", { piece: PieceId, action: z.enum(["save", "list", "diff", "restore"]), note: z.string().max(200).optional(), version: z.number().int().min(1).optional(), brand: Brand }, async ({ piece, action, note, version, brand }) => {
  const dir = await pieceDir(brand, piece);
  return result(await engine("version.mjs", [dir, action, ...(action === "save" && note ? [clean(note)] : []), ...(action === "restore" && version ? [version] : [])]));
});

tool("piece_motion", "Generate video", "Builds an MP4 from the slides (staggered entrances and crossfades). Requires ffmpeg and data-motion on each slide's <main>. Audio is supplied by the user, with the rights cleared.", { piece: PieceId, slides: z.union([z.literal("all"), z.number().int().min(1).max(20)]).default("all"), duration: z.number().min(2).max(15).default(4), audio: z.string().optional().describe("Local path to an audio file supplied by the user."), brand: Brand }, async ({ piece, slides, duration, audio, brand }) => {
  const dir = await pieceDir(brand, piece);
  return result(await engine("motion.mjs", [dir, ...(slides === "all" ? ["--slides", "all"] : ["--slide", slides]), "--duration", duration, ...(audio ? ["--audio", audio] : [])], { timeout: 600000 }));
});

// ============================================================ Feed and results
tool("feed_check", "Check the feed", "Checks the feed's rhythm (backgrounds, categories), repeated hooks and photos that come back too soon, and returns the profile grid.", { brand: Brand }, async ({ brand }) => {
  const slug = await activeBrand(brand);
  const r = await engine("feed.mjs", ["--brand", slug]);
  const grid = path.join(brandDir(slug), "feed-preview.png");
  return result(r, r.ok && existsSync(grid) ? await image(grid, 1200) : null);
}, RO);

const Metric = z.number().min(0).optional();
tool("results_add", "Record results", "Saves the numbers of a published piece. The user provides them: never estimate.", { piece: PieceId, network: z.string().default("instagram"), reach: Metric, impressions: Metric, saves: Metric, shares: Metric, likes: Metric, comments: Metric, follows: Metric, clicks: Metric, url: z.string().url().optional(), brand: Brand }, async ({ piece, network, url, brand, ...metrics }) => {
  const dir = await pieceDir(brand, piece);
  return result(await engine("results.mjs", ["add", dir, "--network", clean(network), ...Object.entries(metrics).filter(([, v]) => v !== undefined).flatMap(([k, v]) => [`--${k}`, v]), ...(url ? ["--url", url] : [])]));
});

tool("results_summary", "What worked", "Ranking of published pieces and averages by intent, mode and cover layout. Use it when planning: repeat the best-performing structure with a new topic.", { brand: Brand }, async ({ brand }) => result(await engine("results.mjs", withBrand(brand))), RO);

// ============================================================ Resources and prompts
for (const [topic, file] of Object.entries(TOPICS)) {
  const src = topic === "core" ? path.join(PKG, "skills/opency/SKILL.md") : topic === "layouts" ? path.join(PKG, "templates/layouts/README.md") : path.join(REFS, file);
  server.registerResource(`guide-${topic}`, `opency://guide/${topic}`, { title: `opency · ${topic}`, description: `Skill instructions: ${topic}`, mimeType: "text/markdown" }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await readFile(src, "utf8") }] }));
}

const prompt = (name, title, description, argsSchema, build) => server.registerPrompt(name, { title, description, argsSchema }, (a) => ({ messages: [{ role: "user", content: { type: "text", text: build(a) } }] }));
prompt("new-campaign", "New campaign", "Interactive brief, plan and pieces for a campaign.", { topic: z.string().describe("What the campaign is about, in your own words."), brand: z.string().optional() }, ({ topic, brand }) => `I want a campaign${brand ? ` for ${brand}` : ""}: ${topic}\n\nUse opency. Start with workspace_status, skill_guide("core") and skill_guide("brief"). Before designing, run the brief with me using brief_interview (pass in "known" what I already said here): I need you to understand what I want to get across. Then propose the piece plan in text and wait for my yes.`);
prompt("load-brand", "Load a brand", "Onboard a brand from its website.", { website: z.string().describe("URL of the website or profile.") }, ({ website }) => `Load a new brand from ${website} with opency. Read skill_guide("onboarding"), create it, import the website with brand_import_site, and propose in text the palette with its roles, the typefaces, the voice and the verified facts. Ask me only what you cannot infer (brief_interview kind="brand"). Do not write the brand until I say yes.`);
prompt("weekly-plan", "Weekly plan", "3 to 5 ideas for the week, cross-checked with the calendar and the results.", { brand: z.string().optional() }, ({ brand }) => `Propose this week's content plan${brand ? ` for ${brand}` : ""} with opency. Read skill_guide("planning"), the brand with brand_get, feed_check and results_summary. 3 to 5 ideas: intent, one-sentence angle, format, suggested date and open questions. Do not design anything until I choose.`);

await server.connect(new StdioServerTransport());
