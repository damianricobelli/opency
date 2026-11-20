// Prueba el servidor MCP con un cliente real sobre un workspace temporal.
// Las pruebas que salen a internet (Openverse) corren solo con OPENTCY_TEST_NETWORK=1.
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
const NET = process.env.OPENTCY_TEST_NETWORK === "1";
let ws, client, forms = [];

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 300000 });
  return { ...r, text: r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n"), images: r.content.filter((c) => c.type === "image") };
};

before(async () => {
  ws = await mkdtemp(path.join(os.tmpdir(), "opentcy-test-"));
  const init = spawnSync(process.execPath, [path.join(PKG, "bin/opentcy.mjs"), "init", ws], { encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  client = new Client({ name: "opentcy-test", version: "0" }, { capabilities: { elicitation: {} } });
  // La "persona": responde el formulario del brief.
  client.setRequestHandler(ElicitRequestSchema, async (req) => {
    forms.push(req.params);
    const answers = { message: "El café frío también es de especialidad", objective: "Ventas de algo puntual", audience: "oficinistas del centro", channels: "Instagram feed", dates: "diciembre", cta: "Pedí por la app", visuals: "Fotos de banco" };
    return { action: "accept", content: Object.fromEntries(Object.keys(req.params.requestedSchema.properties).filter((k) => answers[k]).map((k) => [k, answers[k]])) };
  });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(PKG, "mcp/server.mjs")], cwd: ws, env: { ...process.env, OPENTCY_HOME: ws } }));
});
after(async () => { await client?.close(); await rm(ws, { recursive: true, force: true }); });

test("expone herramientas, recursos y prompts", async () => {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name);
  for (const n of ["workspace_status", "skill_guide", "brief_interview", "campaign_create", "stock_search", "stock_import", "asset_analyze", "piece_create", "piece_write", "piece_render", "feed_check"]) assert.ok(names.includes(n), `falta ${n}`);
  assert.ok(tools.every((t) => t.description && t.inputSchema), "toda herramienta tiene descripción y esquema");
  assert.ok((await client.listResources()).resources.some((r) => r.uri === "opentcy://guide/core"));
  assert.deepEqual((await client.listPrompts()).prompts.map((p) => p.name).sort(), ["cargar-marca", "nueva-campana", "plan-semanal"]);
});

test("workspace_status y skill_guide", async () => {
  const s = JSON.parse((await call("workspace_status")).text);
  assert.equal(s.ready, true);
  assert.ok(s.stock.available.includes("openverse"));
  assert.match((await call("skill_guide", { topic: "brief" })).text, /¿Qué querés transmitir\?/);
});

test("marca → brief con formulario → campaña → plan", async () => {
  assert.ok(!(await call("brand_create", { slug: "cafe", name: "Café Prueba" })).isError);
  assert.ok(!(await call("campaign_create", { slug: "verano", name: "Verano" })).isError);
  forms = [];
  const r = JSON.parse((await call("brief_interview", { kind: "campaign", campaign: "verano", known: { message: "El café frío también es de especialidad" } })).text);
  assert.equal(r.mode, "formulario");
  assert.ok(forms.length >= 1 && forms.length <= 3, "pregunta por tandas");
  assert.ok(forms.every((f) => Object.keys(f.requestedSchema.properties).length <= 4), "no más de 4 preguntas por tanda");
  assert.ok(!("message" in forms[0].requestedSchema.properties), "no vuelve a preguntar lo que ya sabe");
  assert.equal(r.readyToDesign, true);
  assert.equal(r.savedTo, "verano");
  const plan = await call("campaign_plan", { campaign: "verano", pieces: [{ slug: "por-que-frio", angle: "El cold brew se extrae 16 horas", intent: "enseñar", format: "4:5", date: "2026-12-01" }] });
  assert.ok(!plan.isError, plan.text);
  const st = JSON.parse((await call("campaign_status", { campaign: "verano" })).text);
  assert.equal(st.pendingFromPlan.length, 1);
});

test("sin formulario disponible, devuelve las preguntas para el chat", async () => {
  const r = JSON.parse((await call("brief_interview", { kind: "piece", rounds: 1, known: { message: "x", intent: "Enseñar" } })).text);
  assert.equal(r.readyToDesign, true);
  assert.equal(r.missingRequired.length, 0);
});

test("pieza: crear, leer, escribir, renderizar y ver", async () => {
  const c = await call("piece_create", { slug: "por-que-frio", layouts: ["cover-type", "steps", "closer"], campaign: "verano", date: "2026-12-01" });
  assert.ok(!c.isError, c.text);
  const id = "2026-12-01-por-que-frio";
  const read = await call("piece_read", { piece: id, files: ["slide-01.html"] });
  assert.match(read.text, /<main class="canvas/);
  const html = read.text.split("=====\n")[1];
  assert.ok((await call("piece_write", { piece: id, files: [{ file: "slide-01.html", content: html + "<script>alert(1)</script>" }] })).isError, "rechaza <script>");
  assert.ok((await call("piece_write", { piece: id, files: [{ file: "../x.html", content: "x" }] })).isError, "rechaza rutas fuera de la pieza");
  assert.ok(!(await call("piece_write", { piece: id, files: [{ file: "slide-01.html", content: html }] })).isError);
  const r = await call("piece_render", { piece: id });
  assert.ok(!r.isError, r.text);
  assert.match(r.text, /0 errores/);
  assert.equal(r.images.length, 1, "devuelve la hoja de contacto");
  assert.equal((await call("piece_view", { piece: id, slide: 1 })).images.length, 1);
  const st = JSON.parse((await call("campaign_status", { campaign: "verano" })).text);
  assert.equal(st.pieces.length, 1);
  assert.equal(st.pieces[0].errors, 0);
});

test("brand_write exige confirmación sobre una marca cargada", async () => {
  const r = await call("brand_write", { brand: "cafe", file: "tokens.css", content: ":root{}", confirmedByUser: false });
  assert.ok(r.isError);
  assert.match(r.text, /confirmedByUser/);
  assert.ok((await call("brand_write", { brand: "_demo", file: "calendar.md", content: "x", confirmedByUser: true })).isError, "no edita la marca de ejemplo");
});

test("asset_add rechaza direcciones internas", async () => {
  const r = await call("asset_add", { source: "http://127.0.0.1:9/x.jpg", description: "prueba interna", brand: "cafe" });
  assert.ok(r.isError);
  assert.match(r.text, /privada o interna/);
});

test("stock en vivo: buscar, importar y analizar (Openverse)", { skip: !NET && "definí OPENTCY_TEST_NETWORK=1" }, async () => {
  const s = await call("stock_search", { query: "cold brew coffee glass", orientation: "portrait", n: 4, brand: "cafe" });
  assert.ok(!s.isError, s.text);
  const data = JSON.parse(s.content[0].text);
  assert.ok(data.results.length > 0, "hay resultados");
  assert.ok(s.images.length > 0, "adjunta previews");
  const pick = data.results.sort((a, b) => b.w * b.h - a.w * a.h)[0];
  const imp = await call("stock_import", { ref: pick.ref, description: "vaso de cold brew", brand: "cafe" });
  assert.ok(!imp.isError, imp.text);
  assert.equal(imp.images.length, 1);
  const list = JSON.parse((await call("asset_list", { brand: "cafe" })).text);
  assert.equal(list.length, 1);
  assert.ok(list[0].credit && list[0].license, "registra crédito y licencia");
  assert.ok(!(await call("asset_analyze", { id: list[0].id, focal: { x: 0.5, y: 0.4 }, protect: [{ kind: "subject", x: 0.3, y: 0.2, w: 0.4, h: 0.6 }], brand: "cafe" })).isError);
  assert.equal(JSON.parse((await call("asset_list", { brand: "cafe" })).text)[0].analyzed, true);
});
