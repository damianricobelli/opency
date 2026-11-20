import { createFileRoute } from "@tanstack/react-router";
import { INSTALL_COMMANDS } from "@/features/landing/lib/site";
import { GITHUB_URL } from "@/lib/site";
import { currentSiteOrigin } from "@/lib/site-origin";

/** The product in plain Markdown, for agents that read a site before using it. */
function llmsText(): string {
  const origin = currentSiteOrigin();
  return `# opency

> Open source (MIT) skill and MCP server that turn an agent (Claude Code, Claude Desktop, Cursor, Codex or any MCP client) into a content team: art director, designer and copywriter. It runs locally; brands and pieces are files on the user's machine (HTML/CSS per slide, rendered with Chrome).

## What it does

- Interactive brief: asks what to convey, goal, audience, offer, tone, channels and dates before designing.
- Brand: imports colors, logo and voice from a website and installs open-licensed typefaces by name; seven color roles, three type families, verified facts with a source.
- Composing from data: the agent sends each slide as a layout plus the text for its slots; opency builds the HTML, renders and returns the contact sheet in one call. No workspace to set up: brands live in ~/opency, created on first use.
- Campaigns: carousels, posts and stories (4:5, 1:1, 9:16, 16:9), captions per network, alt text, PDF for LinkedIn, MP4 video.
- Images: the brand's own photos first, then stock from Openverse (no API key needed) and, optionally, Unsplash with your own key, with credit and license recorded.
- Quality control measured on the render: contrast over photos and gradients, safe zones per network, widows, crops that cut faces, unsourced figures, phrases that sound like AI (English and Spanish). Safe fixes are applied automatically.
- Cold review by a subagent, versions, a self-contained review page to forward to a client and a delivery folder ready to upload. A person approves; the agent never publishes on its own.

## Install

- MCP server (Claude Code): \`${INSTALL_COMMANDS.mcp}\`
- Skill: \`${INSTALL_COMMANDS.skill}\`
- Demo (renders a sample carousel locally): \`${INSTALL_COMMANDS.workspace}\`

## Links

- [Source code](${GITHUB_URL})
- [Website (English)](${origin}/)
- [Sitio (español)](${origin}/es/)
`;
}

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(llmsText(), {
          headers: {
            "Cache-Control": "public, max-age=3600",
            "Content-Type": "text/plain; charset=utf-8",
          },
        }),
    },
  },
});
