#!/usr/bin/env node
// Stock providers: see what is connected and connect your own Unsplash account.
//
//   npx @opency/cli stock status [--json]            which providers are available
//   npx @opency/cli stock connect unsplash           asks for YOUR Unsplash Access Key (hidden input), checks it and saves it
//   npx @opency/cli stock connect unsplash --key …   same, without the prompt (for scripts)
//   npx @opency/cli stock disconnect unsplash        removes the saved key
//
// opency ships no API keys. Openverse needs none. Unsplash is optional: each user creates a free
// app in their own Unsplash account and uses its Access Key, so requests count against their own
// quota (50/hour on a demo app). The key is stored in the workspace's .env, which is git-ignored,
// and never leaves your machine except in requests to api.unsplash.com.

import { readFile, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { ROOT, parseArgs, readText } from "./lib/project.mjs";
import { PROVIDERS } from "./lib/stock.mjs";

const args = parseArgs(process.argv.slice(2));
const [cmd, name] = args._;
const fail = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const ENV = path.join(ROOT, ".env");

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    rl._writeToOutput = () => {}; // do not echo the key
    rl.question("", (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer.trim()); });
  });
}

async function setEnv(key, value) {
  const lines = (await readText(ENV)).split("\n").filter((l) => !l.startsWith(`${key}=`));
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (value) lines.push(`${key}=${value}`);
  await writeFile(ENV, lines.join("\n") + "\n");
  await chmod(ENV, 0o600).catch(() => {});
}

const providerOrFail = () => {
  const p = PROVIDERS[name];
  if (!p) fail(`Unknown provider "${name ?? ""}". Options: ${Object.keys(PROVIDERS).filter((k) => PROVIDERS[k].keyName).join(", ")}`);
  if (!p.keyName) fail(`${p.label} needs no key: it already works.`);
  return p;
};

if (cmd === "connect") {
  const p = providerOrFail();
  let key = typeof args.key === "string" ? args.key.trim() : "";
  if (!key) {
    if (!process.stdin.isTTY) fail(`Run this in your own terminal (it asks for the key with hidden input), or pass --key.\n  Get a free Access Key at ${p.signup}`);
    console.log(`Connect your ${p.label} account (free):
  1. Open ${p.signup} and sign in.
  2. "New Application" → accept the terms → give it any name.
  3. Copy the "Access Key" (not the Secret key).
`);
    key = await askHidden("Paste your Access Key (input is hidden): ");
  }
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(key)) fail("That does not look like an Access Key.");
  const res = await p.verify(key).catch((e) => ({ ok: false, error: e.message }));
  if (!res.ok) fail(`${p.label} rejected the key (${res.error}). Check that you copied the Access Key, not the Secret key.`);
  await setEnv(p.keyName, key);
  const ignored = /^\.env$/m.test(await readText(path.join(ROOT, ".gitignore")));
  console.log(`✓ ${p.label} connected. Key saved to ${path.relative(process.cwd(), ENV) || ".env"}${res.remaining ? ` · ${res.remaining} requests left this hour` : ""}`);
  if (!ignored && existsSync(path.join(ROOT, ".git"))) console.log("  ⚠ .env is not in .gitignore: add it so the key is never committed.");
} else if (cmd === "disconnect") {
  const p = providerOrFail();
  await setEnv(p.keyName, "");
  console.log(`✓ ${p.label} disconnected (key removed from .env).`);
} else if (cmd === "status" || !cmd) {
  const rows = Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, connected: !!p.key(), needsKey: !!p.keyName, license: p.license, connect: p.keyName && !p.key() ? `npx @opency/cli stock connect ${id}` : null }));
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else for (const r of rows) console.log(`${r.connected ? "✓" : "·"} ${r.label.padEnd(10)} ${r.connected ? (r.needsKey ? "connected with your key" : "works without a key") : `not connected → ${r.connect}`}`);
} else {
  console.log((await readFile(new URL(import.meta.url), "utf8")).split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
}
