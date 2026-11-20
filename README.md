<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/hero-dark.webp">
    <img src=".github/assets/hero-light.webp" alt="opency: your agency's content team, inside your agent" width="100%">
  </picture>
</p>

<h1 align="center">opency</h1>

<p align="center">
  <strong>Your agency's content team, inside your agent.</strong><br>
  An open-source skill and MCP server that turn Claude Code, Claude Desktop, Cursor, Codex or any MCP client<br>
  into account manager, art director, designer and copywriter.
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-111111"></a>
  <img alt="Node 18.17+" src="https://img.shields.io/badge/node-%E2%89%A518.17-111111">
  <img alt="MCP server" src="https://img.shields.io/badge/MCP-server-e8502a">
  <img alt="Agent skill" src="https://img.shields.io/badge/agent-skill-e8502a">
  <img alt="Local first" src="https://img.shields.io/badge/local--first-no%20account-111111">
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#what-the-render-checks">Quality control</a> ·
  <a href="#mcp-tools">MCP tools</a> ·
  <a href="#commands">Commands</a>
</p>

---

It asks what you want to say before it designs. It builds the campaign with your brand's identity. It finds photos on Openverse and Unsplash. It renders every piece and checks it at the pixel level. **You approve what ships.**

Everything runs on your machine and everything is a file you own: HTML/CSS per slide, PNG/JPG/PDF/MP4 ready to upload. No account, no download limits, no SaaS.

<p align="center">
  <img src=".github/assets/example-carousel.webp" alt="A five-slide carousel produced by opency: cover, statement, steps, comparison and closer" width="100%">
  <br><sub>A carousel straight out of <code>npx opency render</code>: five slides, one material, zero errors.</sub>
</p>

## Why opency

| | |
|---|---|
| **It asks first** | A short, interactive brief before any campaign: what you want to get across, to whom, where and by when. It never asks what it can read from your brand or your website. |
| **It stays on brand** | Colors, typefaces, logo and voice are read from your site and stored as tokens. Every piece is built from them, never from scratch. |
| **It checks its own work** | Contrast, safe zones, widows, cropped faces and unsourced figures are measured on the actual render, then a fresh subagent reviews the result cold. |
| **It is yours** | Open source, local-first, plain files in a folder. Several brands per workspace, ready for agencies from day one. |

## Install

Requires Node 18.17+ and Chrome (or the bundled Chromium). For video, ffmpeg.

**1. The skill** — the instructions the agent follows:

```bash
npx skills add damianricobelli/opency
```

**2. The workspace** — where your brands and pieces live:

```bash
npx opency init my-agency
```

```bash
npx opency setup
```

**3. The MCP server** — optional in Claude Code and Cursor, which can already run the commands; required in clients without a terminal, such as Claude Desktop:

```bash
claude mcp add opency -- npx -y opency mcp
```

<details>
<summary>Any other MCP client</summary>

```json
{
  "mcpServers": {
    "opency": {
      "command": "npx",
      "args": ["-y", "opency", "mcp"],
      "env": { "OPENCY_HOME": "/path/to/my-agency" }
    }
  }
}
```

</details>

<details>
<summary>As a Claude Code plugin (skill + MCP server + reviewer subagent in one step)</summary>

```
/plugin marketplace add damianricobelli/opency
/plugin install opency@opency
```

</details>

Then open the workspace with your agent and ask:

> Load my brand from mysite.com.<br>
> Build a campaign for the December launch.<br>
> Carousel about automating reports, 6 slides, for Thursday.<br>
> Adapt it to a story and make the video.<br>
> Propose this week's content plan.

The agent answers in your language and writes the copy in the brand's language.

## How it works

```mermaid
flowchart LR
    A([Your request]) --> B[Brief]
    B --> C[Brand kit]
    C --> D[Campaign plan]
    D --> E[Copy]
    E --> F[Images]
    F --> G[Compose<br/>HTML/CSS]
    G --> H{Render +<br/>quality checks}
    H -- errors --> G
    H -- clean --> I[Cold review]
    I --> J([You approve])
```

### 1. It asks before it designs

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/brief-dark.webp">
    <img src=".github/assets/brief-light.webp" alt="The interactive brief: the agent asks what you want to convey, audience, channels and verified facts, then produces the piece" width="100%">
  </picture>
</p>

Before a campaign or a new brand, the agent runs a brief a few questions at a time: what you want to get across, objective, audience, offer, tone, channels, dates, images. What it can infer from the brand or the website, it proposes instead of asking. Over MCP the questions arrive as a form (`brief_interview` uses MCP elicitation when the client supports it).

The one question it never skips: **what do you want to get across?** The answer becomes the thesis every piece has to prove.

### 2. It learns your brand

`npx opency brand import mysite.com` reads colors by surface, ink colors, typefaces, logo and copy from a website. The agent proposes 7 color roles, 3 font families, a voice made of hard rules and a list of verified facts, and writes them only when you say yes. Several brands can live in one workspace.

### 3. It plans, then builds

Each piece of the campaign proves the message from a different angle, and you approve the plan before anything is designed. Pieces are HTML/CSS using the brand's tokens, composed from 14 tested layouts:

<p align="center">
  <img src=".github/assets/layouts.webp" alt="The 14 slide layouts: type cover, photo cover, statement, big number, steps, comparison, photo card, data bars, testimonial, closer, news cards, app window, logo grid and co-brand" width="100%">
</p>

Formats 4:5, 1:1, 9:16 and 16:9. Captions per network, alt text, PDF for LinkedIn and MP4 video.

### 4. It finds the right photo

Your own photos come first. Then stock: one search queries the available providers in parallel, the agent **looks at the previews**, imports only the chosen photo at full resolution and records author and license. It marks the focal point and the faces so they are never cropped or covered by text.

| Provider | Key | License |
|---|---|---|
| [Openverse](https://openverse.org) | None needed | Only CC0, public domain and CC BY (attribution is recorded) |
| [Unsplash](https://unsplash.com/developers) | Your own Access Key (free) | Unsplash License |

Openverse works out of the box. Unsplash is optional and uses **your own** account — opency ships no keys:

```bash
npx opency stock connect unsplash
```

It walks you through creating a free app in your Unsplash account, asks for the Access Key with hidden input, checks it and saves it to the workspace's git-ignored `.env`. Requests count against your own quota (50 per hour on a demo app).

### 5. It measures the render, not the intent

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/quality-dark.webp">
    <img src=".github/assets/quality-light.webp" alt="Quality control: contrast over photos, safe zones, widows, face crops, unsourced figures and AI-sounding phrases" width="100%">
  </picture>
</p>

Every piece is rendered with Chrome and checked pixel by pixel. Nothing is delivered with errors, and passing checks is not aesthetic approval — so a subagent that did not see the process reviews the contact sheet cold and returns up to 5 findings.

### 6. You decide

opency never publishes on its own. It leaves everything ready in `render/`, and you approve, adjust or veto.

## What the render checks

- **Pixel-level contrast**, including over photos and gradients, and logo contrast against its background.
- **Text:** headline widows, overlaps, clipping, sizes unreadable on a phone and each layout's character budget.
- **Zones:** safe area and the strip each network's UI covers.
- **Composition:** content crammed or sunk, dead space and too much accent color.
- **Consistency across slides:** a bottom bar that moves, mixed textures, the same layout repeated.
- **Photos:** upscaled beyond their resolution, crops that cut faces, text over the subject, unregistered or vetoed images.
- **Brand:** colors outside the tokens and fonts that failed to load.
- **Copy:** "AI-sounding" phrases, mixed form of address, subheads that repeat the headline, figures without a source (checked one by one), filler hashtags, generic CTAs, per-network limits and missing alt text.

<details>
<summary>What a report looks like when things go wrong</summary>

An excerpt of the real report for the deliberately broken fixture used in the test suite:

```
# Quality report — defects

4:5 · 1 slide(s) · ×1 · 7 errors · 11 warnings

## Slide 1 (flat)
- warning `outside_safe_area` #out — text outside the safe area
- warning `illegible_text_size` #tiny — 14 px on canvas = 5.1 pt on a phone (min. 10.5)
- **ERROR** `headline_orphan` #headline — last line has a single word: "sola"
- **ERROR** `critical_overlap` #a — overlaps #b
- **ERROR** `external_image` img — external image: download it into assets/ and register it
- **ERROR** `placeholder_left` — {{…}} placeholders left unfilled
- warning `over_budget` #headline — 43 characters; this layout is designed for ~20
- warning `unreadable_contrast` #low — contrast 4.18:1 (min. 4.5:1)
- warning `brand_literal_color` — colors outside tokens: #777777

## Copy and captions
- **ERROR** `unsourced_figure` slide 1 #claim — "40%": unsourced figure
- warning `copy_too_many_hashtags` caption instagram — 4 hashtags (max. 3)
- warning `copy_generic_cta` caption instagram — generic CTA: name the object (what, where, how)
- warning `missing_alt_text` slides 1 — missing alt text
```

</details>

## What you get

A workspace is a folder of plain files. Nothing is locked in a database.

```
my-agency/
├── AGENTS.md · references/          the agent's instructions
├── templates/                       base.css and the 14 layouts
└── brands/
    └── acme/
        ├── brand.json               form of address, logos, pillars, verified facts
        ├── brand-kit.md             voice, color roles, standing instructions
        ├── tokens.css               the actual colors, typefaces and scale
        ├── assets/                  logos, photos, stock, fonts + assets.json
        ├── campaigns/winter/        brief.json, brief.md and the piece plan
        └── pieces/2026-12-01-launch/
            ├── piece.json           direction, copy, captions, sources, history
            ├── slide-01.html …      one HTML file per slide
            ├── versions/            saved versions, no git required
            └── render/              slide-NN.png/jpg, contact-sheet.png, carousel.pdf,
                                     caption-*.txt, alt-text.txt, report.md
```

## MCP tools

| Group | Tools |
|---|---|
| Workspace | `workspace_status` · `workspace_init` · `doctor` · `skill_guide` |
| Brand | `brand_list` · `brand_get` · `brand_create` · `brand_use` · `brand_import_site` · `brand_check` · `brand_write` |
| Brief | `brief_questions` · `brief_interview` |
| Campaigns | `campaign_create` · `campaign_brief` · `campaign_plan` · `campaign_status` · `campaign_list` |
| Images | `stock_status` · `stock_search` · `stock_import` · `asset_add` · `asset_analyze` · `asset_view` · `asset_list` · `asset_veto` |
| Pieces | `layouts_list` · `piece_create` · `piece_list` · `piece_read` · `piece_write` · `piece_render` · `piece_view` · `piece_version` · `piece_motion` |
| Feed and results | `feed_check` · `results_add` · `results_summary` |

Also: the skill's instructions as resources (`opency://guide/…`) and three prompts (`new-campaign`, `load-brand`, `weekly-plan`).

- **Tools return images, not just text.** The agent sees the contact sheet and the stock previews before it decides.
- **One implementation.** Every tool runs the same script as the CLI, so MCP and terminal never drift apart.
- **Guardrails built in.** `brand_write` refuses to overwrite a loaded brand without the user's confirmation, slides cannot contain scripts, downloads reject private addresses, and API keys never travel through the chat.

## Commands

| Command | What it does |
|---|---|
| `npx opency init [folder]` | Creates a workspace |
| `npx opency setup` · `doctor` | Installs the render browser · checks the environment |
| `npx opency mcp` | MCP server (stdio) |
| `npx opency brief questions [brand\|campaign\|piece]` | The questions of each brief |
| `npx opency campaign new / brief / plan / status / list` | Campaigns |
| `npx opency brand list / use / new / import <url> / check` | Brands |
| `npx opency new <slug> --layouts cover-type,steps,closer` | New piece (`--campaign`, `--from`, `--format`) |
| `npx opency render <piece>` | PNG, JPG, contact sheet, captions and report (`--pdf`, `--scale 2`) |
| `npx opency dev <piece>` | Live preview with editable text |
| `npx opency version <piece> save / list / diff / restore` | Versions, without relying on git |
| `npx opency motion <piece> --slides all --audio track.mp3` | MP4 video |
| `npx opency assets add / stock / stock-import / analyze / veto / list` | Images |
| `npx opency stock status / connect unsplash / disconnect unsplash` | Stock providers |
| `npx opency feed` · `results` | Feed rhythm · what performed best |

All of them accept `--brand <slug>`. The workspace is the folder that contains `brands/`, or the one `OPENCY_HOME` points to.

## Known limits

- **Publishing:** opency does not publish to social networks. It leaves everything ready in `render/`, or uses the publishing MCP you connect (Buffer, Metricool, Postiz…), with your confirmation on every send.
- **Image generation:** no model is included. It works with your photos, stock providers and typography.
- **Unsplash:** implemented against its API, but the automated tests only cover Openverse (no key required).
- **Photos with people:** the face-crop check depends on the agent marking the regions correctly.
- **Video:** no automatic subtitles or voice-over.
- **Copy linter:** the cliché phrase lists target Spanish-language copy. Structural checks (figures without a source, limits, alt text, repeated subheads) apply to any language.

## Development

```bash
git clone https://github.com/damianricobelli/opency
cd opency
pnpm install
pnpm test                          # engine + MCP server
OPENCY_TEST_NETWORK=1 pnpm test   # adds the live stock test
```

| Path | What it is |
|---|---|
| `scripts/` | The engine: each file is a command |
| `mcp/server.mjs` | The MCP server |
| `skills/opency/` | `SKILL.md` and its references: what the agent reads |
| `templates/` | `base.css` and the layouts |
| `web/` | The landing page (TanStack Start) |

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE). The fonts bundled with the demo brand are under the SIL Open Font License.
