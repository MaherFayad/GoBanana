/**
 * Public origin of the GoBanana server. Today the workers.dev URL (banana-server wrangler.jsonc
 * APP_URL). Build the docs with PUBLIC_ORIGIN (and MCP_ORIGIN when the MCP host differs) set to
 * switch to the custom domain (DIST-02).
 */
function httpsOrigin(value: string | undefined): string | undefined {
	try {
		const url = new URL((value ?? '').trim());
		return url.protocol === 'https:' ? url.origin : undefined;
	} catch {
		return undefined;
	}
}
const DEFAULT_ORIGIN = 'https://gobanana-server.maherfayad55.workers.dev';
export const APP_URL = httpsOrigin(process.env.PUBLIC_ORIGIN) ?? DEFAULT_ORIGIN;
/** The MCP endpoint: banana-server/app/api/[transport]/route.ts answers only /api/mcp. */
export const MCP_URL = `${httpsOrigin(process.env.MCP_ORIGIN) ?? APP_URL}/api/mcp`;
/** The one-click link that opens claude.ai's add custom connector dialog filled in (DIST-05). */
export const ADD_TO_CLAUDE_URL = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=GoBanana&connectorUrl=${encodeURIComponent(MCP_URL)}`;
/** The same dialog in the admin settings, for Team and Enterprise owners. */
export const ADD_TO_CLAUDE_ADMIN_URL = ADD_TO_CLAUDE_URL.replace('/customize/connectors', '/admin-settings/connectors');
