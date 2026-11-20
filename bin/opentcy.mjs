#!/usr/bin/env node
// opentcy: one command for the workspace, the engine and the MCP server.
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
  init: "init.mjs", doctor: "doctor.mjs", stock: "stock.mjs",
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
  if (r.status) console.log("No Playwright Chromium: Google Chrome will be used if installed, or CHROME_PATH.");
  run(script("doctor.mjs"), rest);
} else if (cmd === "--version" || cmd === "-v") {
  console.log(JSON.parse(readFileSync(path.join(PKG, "package.json"), "utf8")).version);
} else if (ENGINE[cmd]) {
  run(script(ENGINE[cmd]), rest);
} else {
  console.log(`opentcy · your agent as a content team

  Get started
    opentcy init [folder]             create a workspace: agent instructions, templates and a demo brand
    opentcy setup                     install the render browser and check the environment
    opentcy doctor                    check browser, ffmpeg, stock keys and workspace
    opentcy mcp                       MCP server (stdio) for Claude, Cursor, Codex and other clients

  Brief and campaigns
    opentcy brief questions [brand|campaign|piece]
    opentcy campaign new|brief|plan|status|list

  Brands and pieces
    opentcy brand list|use|new|import <url>|check
    opentcy new <slug> --layouts a,b,c [--campaign slug] [--format 4:5|1:1|9:16|16:9]
    opentcy render <piece> [--pdf] [--scale 2]
    opentcy dev <piece>               live preview with editable text
    opentcy version <piece> save|list|diff|restore
    opentcy motion <piece> --slides all [--audio track.mp3]
    opentcy assets add|stock|stock-import|analyze|veto|list
    opentcy stock status|connect unsplash|disconnect unsplash
    opentcy feed  ·  opentcy results  ·  opentcy layouts

  All of them accept --brand <slug>. The workspace is the folder with brands/ (or OPENTCY_HOME).
  Docs: https://github.com/damianricobelli/opentcy`);
  if (cmd && cmd !== "help" && cmd !== "--help" && cmd !== "-h") { console.error(`\n✗ Unknown command: ${cmd}`); process.exit(1); }
}
