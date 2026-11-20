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
  const read = await call("piece_read", { piece: id, files: ["slide-01.html"] });
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
