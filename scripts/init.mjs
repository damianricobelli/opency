#!/usr/bin/env node
// Crea un workspace de opentcy en una carpeta.
//
//   npx opentcy init [carpeta] [--force] [--no-demo]
//
// Copia: AGENTS.md + references/ (las instrucciones del agente), templates/ (base y layouts),
// brands/_demo (marca de ejemplo), .claude/agents/ (revisor), .mcp.json y .env.example.
// No pisa archivos existentes salvo con --force. brands/ de la persona nunca se toca.

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

// Instrucciones del agente: el SKILL.md sin frontmatter es el AGENTS.md del workspace.
const skill = await readFile(path.join(PKG, "skills/opentcy/SKILL.md"), "utf8");
await put("AGENTS.md", skill.replace(/^---[\s\S]*?---\s*/, ""));
await put("CLAUDE.md", "@AGENTS.md\n");
await copyTree(path.join(PKG, "skills/opentcy/references"), "references");
await copyTree(path.join(PKG, "templates"), "templates");
await put(".claude/agents/revisor-visual.md", await readFile(path.join(PKG, "agents/revisor-visual.md"), "utf8"));
if (args.demo !== false && !args["no-demo"]) await copyTree(path.join(PKG, "brands/_demo"), "brands/_demo");
else await mkdir(path.join(dest, "brands"), { recursive: true });

await put(".mcp.json", JSON.stringify({ mcpServers: { opentcy: { command: "npx", args: ["-y", "opentcy", "mcp"] } } }, null, 2) + "\n");
await put(".env.example", `# Bancos de imágenes. Openverse funciona sin clave; estas dos suman catálogo (son gratis).
PEXELS_API_KEY=
UNSPLASH_ACCESS_KEY=
# Opcional: ruta a Chrome si no usás el navegador de Playwright.
# CHROME_PATH=
`);
await put(".gitignore", "node_modules/\n.DS_Store\n.env\n**/render/.frames-*/\n**/.check.html\n");

const brands = (await readdir(path.join(dest, "brands"), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory() && !d.name.startsWith("_")).map((d) => d.name);
console.log(`✓ Workspace de opentcy en ${dest}`);
if (done.length) console.log(`  creado: ${done.join(", ")}`);
if (kept.length) console.log(`  sin tocar (ya existía; --force para actualizar): ${kept.join(", ")}`);
console.log(`
Siguiente:
  1. npx opentcy setup                    navegador para el render
  2. Abrí esta carpeta con tu agente (Claude Code, Cursor, Codex) y pedile:
     ${brands.length ? `"Armá una campaña para ${brands[0]}"` : '"Cargá mi marca desde misitio.com"'}
     El agente te hace el brief antes de diseñar.`);
