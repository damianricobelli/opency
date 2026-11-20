# opentcy

**Your agent as an agency content team.** An open-source skill and MCP server that turn Claude Code, Claude Desktop, Cursor, Codex or any MCP client into account manager, art director, designer and copywriter.

It asks what you want to say before it designs. It builds the campaign with your brand's identity. It searches Openverse and Unsplash for photos. It renders every piece and checks it at the pixel level. You approve what ships.

Everything runs on your machine and everything is a file you own: HTML/CSS per slide, PNG/JPG/PDF/MP4 ready to upload. No account, no download limits, no SaaS.

```
> I want a campaign for the cold brew launch

  What do you want to get across? If people remember one thing, what should it be?
  What has to happen for you to call it a success?
  Where will it run?  What images do we have?

  So: "cold coffee can be specialty coffee too". Here is a plan with 5 pieces…
```

## Install

Requires Node 18.17+. For video, ffmpeg.

**1. The skill** (the instructions the agent follows):

```bash
npx skills add damianricobelli/opentcy
```

**2. The workspace** (where your brands and pieces live):

```bash
npx opentcy init my-agency
```

```bash
npx opentcy setup
```

**3. The MCP server** (optional in Claude Code and Cursor, which can already run the commands; required in clients without a terminal, such as Claude Desktop):

```bash
claude mcp add opentcy -- npx -y opentcy mcp
```

In any other client:

```json
{
  "mcpServers": {
    "opentcy": {
      "command": "npx",
      "args": ["-y", "opentcy", "mcp"],
      "env": { "OPENTCY_HOME": "/path/to/my-agency" }
    }
  }
}
```

**As a Claude Code plugin** (skill + MCP server + reviewer subagent in one step):

```
/plugin marketplace add damianricobelli/opentcy
/plugin install opentcy@opentcy
```

## Usage

Open the workspace with your agent and ask:

> Load my brand from mysite.com.
> Build a campaign for the December launch.
> Carousel about automating reports, 6 slides, for Thursday.
> Adapt it to a story and make the video.
> Propose this week's content plan.

The agent answers in your language and writes the copy in the brand's language.

## How it works

1. **Brief.** Before a campaign or a new brand, it asks what it needs to know, a few questions at a time: what you want to get across, objective, audience, offer, tone, channels, dates, images. It does not ask what it can infer from the brand or the website. Over MCP the questions arrive as a form.
2. **Brand.** It reads colors, typefaces, logo and copy from a website and proposes 7 color roles, 3 font families, a voice with hard rules and a list of verified facts. It writes them when you say yes. Several brands can live in one workspace.
3. **Plan.** Each piece of the campaign proves the message from a different angle. You approve the plan before anything is designed.
4. **Images.** Your own photos first. Then stock: it searches Openverse and (if you connect it) Unsplash at once, looks at the previews, imports only the chosen photo at full resolution and records author and license. It marks the focal point and faces so they are never cropped.
5. **Pieces.** HTML/CSS with the brand's tokens, on top of 14 tested layouts. Formats 4:5, 1:1, 9:16 and 16:9. Captions per network, alt text, PDF for LinkedIn and MP4 video.
6. **Quality control.** Measured on the actual render, not on the code.
7. **Cold review.** A subagent that did not see the process looks at the contact sheet and returns up to 5 findings.
8. **You decide.** opentcy never publishes on its own.

## What the render checks

- **Pixel-level contrast**, including over photos and gradients, and logo contrast against its background.
- **Text:** headline widows, overlaps, clipping, sizes unreadable on a phone and each layout's character budget.
- **Zones:** safe area and the strip each network's UI covers.
- **Composition:** content crammed or sunk, dead space and too much accent color.
- **Consistency across slides:** a bottom bar that moves, mixed textures, the same layout repeated.
- **Photos:** upscaled beyond their resolution, crops that cut faces, text over the subject, unregistered or vetoed images.
- **Brand:** colors outside the tokens and fonts that failed to load.
- **Copy:** "AI-sounding" phrases, mixed form of address, subheads that repeat the headline, figures without a source (checked one by one), filler hashtags, generic CTAs, per-network limits and missing alt text.

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

Also: the skill's instructions as resources (`opentcy://guide/…`) and three prompts (`new-campaign`, `load-brand`, `weekly-plan`).

Tools that render or search return **images**, not just text: the agent sees the contact sheet and the stock previews before it decides. `brief_interview` uses MCP *elicitation* when the client supports it and otherwise returns the questions for the chat.

## Stock photo providers

| Provider | Key | License |
|---|---|---|
| [Openverse](https://openverse.org) | None needed | Only CC0, public domain and CC BY (attribution is recorded) |
| [Unsplash](https://unsplash.com/developers) | Your own Access Key (free) | Unsplash License |

Openverse works out of the box. Unsplash is optional and uses **your own** account: opentcy ships no keys.

```bash
npx opentcy stock connect unsplash
```

It walks you through creating a free app in your Unsplash account, asks for the Access Key with hidden input, checks it and saves it to the workspace's git-ignored `.env`. Requests then count against your own quota (50 per hour on a demo app). `npx opentcy stock status` shows what is connected. Once connected, a search queries both providers in parallel and interleaves the results.

## Commands

| Command | What it does |
|---|---|
| `npx opentcy init [folder]` | Creates a workspace |
| `npx opentcy setup` · `doctor` | Installs the render browser · checks the environment |
| `npx opentcy mcp` | MCP server (stdio) |
| `npx opentcy brief questions [brand\|campaign\|piece]` | The questions of each brief |
| `npx opentcy campaign new / brief / plan / status / list` | Campaigns |
| `npx opentcy brand list / use / new / import <url> / check` | Brands |
| `npx opentcy new <slug> --layouts cover-type,steps,closer` | New piece (`--campaign`, `--from`, `--format`) |
| `npx opentcy render <piece>` | PNG, JPG, contact sheet, captions and report (`--pdf`, `--scale 2`) |
| `npx opentcy dev <piece>` | Live preview with editable text |
| `npx opentcy version <piece> save / list / diff / restore` | Versions, without relying on git |
| `npx opentcy motion <piece> --slides all --audio track.mp3` | MP4 video |
| `npx opentcy assets add / stock / stock-import / analyze / veto / list` | Images |
| `npx opentcy stock status / connect unsplash / disconnect unsplash` | Stock providers |
| `npx opentcy feed` · `results` | Feed rhythm · what performed best |

All of them accept `--brand <slug>`. The workspace is the folder that contains `brands/`, or the one `OPENTCY_HOME` points to.

## Known limits

- **Publishing:** opentcy does not publish to social networks. It leaves everything ready in `render/`, or uses the publishing MCP you connect (Buffer, Metricool, Postiz…), with your confirmation on every send.
- **Image generation:** no model is included. It works with your photos, stock providers and typography.
- **Unsplash:** implemented against its API, but the automated tests only cover Openverse (no key required).
- **Photos with people:** the face-crop check depends on the agent marking the regions correctly.
- **Video:** no automatic subtitles or voice-over.
- **Copy linter:** the cliché phrase lists target Spanish-language copy. Structural checks (figures without a source, limits, alt text, repeated subheads) apply to any language.
- **Demo brand:** `brands/_demo` and the sample copy in the layouts are in Spanish.

## Development

```bash
npm install
npm test                          # engine + MCP server
OPENTCY_TEST_NETWORK=1 npm test   # adds the live stock test
```

The landing page lives in [`web/`](web) (TanStack Start). Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
