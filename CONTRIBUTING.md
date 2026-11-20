# Contributing

Thanks for helping. opency aims to be the reference skill and MCP server for content teams: any change that gets a piece closer to "ready to publish" is welcome.

## Setup

```bash
git clone https://github.com/damianricobelli/opency
cd opency
pnpm install
node bin/opency.mjs setup     # browser used by the renderer
pnpm test
```

The repo is both the package and a test workspace: `node bin/opency.mjs new test --brand _demo --layouts cover-type,closer`.

## What to contribute

| Contribution | Where |
|---|---|
| A new layout | `templates/layouts/` (slide + entry in `piece.json` + row in the README). It must pass `node bin/opency.mjs layouts` with 0 errors and 0 warnings. |
| A quality check | `scripts/render.mjs` or `scripts/lib/copy-lint.mjs`, with a case in `scripts/test/`. |
| A stock provider | One more provider in `scripts/lib/stock.mjs` (`search` and `get`). Only licenses that allow commercial use and modification. |
| An MCP tool | The command in `scripts/` first; then expose it in `mcp/server.mjs` and document it in `skills/opency/SKILL.md`. |
| Copy-lint rules for another language | Open an issue first so we can agree on how the lists are organized. |

## Before the PR

- `pnpm test` passes.
- If you touched `base.css` or a layout: run `node bin/opency.mjs layouts` and look at the contact sheet.
- No real brands, keys or unlicensed photos.
- One PR, one topic.
- Everything in English (see `AGENTS.md`).
