# opency · working in this repo

This repository is the source of **opency**: a skill and an MCP server that turn an agent into an agency content team.

- **Here to make pieces or campaigns?** The instructions are in `skills/opency/SKILL.md` (the repo doubles as a workspace: it has `brands/` and `templates/`). Use `node bin/opency.mjs <command>` instead of `npx opency`.
- **Here to change opency?** Keep reading.

## Map

```
bin/opency.mjs              CLI: dispatches to scripts/ and starts the MCP server
scripts/                     the engine (each file is a command)
  lib/project.mjs            paths (PKG vs workspace), formats, brands, browser
  lib/brief.mjs              the brief questions: single source for CLI, MCP and docs
  lib/stock.mjs              Openverse, Unsplash and safe downloads
  lib/copy-lint.mjs          copy linter
  test/                      node --test
mcp/server.mjs               MCP server (stdio): every tool runs an engine script
skills/opency/              SKILL.md + references/: what the agent reads
agents/visual-reviewer.md    cold-review subagent
templates/                   base.css and the 14 layouts
brands/_demo/                demo brand (the only one versioned)
.claude-plugin/              Claude Code plugin and marketplace manifests
web/                         landing page (TanStack Start); separate project with its own package.json
```

## Rules

- **English first.** Code, comments, CLI output, tool descriptions, docs and metadata are written in English. Brand content (copy, voice samples, captions) is written in the brand's language.
- **One implementation.** The MCP server reimplements nothing: it calls the same script as the CLI. A new capability goes into `scripts/` first, then it is exposed in `mcp/server.mjs` and documented in `skills/opency/`.
- **The brief questions live in `scripts/lib/brief.mjs`.** Do not duplicate them in the docs: `references/brief.md` explains how to ask, not what.
- **PKG vs ROOT.** `PKG` is where opency is installed; `ROOT` is the user's workspace (`OPENCY_HOME` or the folder that contains `brands/`). Anything the user edits is read from `ROOT`.
- **Nothing that publishes to social networks**, and no unofficial automation against them.
- **Every download goes through `fetchBuffer`** in `lib/stock.mjs`, which rejects private addresses.
- **The copy linter's phrase lists target Spanish-language copy.** Adding another language means adding lists, not translating the existing ones.
- Run `pnpm test` before finishing. `OPENCY_TEST_NETWORK=1 pnpm test` adds the live stock test.
- `brands/*` is git-ignored except `_demo`: never commit real brands.
