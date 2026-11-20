export const INSTALL_COMMANDS = {
  skill: "npx skills add damianricobelli/opency",
  workspace: "npx @opency/cli init",
  mcp: "claude mcp add opency -- npx -y @opency/cli mcp",
  mcpConfig: `{
  "mcpServers": {
    "opency": {
      "command": "npx",
      "args": ["-y", "@opency/cli", "mcp"]
    }
  }
}`,
} as const;
