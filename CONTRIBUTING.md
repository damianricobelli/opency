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

## Commit messages

Releases are automated from the commit history, so commits on `main` follow [Conventional Commits](https://www.conventionalcommits.org):

```
<type>(<optional scope>): <what changed, in the imperative>
```

| Type | Use it for | Release |
|---|---|---|
| `feat` | A new capability: a tool, a command, a layout, a check | minor |
| `fix` | A bug fix | patch |
| `perf` | Faster, same behavior | patch |
| `docs` | README, skill instructions, references | none |
| `refactor`, `test`, `chore`, `ci`, `build` | No change for users | none |

A breaking change adds `!` after the type (`feat!: …`) or a `BREAKING CHANGE:` footer. While the version is below 1.0 it bumps the minor.

Useful scopes: `engine`, `mcp`, `skill`, `cli`, `layouts`, `web`.

```
feat(mcp): add stock_status tool
fix(engine): keep the bottom bar aligned in 9:16
docs(skill): explain when to skip the brief
```

Changes to `skills/opency/` reach users through the repo, and changes to `scripts/`, `mcp/`, `bin/` and `templates/` reach them through npm: use `feat` or `fix` for anything in the second group that users should get.

## Releases

Nobody bumps versions or runs `npm publish` by hand.

1. Every push to `main` updates a **release PR** with the next version and the changelog.
2. Merging that PR tags the release, updates `package.json` and `.claude-plugin/plugin.json`, and publishes to npm.

CI (`.github/workflows/ci.yml`) runs the engine tests on Node 20 and 22 and the landing page's typecheck, lint and build on every PR.

## Before the PR

- `pnpm test` passes.
- If you touched `base.css` or a layout: run `node bin/opency.mjs layouts` and look at the contact sheet.
- No real brands, keys or unlicensed photos.
- One PR, one topic.
- Everything in English (see `AGENTS.md`).
