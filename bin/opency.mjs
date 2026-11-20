#!/usr/bin/env node
// opency: one command for the workspace, the engine and the MCP server.
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
  init: "init.mjs", doctor: "doctor.mjs", stock: "stock.mjs", compose: "compose.mjs", handoff: "handoff.mjs",
  template: "template.mjs", demo: "demo.mjs", repair: "repair.mjs", fonts: "fonts.mjs",
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
  console.log(`opency · your agent as a content team

  Get started
    opency demo                      render the demo carousel: see the output in a minute
    opency init [folder]             create a workspace here (otherwise ~/opency is used, created on first use)
    opency setup                     install the render browser and check the environment
    opency doctor                    check browser, ffmpeg, stock keys and workspace
    opency mcp                       MCP server (stdio) for Claude, Cursor, Codex and other clients

  Brief and campaigns
    opency brief questions [brand|campaign|piece]
    opency campaign new|brief|plan|status|list

  Brands and pieces
    opency brand list|use|new|import <url>|check
    opency fonts search|add|list     install the brand's typefaces by name
    opency compose layouts|new|edit|slots   build and edit pieces from data, no HTML
    opency repair <piece>            apply the safe fixes from the last render
    opency handoff review|status|package    client review page, approval, files ready to upload
    opency template save|list
    opency new <slug> --layouts a,b,c [--campaign slug] [--format 4:5|1:1|9:16|16:9]
    opency render <piece> [--pdf] [--scale 2]
    opency dev <piece>               live preview with editable text
    opency version <piece> save|list|diff|restore
    opency motion <piece> --slides all [--audio track.mp3]
    opency assets add|stock|stock-import|analyze|veto|list
    opency stock status|connect unsplash|disconnect unsplash
    opency feed  ·  opency results  ·  opency layouts

  All of them accept --brand <slug>. The workspace is the nearest folder with brands/, else OPENCY_HOME, else ~/opency.
  Docs: https://github.com/damianricobelli/opency`);
  if (cmd && cmd !== "help" && cmd !== "--help" && cmd !== "-h") { console.error(`\n✗ Unknown command: ${cmd}`); process.exit(1); }
}
