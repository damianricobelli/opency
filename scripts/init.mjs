#!/usr/bin/env node
// Creates an opency workspace in a folder.
//
//   npx opency init [folder] [--force] [--no-demo]
//
// Copies: AGENTS.md + references/ (the agent's instructions), templates/ (base and layouts),
// brands/_demo (demo brand), .claude/agents/ (reviewer) and .mcp.json.
// Never overwrites existing files unless --force. The user's own brands/ are never touched.

import { cp, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { PKG, parseArgs } from "./lib/project.mjs";

const args = parseArgs(process.argv.slice(2));
const dest = path.resolve(args._[0] ?? ".");
const force = !!args.force;
const done = [], kept = [];

async function put(rel, content) {
  const file = path.join(dest, rel);
  if (existsSync(file) && !force) return kept.push(rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  done.push(rel);
}
async function copyTree(from, rel, filter = () => true) {
  const to = path.join(dest, rel);
  if (path.resolve(from) === path.resolve(to)) return kept.push(rel + "/");
  if (existsSync(to) && !force) return kept.push(rel + "/");
  await cp(from, to, { recursive: true, force: true, filter: (src) => !/\.DS_Store$|brands[\\/].*[\\/](render|versions)([\\/]|$)/.test(src) && filter(src) });
  done.push(rel + "/");
}

await mkdir(dest, { recursive: true });

// Agent instructions: SKILL.md without its frontmatter is the workspace AGENTS.md.
const skill = await readFile(path.join(PKG, "skills/opency/SKILL.md"), "utf8");
await put("AGENTS.md", skill.replace(/^---[\s\S]*?---\s*/, ""));
await put("CLAUDE.md", "@AGENTS.md\n");
await copyTree(path.join(PKG, "skills/opency/references"), "references");
await copyTree(path.join(PKG, "templates"), "templates");
await put(".claude/agents/visual-reviewer.md", await readFile(path.join(PKG, "agents/visual-reviewer.md"), "utf8"));
if (args.demo !== false && !args["no-demo"]) await copyTree(path.join(PKG, "brands/_demo"), "brands/_demo");
else await mkdir(path.join(dest, "brands"), { recursive: true });

await put(".mcp.json", JSON.stringify({ mcpServers: { opency: { command: "npx", args: ["-y", "opency", "mcp"] } } }, null, 2) + "\n");
await put(".gitignore", "node_modules/\n.DS_Store\n.env\n**/render/.frames-*/\n**/.check.html\n");

const brands = (await readdir(path.join(dest, "brands"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory() && !d.name.startsWith("_")).map((d) => d.name);
console.log(`✓ opency workspace at ${dest}`);
if (done.length) console.log(`  created: ${done.join(", ")}`);
if (kept.length) console.log(`  left untouched (already there; --force to update): ${kept.join(", ")}`);
console.log(`
Next:
  1. npx opency setup                    browser used by the renderer
  2. Open this folder with your agent (Claude Code, Cursor, Codex) and ask:
     ${brands.length ? `"Build a campaign for ${brands[0]}"` : '"Load my brand from mysite.com"'}
     The agent runs the brief with you before it designs.`);
