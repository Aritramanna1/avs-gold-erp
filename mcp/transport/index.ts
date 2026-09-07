/**
 * AVS ERP MCP Transport Definitions (Stdio, Streamable HTTP, SSE)
 */
export const MCP_TRANSPORTS = {
  stdio: "scripts/mcp/avs-mcp-server.mjs",
  http: "https://erp.arivahly.in/api/mcp",
  protocolVersion: "2024-11-05",
} as const;
