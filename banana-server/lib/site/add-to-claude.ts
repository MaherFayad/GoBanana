/**
 * "Add to Claude" links (DIST-05). Claude's custom connector dialog opens filled in from a
 * link. The format is not in Anthropic's docs, so the manual steps stay under every button.
 *
 *   https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=GoBanana&connectorUrl=<encoded MCP URL>
 *
 * Team and Enterprise owners add a connector for the whole organization in admin settings, which
 * takes the same query on a different path.
 */
const CLAUDE_ORIGIN = "https://claude.ai";

function query(name: string, mcpUrl: string): string {
  return `modal=add-custom-connector&connectorName=${encodeURIComponent(name)}&connectorUrl=${encodeURIComponent(mcpUrl)}`;
}

export function addToClaudeUrl(name: string, mcpUrl: string): string {
  return `${CLAUDE_ORIGIN}/customize/connectors?${query(name, mcpUrl)}`;
}

export function addToClaudeAdminUrl(name: string, mcpUrl: string): string {
  return `${CLAUDE_ORIGIN}/admin-settings/connectors?${query(name, mcpUrl)}`;
}
