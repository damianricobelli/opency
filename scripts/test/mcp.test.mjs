// Exercises the MCP server with a real client against a temporary workspace.
// Tests that hit the network (Openverse) only run with OPENCY_TEST_NETWORK=1.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NET = process.env.OPENCY_TEST_NETWORK === "1";
let ws, client, forms = [];

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 300000 });
  return { ...r, text: r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n"), images: r.content.filter((c) => c.type === "image") };
};

before(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), "opency-test-"));
  const init = spawnSync(process.execPath, [path.join(PKG, "bin/opency.mjs"), "init", ws], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  client = new Client({ name: "opency-test", version: "0" }, { capabilities: { elicitation: {} } });
  // The "user": answers the brief form.
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    forms.push(req.params);
    const answers = { message: "Cold coffee can be specialty coffee too", objective: "Sales of something specific", audience: "downtown office workers", channels: "Instagram feed", dates: "December", cta: "Order in the app", visuals: "Stock photos" };
    return { action: "accept", content: Object.fromEntries(Object.keys(req.params.requestedSchema.properties).filter((k) => answers[k]).map((k) => [k, answers[k]])) };
  });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(PKG, "mcp/server.mjs")], cwd: ws, env: { ...process.env, OPENCY_HOME: ws } }));
});
after(async () => { await client?.close(); await rm(ws, { recursive: true, force: true }); });

test("exposes tools, resources and prompts", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const n of ["workspace_status", "skill_guide", "brief_interview", "campaign_create", "stock_search", "stock_import", "asset_analyze", "piece_create", "piece_write", "piece_render", "feed_check"]) assert.ok(names.includes(n), `missing ${n}`);
  assert.ok(tools.every((t) => t.description && t.inputSchema), "every tool has a description and a schema");
  assert.ok((await client.listResources()).resources.some((r) => r.uri === "opency://guide/core"));
  assert.deepEqual((await client.listPrompts()).prompts.map((p) => p.name).sort(), ["load-brand", "new-campaign", "weekly-plan"]);
});

test("workspace_status and skill_guide", async () => {
  const s = JSON.parse((await call("workspace_status")).text);
  assert.equal(s.ready, true);
  assert.ok(s.stock.available.includes("openverse"));
  assert.match((await call("skill_guide", { topic: "brief" })).text, /What do you want to get across\?/);
});

test("brand → brief with a form → campaign → plan", async () => {
  assert.ok(!(await call("brand_create", { slug: "cafe", name: "Test Coffee" })).isError);
  assert.ok(!(await call("campaign_create", { slug: "verano", name: "Summer" })).isError);
  forms = [];
  const r = JSON.parse((await call("brief_interview", { kind: "campaign", campaign: "verano", known: { message: "Cold coffee can be specialty coffee too" } })).text);
  assert.equal(r.mode, "form");
  assert.ok(forms.length >= 1 && forms.length <= 3, "asks in batches");
  assert.ok(forms.every((f) => Object.keys(f.requestedSchema.properties).length <= 4), "no more than 4 questions per batch");
  assert.ok(!("message" in forms[0].requestedSchema.properties), "does not ask again what it already knows");
  assert.equal(r.readyToDesign, true);
  assert.equal(r.savedTo, "verano");
  const plan = await call("campaign_plan", { campaign: "verano", pieces: [{ slug: "por-que-frio", angle: "Cold brew steeps for 16 hours", intent: "teach", format: "4:5", date: "2026-12-01" }] });
  assert.ok(!plan.isError, plan.text);
  const st = JSON.parse((await call("campaign_status", { campaign: "verano" })).text);
  assert.equal(st.pendingFromPlan.length, 1);
});

test("answers already known: nothing left to ask", async () => {
  const r = JSON.parse((await call("brief_interview", { kind: "piece", rounds: 1, known: { message: "x", intent: "Teach" } })).text);
  assert.equal(r.readyToDesign, true);
  assert.equal(r.missingRequired.length, 0);
});

test("piece: create, read, write, render and view", async () => {
  const c = await call("piece_create", { slug: "por-que-frio", layouts: ["cover-type", "steps", "closer"], campaign: "verano", date: "2026-12-01" });
  assert.ok(!c.isError, c.text);
  const id = "2026-12-01-por-que-frio";
  const read = await call("piece_read", { piece: id, as: "html", files: ["slide-01.html"] });
  assert.match(read.text, /<main class="canvas/);
  const html = read.text.split("=====\n")[1];
  assert.ok((await call("piece_write", { piece: id, files: [{ file: "slide-01.html", content: html + "<script>alert(1)</script>" }] })).isError, "rejects <script>");
  assert.ok((await call("piece_write", { piece: id, files: [{ file: "../x.html", content: "x" }] })).isError, "rejects paths outside the piece");
  assert.ok(!(await call("piece_write", { piece: id, files: [{ file: "slide-01.html", content: html }] })).isError);
  const r = await call("piece_render", { piece: id });
  assert.ok(!r.isError, r.text);
  assert.match(r.text, /0 errors/);
  assert.equal(r.images.length, 1, "returns the contact sheet");
  assert.equal((await call("piece_view", { piece: id, slide: 1 })).images.length, 1);
  const st = JSON.parse((await call("campaign_status", { campaign: "verano" })).text);
  assert.equal(st.pieces.length, 1);
  assert.equal(st.pieces[0].errors, 0);
});

test("compose from data → repair → review → approve → package, without writing HTML", async () => {
  const lib = JSON.parse((await call("layouts_list", { sheet: false })).content[0].text);
  assert.ok(lib.layouts.find((l) => l.layout === "steps").slots["step-1"], "layouts expose their slots");

  const bad = JSON.parse((await call("piece_compose", { slug: "bad", brand: "cafe", date: "2026-12-02", slides: [{ layout: "cover-type", slots: { nope: "x" } }] })).text);
  assert.ok(bad.issues.some((i) => i.code === "unknown_slot"));
  assert.ok(bad.issues.some((i) => i.code === "sample_copy_left"), "sample copy left in place is an error, caught before rendering");

  const made = await call("piece_compose", {
    slug: "cold brew", brand: "cafe", date: "2026-12-03", campaign: "verano", title: "Cold brew, explained", hook: "Cold brew takes 16 hours",
    direction: { thesis: "Cold brew is slow on purpose" }, captions: { instagram: "Cold brew steeps for sixteen hours in the fridge. Slow extraction, softer cup." },
    slides: [
      { layout: "cover-type", slots: { kicker: "Guide · three steps", headline: "Three mistakes that spoil your brews", support: "Why a slow extraction changes the cup." }, alt: "Cover: cold brew takes sixteen hours." },
      { layout: "steps", slots: { headline: "How we brew each batch", "step-1": "Coarse grind, cold water.", "step-2": "Sixteen hours in the fridge.", "step-3": "Filter it twice.", "step-4": null }, alt: "Three steps to make cold brew." },
      { layout: "closer", slots: { kicker: "To wrap up", headline: "One brew per batch. Always.", "cta-text": "Order it in the app" }, alt: "Closing slide: slow on purpose." },
    ],
  });
  assert.ok(!made.isError, made.text);
  assert.match(made.text, /0 errors/);
  assert.equal(made.images.length, 1, "one call returns the contact sheet");
  const id = "2026-12-03-cold-brew";

  const read = JSON.parse((await call("piece_read", { piece: id, brand: "cafe" })).text);
  assert.equal(read.slides[1].slots.length, 4, "headline + three steps: the fourth went away with its list item");
  assert.equal(read.slides[0].slots.find((x) => x.id === "kicker").text, "Guide · three steps");

  const edited = await call("piece_edit", { piece: id, brand: "cafe", slides: [{ n: 3, slots: { "cta-text": "Order it in the app today" } }], change: "sharper call to action" });
  assert.ok(!edited.isError, edited.text);
  assert.equal(edited.images.length, 1, edited.text);
  assert.match((await call("piece_read", { piece: id, brand: "cafe" })).text, /Order it in the app today/);

  const repaired = await call("piece_repair", { piece: id, brand: "cafe" });
  assert.ok(!repaired.isError, repaired.text);

  const review = JSON.parse((await call("piece_handoff", { piece: id, action: "review", brand: "cafe" })).text);
  assert.match(review.file, /review\.html$/);
  assert.equal(review.status, "review");
  const { readFile: read2 } = await import("node:fs/promises");
  const html = await read2(review.absolute, "utf8");
  assert.ok(!/src="(?!data:)/.test(html), "the review page embeds its images: one file, no server");
  assert.match(html, /Cold brew, explained/);

  assert.ok((await call("piece_handoff", { piece: id, action: "package", brand: "cafe" })).isError, "no package before approval");
  assert.ok((await call("piece_handoff", { piece: id, action: "approve", brand: "cafe" })).isError, "approval is the user's: needs confirmedByUser");
  assert.ok(!(await call("piece_handoff", { piece: id, action: "approve", confirmedByUser: true, brand: "cafe" })).isError);
  const pack = JSON.parse((await call("piece_handoff", { piece: id, action: "package", brand: "cafe" })).text);
  assert.ok(pack.files.includes("PUBLISH.md") && pack.files.includes("caption-instagram.txt") && pack.files.some((f) => /^01\./.test(f)));

  const tpl = await call("template", { action: "save", piece: id, name: "three-step guide", brand: "cafe" });
  assert.ok(!tpl.isError, tpl.text);
  assert.equal(JSON.parse((await call("template", { action: "list", brand: "cafe" })).text)[0].name, "three-step-guide");

  const copy = await call("piece_duplicate", { from: id, slug: "cold brew es", language: "es", date: "2026-12-04", brand: "cafe" });
  assert.ok(!copy.isError, copy.text);
  assert.match(copy.text, /Translate every slot/);
});

test("the brand brief is saved with the brand", async () => {
  const r = JSON.parse((await call("brief_interview", { kind: "brand", brand: "cafe", rounds: 1, known: { name: "Test Coffee", what: "Specialty coffee for offices" } })).text);
  assert.equal(r.savedTo, "brands/cafe/brief.json");
});

test("brand_write requires confirmation on a loaded brand", async () => {
  const r = await call("brand_write", { brand: "cafe", file: "tokens.css", content: ":root{}", confirmedByUser: false });
  assert.ok(r.isError);
  assert.match(r.text, /confirmedByUser/);
  assert.ok((await call("brand_write", { brand: "_demo", file: "calendar.md", content: "x", confirmedByUser: true })).isError, "does not edit the demo brand");
});

test("stock: no bundled keys, Openverse always on, Unsplash via the user's own key in .env", async () => {
  const before = JSON.parse((await call("stock_status")).text);
  assert.deepEqual(before.map((p) => p.id).sort(), ["openverse", "unsplash"]);
  assert.equal(before.find((p) => p.id === "openverse").connected, true);
  const run = (argv, env = {}) => spawnSync(process.execPath, [path.join(PKG, "bin/opency.mjs"), "stock", ...argv], { cwd: ws, encoding: "utf8", env: { ...process.env, UNSPLASH_ACCESS_KEY: "", OPENCY_HOME: ws, ...env } });
  assert.match(run(["connect", "unsplash"]).stderr, /own terminal|--key/, "without a TTY it never reads a key from the agent");
  assert.notEqual(run(["connect", "unsplash", "--key", "short"]).status, 0);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.join(ws, ".env"), "UNSPLASH_ACCESS_KEY=fake_key_only_for_this_test_0000\n");
  const st = JSON.parse(run(["status", "--json"], { UNSPLASH_ACCESS_KEY: undefined }).stdout);
  assert.equal(st.find((p) => p.id === "unsplash").connected, true, "reads the key from the workspace .env");
  assert.equal(run(["disconnect", "unsplash"]).status, 0);
  assert.equal(JSON.parse(run(["status", "--json"], { UNSPLASH_ACCESS_KEY: undefined }).stdout).find((p) => p.id === "unsplash").connected, false);
});

test("asset_add rejects internal addresses", async () => {
  const r = await call("asset_add", { source: "http://127.0.0.1:9/x.jpg", description: "internal test", brand: "cafe" });
  assert.ok(r.isError);
  assert.match(r.text, /[Pp]rivate or internal/);
});

test("live stock: search, import and analyze (Openverse)", { skip: !NET && "set OPENCY_TEST_NETWORK=1" }, async () => {
  const s = await call("stock_search", { query: "cold brew coffee glass", orientation: "portrait", n: 4, brand: "cafe" });
  assert.ok(!s.isError, s.text);
  const data = JSON.parse(s.content[0].text);
  assert.ok(data.results.length > 0, "has results");
  assert.ok(s.images.length > 0, "attaches previews");
  const pick = data.results.sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const imp = await call("stock_import", { ref: pick.ref, description: "glass of cold brew", brand: "cafe" });
  assert.ok(!imp.isError, imp.text);
  assert.equal(imp.images.length, 1);
  const list = JSON.parse((await call("asset_list", { brand: "cafe" })).text);
  assert.equal(list.length, 1);
  assert.ok(list[0].credit && list[0].license, "records credit and license");
  assert.ok(!(await call("asset_analyze", { id: list[0].id, focal: { x: 0.5, y: 0.4 }, protect: [{ kind: "subject", x: 0.3, y: 0.2, w: 0.4, h: 0.6 }], brand: "cafe" })).isError);
  assert.equal(JSON.parse((await call("asset_list", { brand: "cafe" })).text)[0].analyzed, true);
});

test("no workspace anywhere: the first call creates the default one and says where", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "opency-home-"));
  const elsewhere = await mkdtemp(path.join(os.tmpdir(), "opency-cwd-"));
  const fresh = new Client({ name: "opency-test-fresh", version: "0" });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  delete env.OPENCY_HOME;
  await fresh.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(PKG, "mcp/server.mjs")], cwd: elsewhere, env }));
  try {
    const r = await fresh.callTool({ name: "workspace_status", arguments: {} });
    const text = r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    assert.match(text, /Workspace created at/);
    assert.ok(text.includes(path.join(home, "opency")));
    const { existsSync } = await import("node:fs");
    assert.ok(existsSync(path.join(home, "opency/brands/_demo/brand.json")));
    assert.ok(existsSync(path.join(home, "opency/templates/base/base.css")));
  } finally { await fresh.close(); await rm(home, { recursive: true, force: true }); await rm(elsewhere, { recursive: true, force: true }); }
});
