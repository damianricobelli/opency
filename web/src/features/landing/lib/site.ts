export const INSTALL_COMMANDS = {
  skill: "npx skills add damianricobelli/opency",
  workspace: "npx opency init",
  mcp: "claude mcp add opency -- npx -y opency mcp",
  mcpConfig: `{
  "mcpServers": {
    "opency": {
      "command": "npx",
      "args": ["-y", "opency", "mcp"]
    }
  }
}`,
} as const;
