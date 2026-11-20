#!/usr/bin/env node
// opentcy: un solo comando para el workspace, el motor y el servidor MCP.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = (f) => path.join(PKG, "scripts", f);
const [cmd, ...rest] = process.argv.slice(2);

const ENGINE = {
  brand: "brand.mjs", new: "new-piece.mjs", render: "render.mjs", dev: "dev.mjs", version: "version.mjs",
  motion: "motion.mjs", assets: "assets.mjs", feed: "feed.mjs", results: "results.mjs", campaign: "campaign.mjs",
  init: "init.mjs", doctor: "doctor.mjs",
};

const run = (file, argv) => process.exit(spawnSync(process.execPath, [file, ...argv], { stdio: "inherit" }).status ?? 1);

if (cmd === "mcp") {
  await import(path.join(PKG, "mcp/server.mjs"));
} else if (cmd === "brief") {
  run(script("campaign.mjs"), ["questions", ...rest.filter((x) => x !== "questions")]);
} else if (cmd === "layouts") {
  run(script("render.mjs"), ["templates/layouts", ...rest]);
} else if (cmd === "setup") {
  const r = spawnSync("npx", ["--yes", "playwright", "install", "chromium"], { stdio: "inherit", cwd: PKG });
  if (r.status) console.log("Sin Chromium de Playwright: se usará Google Chrome si está instalado, o CHROME_PATH.");
  run(script("doctor.mjs"), rest);
} else if (cmd === "--version" || cmd === "-v") {
  console.log(JSON.parse(readFileSync(path.join(PKG, "package.json"), "utf8")).version);
} else if (ENGINE[cmd]) {
  run(script(ENGINE[cmd]), rest);
} else {
  console.log(`opentcy · tu agente como equipo de contenido

  Empezar
    opentcy init [carpeta]            crea un workspace: instrucciones del agente, plantillas y una marca de ejemplo
    opentcy setup                     instala el navegador del render y verifica el entorno
    opentcy doctor                    verifica navegador, ffmpeg, claves de stock y workspace
    opentcy mcp                       servidor MCP (stdio) para Claude, Cursor, Codex y otros clientes

  Brief y campañas
    opentcy brief questions [brand|campaign|piece]
    opentcy campaign new|brief|plan|status|list

  Marcas y piezas
    opentcy brand list|use|new|import <url>|check
    opentcy new <slug> --layouts a,b,c [--campaign slug] [--format 4:5|1:1|9:16|16:9]
    opentcy render <pieza> [--pdf] [--scale 2]
    opentcy dev <pieza>               vista previa con textos editables
    opentcy version <pieza> save|list|diff|restore
    opentcy motion <pieza> --slides all [--audio pista.mp3]
    opentcy assets add|stock|stock-import|analyze|veto|list
    opentcy feed  ·  opentcy results  ·  opentcy layouts

  Todos aceptan --brand <slug>. El workspace es la carpeta con brands/ (o OPENTCY_HOME).
  Docs: https://github.com/damianricobelli/opentcy`);
  if (cmd && cmd !== "help" && cmd !== "--help" && cmd !== "-h") { console.error(`\n✗ Comando desconocido: ${cmd}`); process.exit(1); }
}
