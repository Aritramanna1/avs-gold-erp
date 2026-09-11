import fs from 'fs';
import path from 'path';

const mcpFile = 'c:/final erp 29.08/new and final/public/api/mcp/index.php';
let code = fs.readFileSync(mcpFile, 'utf8');

// 1. Ensure CORS and security headers are top quality
code = code.replace(
  /\/\/ Set Headers for JSON-RPC \/ MCP Streaming[\s\S]*?if \(\$_SERVER\['REQUEST_METHOD'\] === 'OPTIONS'\) \{/m,
`// Set Headers for JSON-RPC / MCP Streaming
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-Id, X-Branch-Id, X-MCP-Version, X-Idempotency-Key, Accept, Mcp-Session-Id, Last-Event-ID, X-MCP-Tool-Limit, X-MCP-Tool-Offset");
header("Access-Control-Expose-Headers: Mcp-Session-Id, Content-Type, Authorization, X-MCP-Version");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: SAMEORIGIN");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {`
);

// 2. Normalize all tool names in $TOOLS_REGISTRY to use underscores
// e.g. "name" => "core.get_system_status" -> "name" => "core_get_system_status"
// and "name" => "server/health" -> "name" => "server_health"
code = code.replace(/"name"\s*=>\s*"([^"]+)"/g, (match, name) => {
  const norm = name.replace(/[\/\.]/g, '_');
  return `"name" => "${norm}"`;
});

// 3. Make sure empty properties in inputSchema have new stdClass() so json_encode outputs {}
// Already done in original file, but let's ensure:
code = code.replace(/"properties"\s*=>\s*\[\]/g, '"properties" => new stdClass()');

// 4. Update the GET discovery and method handlers
const methodHandlingOld = `// Handle GET Discovery Request (MCP Manifest Discovery)
if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'HEAD') {
    $discovery = [
        "name" => $SERVER_NAME,
        "version" => $SERVER_VERSION,
        "protocolVersion" => $PROTOCOL_VERSION,
        "finenessBasisStandard" => $FINENESS_STANDARD,
        "status" => "DEPLOYED",
        "transport" => "Streamable HTTP / JSON-RPC 2.0",
        "authSupported" => ["OAuth 2.1 (PKCE S256)", "Bearer Token"],
        "authorizationServer" => OAUTH_ISSUER . "/.well-known/oauth-authorization-server",
        "toolsCount" => count($TOOLS_REGISTRY),
        "tools" => $TOOLS_REGISTRY
    ];
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode($discovery, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Read JSON-RPC Payload
$rawInput = file_get_contents('php://input');
$req = json_decode($rawInput, true);

if (!$req || !isset($req['jsonrpc']) || $req['jsonrpc'] !== '2.0') {
    http_response_code(400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => null,
        "error" => [
            "code" => -32600,
            "message" => "Invalid Request: Expected standard JSON-RPC 2.0 payload."
        ]
    ]);
    exit;
}

$method = $req['method'] ?? '';
$id = $req['id'] ?? null;
$params = $req['params'] ?? [];

// Resolve Authenticated Context (OAuth 2.1 or Bearer)
$authContext = resolveMcpAuthContext();

// ── 1. Handle initialize Handshake ──────────────────────────────────────────
if ($method === 'initialize') {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "protocolVersion" => $PROTOCOL_VERSION,
            "serverInfo" => [
                "name" => $SERVER_NAME,
                "version" => $SERVER_VERSION
            ],
            "capabilities" => [
                "tools" => ["listChanged" => false],
                "logging" => new stdClass()
            ],
            "finenessBasis" => $FINENESS_STANDARD,
            "accountingMode" => "DUAL_DIMENSION_DISCRETE"
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── 2. Handle tools/list ────────────────────────────────────────────────────
if ($method === 'tools/list') {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "tools" => $TOOLS_REGISTRY
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}`;

const methodHandlingNew = `// Handle GET Discovery Request (MCP Manifest Discovery)
if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'HEAD') {
    $discovery = [
        "name" => $SERVER_NAME,
        "version" => $SERVER_VERSION,
        "protocolVersion" => $PROTOCOL_VERSION,
        "finenessBasisStandard" => $FINENESS_STANDARD,
        "status" => "DEPLOYED",
        "transport" => "Streamable HTTP / JSON-RPC 2.0",
        "authSupported" => ["OAuth 2.1 (PKCE S256)", "Bearer Token"],
        "authorizationServer" => OAUTH_ISSUER . "/.well-known/oauth-authorization-server",
        "toolsCount" => count($TOOLS_REGISTRY),
        "tools" => $TOOLS_REGISTRY
    ];
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode($discovery, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Read JSON-RPC Payload
$rawInput = file_get_contents('php://input');
$req = json_decode($rawInput, true);

// Handle empty body or non-JSON gracefully
if (!$req || !isset($req['jsonrpc']) || $req['jsonrpc'] !== '2.0') {
    http_response_code(400);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => null,
        "error" => [
            "code" => -32600,
            "message" => "Invalid Request: Expected standard JSON-RPC 2.0 payload."
        ]
    ]);
    exit;
}

$method = $req['method'] ?? '';
$id = $req['id'] ?? null;
$params = $req['params'] ?? [];

// Resolve Authenticated Context (OAuth 2.1 or Bearer)
$authContext = resolveMcpAuthContext();

// ── Handle JSON-RPC Notifications (No Response / 200 OK with empty body) ────
if (strpos($method, 'notifications/') === 0 || $method === 'notifications/initialized' || $method === 'notifications/cancelled' || $method === 'notifications/message') {
    http_response_code(200);
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode(new stdClass());
    exit;
}

// ── Handle ping ─────────────────────────────────────────────────────────────
if ($method === 'ping') {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => new stdClass()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── 1. Handle initialize Handshake ──────────────────────────────────────────
if ($method === 'initialize') {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "protocolVersion" => $PROTOCOL_VERSION,
            "serverInfo" => [
                "name" => $SERVER_NAME,
                "version" => $SERVER_VERSION
            ],
            "capabilities" => [
                "tools" => ["listChanged" => false],
                "resources" => ["subscribe" => false, "listChanged" => false],
                "prompts" => ["listChanged" => false],
                "logging" => new stdClass()
            ],
            "finenessBasis" => $FINENESS_STANDARD,
            "accountingMode" => "DUAL_DIMENSION_DISCRETE"
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── 2. Handle resources/list & resources/read ────────────────────────────────
if ($method === 'resources/list') {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "resources" => [
                [
                    "uri" => "erp://system/info",
                    "name" => "AVS ERP System Information",
                    "description" => "Core ERP health, tenant status, and 995 fineness standard",
                    "mimeType" => "application/json"
                ]
            ]
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($method === 'resources/templates/list') {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "resourceTemplates" => []
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($method === 'resources/read') {
    $uri = $params['uri'] ?? 'erp://system/info';
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "contents" => [
                [
                    "uri" => $uri,
                    "mimeType" => "application/json",
                    "text" => json_encode([
                        "name" => $SERVER_NAME,
                        "version" => $SERVER_VERSION,
                        "status" => "OPERATIONAL",
                        "finenessStandard" => $FINENESS_STANDARD,
                        "activeTenant" => $authContext['tenantId'] ?? 'MTJ_FIRM'
                    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
                ]
            ]
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── Handle prompts/list & prompts/get ───────────────────────────────────────
if ($method === 'prompts/list') {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "prompts" => []
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($method === 'prompts/get') {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "description" => "AVS ERP Prompt",
            "messages" => []
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── Handle logging/setLevel ─────────────────────────────────────────────────
if ($method === 'logging/setLevel') {
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => new stdClass()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── 3. Handle tools/list with Diagnostic Filtering ──────────────────────────
if ($method === 'tools/list') {
    $toolsToReturn = $TOOLS_REGISTRY;

    // Diagnostic filtering support (via query params or HTTP headers)
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $limitParam = $_GET['limit'] ?? $_GET['count'] ?? $headers['X-MCP-Tool-Limit'] ?? $headers['x-mcp-tool-limit'] ?? null;
    $offsetParam = $_GET['offset'] ?? $headers['X-MCP-Tool-Offset'] ?? $headers['x-mcp-tool-offset'] ?? 0;
    $toolFilter = $_GET['tool'] ?? null;

    if (!empty($toolFilter)) {
        $normFilter = str_replace(['.', '/'], '_', $toolFilter);
        $toolsToReturn = array_values(array_filter($toolsToReturn, function($t) use ($toolFilter, $normFilter) {
            return $t['name'] === $toolFilter || $t['name'] === $normFilter || str_replace(['.', '/'], '_', $t['name']) === $normFilter;
        }));
    } elseif ($limitParam !== null && is_numeric($limitParam) && (int)$limitParam > 0) {
        $limit = (int)$limitParam;
        $offset = is_numeric($offsetParam) ? (int)$offsetParam : 0;
        $toolsToReturn = array_slice($toolsToReturn, $offset, $limit);
    }

    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "tools" => $toolsToReturn
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}`;

code = code.replace(methodHandlingOld, methodHandlingNew);

// 5. In tools/call, normalize tool name and match flexible names
const toolFindOld = `    $toolName = $params['name'] ?? '';
    $toolArgs = $params['arguments'] ?? [];

    // Find tool definition in registry
    $toolDef = null;
    foreach ($TOOLS_REGISTRY as $t) {
        if ($t['name'] === $toolName) {
            $toolDef = $t;
            break;
        }
    }`;

const toolFindNew = `    $toolName = $params['name'] ?? '';
    $toolArgs = $params['arguments'] ?? [];
    $normToolName = str_replace(['.', '/'], '_', $toolName);

    // Find tool definition in registry (supports underscore, dotted, or slashed names)
    $toolDef = null;
    foreach ($TOOLS_REGISTRY as $t) {
        if ($t['name'] === $toolName || $t['name'] === $normToolName || str_replace(['.', '/'], '_', $t['name']) === $normToolName) {
            $toolDef = $t;
            break;
        }
    }`;

code = code.replace(toolFindOld, toolFindNew);

// 6. Update auth check condition to allow both 'server/health' and 'server_health'
code = code.replace(
  "if ($toolName !== 'server/health') {",
  "if ($normToolName !== 'server_health' && $toolName !== 'server/health') {"
);

// 7. Update the giant switch statement so each case matches BOTH underscored and dotted versions
code = code.replace(/switch \(\$toolName\) \{/g, 'switch ($normToolName) {');

// In the switch cases, ensure underscored case labels match
code = code.replace(/case '([^']+)':/g, (match, caseName) => {
  const norm = caseName.replace(/[\/\.]/g, '_');
  if (norm !== caseName) {
    return `case '${norm}':\n        case '${caseName}':`;
  }
  return match;
});

fs.writeFileSync(mcpFile, code, 'utf8');
console.log('Successfully updated public/api/mcp/index.php');
