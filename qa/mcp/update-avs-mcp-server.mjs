import fs from 'fs';

const serverFile = 'c:/final erp 29.08/new and final/scripts/mcp/avs-mcp-server.mjs';
let content = fs.readFileSync(serverFile, 'utf8');

// 1. Convert tool names in REGISTERED_TOOLS to underscores
content = content.replace(/name:\s*"([^"]+)"/g, (match, name) => {
  const norm = name.replace(/[\/\.]/g, '_');
  return `name: "${norm}"`;
});

// 2. Add notification handlers and resources/prompts
const methodInsertPoint = '  // 1. Initialize Handshake\n  if (method === "initialize") {';
const newHandlers = `  // 0. Notifications
  if (method.startsWith("notifications/") || method === "notifications/initialized") {
    return { jsonrpc: "2.0", id: id || null, result: {} };
  }

  // 0.1 Resources & Prompts
  if (method === "resources/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        resources: [
          {
            uri: "erp://system/info",
            name: "AVS ERP System Information",
            description: "Core ERP health, tenant status, and 995 fineness standard",
            mimeType: "application/json"
          }
        ]
      }
    };
  }
  if (method === "resources/templates/list") {
    return { jsonrpc: "2.0", id, result: { resourceTemplates: [] } };
  }
  if (method === "prompts/list") {
    return { jsonrpc: "2.0", id, result: { prompts: [] } };
  }

  // 1. Initialize Handshake
  if (method === "initialize") {`;

content = content.replace(methodInsertPoint, newHandlers);

// 3. In tools/call, normalize name
content = content.replace(
  '  if (method === "tools/call") {\n    const toolName = params.name;\n    const toolArgs = params.arguments || {};',
  '  if (method === "tools/call") {\n    const toolName = params.name;\n    const toolArgs = params.arguments || {};\n    const normToolName = (toolName || "").replace(/[\\/\\.]/g, "_");'
);

content = content.replace(
  'const toolDef = REGISTERED_TOOLS.find((t) => t.name === toolName);',
  'const toolDef = REGISTERED_TOOLS.find((t) => t.name === toolName || t.name === normToolName || t.name.replace(/[\\/\\.]/g, "_") === normToolName);'
);

content = content.replace(
  'switch (toolName) {',
  'switch (normToolName) {'
);

content = content.replace(/case "([^"]+)":/g, (match, name) => {
  const norm = name.replace(/[\/\.]/g, '_');
  if (norm !== name) {
    return `case "${norm}":\n      case "${name}":`;
  }
  return match;
});

fs.writeFileSync(serverFile, content, 'utf8');
console.log('Updated scripts/mcp/avs-mcp-server.mjs successfully');
