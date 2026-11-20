# opency · working in this repo

This repository is the source of **opency**: a skill and an MCP server that turn an agent into an agency content team.

- **Here to make pieces or campaigns?** The instructions are in `skills/opency/SKILL.md` (the repo doubles as a workspace: it has `brands/` and `templates/`). Use `node bin/opency.mjs <command>` instead of `npx @opency/cli`.
- **Here to change opency?** Keep reading.

## Map

```
bin/opency.mjs              CLI: dispatches to scripts/ and starts the MCP server
scripts/                     the engine (each file is a command)
  lib/project.mjs            paths (PKG vs workspace), formats, brands, browser
  lib/brief.mjs              the brief questions: single source for CLI, MCP and docs
  lib/stock.mjs              Openverse, Unsplash and safe downloads
  lib/compose.mjs            slots: fill a layout with data instead of writing HTML
  lib/repair.mjs             the safe automatic fixes
  lib/fonts.mjs              typefaces by name (Fontsource)
  lib/copy-lint.mjs          copy linter (English and Spanish lists)
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
- **The copy linter has one block of lists per language** (`es`, `en`), chosen by the piece's language. Adding a language means adding a block, not translating one.
- **Slots are the contract between agent and layout.** A layout's editable texts are elements with an `id` and no tags inside (`scripts/lib/compose.mjs`). Give new layouts stable ids and a `data-max` budget on every text.
- **No setup step.** A workspace is created on first use (`ensureWorkspace` in `lib/project.mjs`); never tell the user to initialize one before they can try something.
- Run `pnpm test` before finishing. `OPENCY_TEST_NETWORK=1 pnpm test` adds the live stock test.
- `brands/*` is git-ignored except `_demo`: never commit real brands.
