export const MCP_URL = `${process.env.NEXT_PUBLIC_BASE_URL}/api/transport/mcp`;

// Cursor deeplink: cursor://anysphere.cursor-deeplink/mcp/install?name=...&config=...
// https://cursor.com/docs/context/mcp/install-links
const CURSOR_CONFIG = { url: MCP_URL };
export const CURSOR_DEEPLINK = `cursor://anysphere.cursor-deeplink/mcp/install?name=domainstack&config=${btoa(JSON.stringify(CURSOR_CONFIG))}`;

// VS Code deeplink: vscode:mcp/install?{urlEncodedConfig}
// https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_url-handler
const VSCODE_CONFIG = { name: "domainstack", type: "http", url: MCP_URL };
export const VSCODE_DEEPLINK = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(VSCODE_CONFIG))}`;

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** `mcpServers` snippet shared by Claude Code, Claude Desktop, and Cursor. */
export const MCP_SERVERS_JSON = json({ mcpServers: { domainstack: { url: MCP_URL } } });

export const VSCODE_JSON = json({
  mcp: { servers: { domainstack: { type: "http", url: MCP_URL } } },
});

export const WINDSURF_JSON = json({ mcpServers: { domainstack: { serverUrl: MCP_URL } } });

export const CLINE_JSON = json({
  mcpServers: { domainstack: { url: MCP_URL, type: "streamableHttp" } },
});
