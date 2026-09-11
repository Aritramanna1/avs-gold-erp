import fs from 'fs';
import path from 'path';

const mcpIndexPath = 'c:/final erp 29.08/new and final/public/api/mcp/index.php';
let code = fs.readFileSync(mcpIndexPath, 'utf8');

// 1. Update CORS headers to include Mcp-Session-Id, Last-Event-ID, etc.
code = code.replace(
  'header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-Id, X-Branch-Id, X-MCP-Version, X-Idempotency-Key, Accept");',
  'header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-Id, X-Branch-Id, X-MCP-Version, X-Idempotency-Key, Accept, Mcp-Session-Id, Last-Event-ID, X-MCP-Tool-Limit, X-MCP-Tool-Offset");\nheader("Access-Control-Expose-Headers: Mcp-Session-Id, Content-Type, Authorization, X-MCP-Version");'
);

// 2. Replace tool names in TOOLS_REGISTRY: dots and slashes to underscores
// Let's find all "name" => "..." in TOOLS_REGISTRY
code = code.replace(/"name"\s*=>\s*"([^"]+)"/g, (match, name) => {
  const norm = name.replace(/[\/\.]/g, '_');
  return `"name" => "${norm}"`;
});

// 3. Ensure inputSchema properties and annotations are standardized
// Let's make sure that empty properties array is (object)[] or new stdClass()
// and annotations contains riskLevel, readWrite, requiredPermission, confirmationRequired

console.log('Processed name replacements.');
fs.writeFileSync(mcpIndexPath, code);
console.log('Saved basic replacements.');
