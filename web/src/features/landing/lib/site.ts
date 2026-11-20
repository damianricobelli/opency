export const GITHUB_URL = "https://github.com/damianricobelli/opentcy";

export const INSTALL_COMMANDS = {
  skill: "npx skills add damianricobelli/opentcy",
  workspace: "npx opentcy init",
  mcp: "claude mcp add opentcy -- npx -y opentcy mcp",
  mcpConfig: `{
  "mcpServers": {
    "opentcy": {
      "command": "npx",
      "args": ["-y", "opentcy", "mcp"]
    }
  }
}`,
} as const;
