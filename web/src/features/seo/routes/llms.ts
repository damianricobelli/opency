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
- Brand: imports colors, typefaces, logo and voice from a website; seven color roles, three type families, verified facts with a source.
- Campaigns: carousels, posts and stories (4:5, 1:1, 9:16, 16:9), captions per network, alt text, PDF for LinkedIn, MP4 video.
- Images: the brand's own photos first, then stock from Openverse (no API key needed) and, optionally, Unsplash with your own key, with credit and license recorded.
- Quality control measured on the render: contrast over photos and gradients, safe zones per network, widows, crops that cut faces, unsourced figures, phrases that sound like AI.
- Cold review by a subagent and versions. A person approves; the agent never publishes on its own.

## Install

- Skill: \`${INSTALL_COMMANDS.skill}\`
- Workspace: \`${INSTALL_COMMANDS.workspace}\`
- MCP server (Claude Code): \`${INSTALL_COMMANDS.mcp}\`

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
