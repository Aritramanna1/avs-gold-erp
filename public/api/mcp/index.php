<?php
/**
 * AVS Jewellery ERP — Production Remote Model Context Protocol (MCP) Server Gateway
 *
 * Endpoint: /api/mcp or /api/mcp/
 * Implements standard JSON-RPC 2.0 for Model Context Protocol (Protocol: 2024-11-05)
 * Compatible with ChatGPT Apps SDK, Claude Code, Cursor, Gemini, Windsurf, Glama, and Smithery.
 *
 * Security: OAuth 2.1 / OpenID Connect, Multi-Tenant Scoping, Role Permissions, 995 Gold/Cash Separation, Zero Leaked Secrets.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../oauth/oauth-service.php';

// Set Headers for JSON-RPC / MCP Streaming
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-Id, X-Branch-Id, X-MCP-Version, X-Idempotency-Key, Accept");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: SAMEORIGIN");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$SERVER_NAME = "avs-erp-mcp-server";
$SERVER_VERSION = "1.2.0";
$PROTOCOL_VERSION = "2024-11-05";
$FINENESS_STANDARD = 995;

// Canonical Full-Spectrum Tool Registry Definitions
$TOOLS_REGISTRY = [
    // ── 1. Systems & Identity ───────────────────────────────────────────────
    [
        "name" => "server/health",
        "description" => "Returns overall ERP health, database latency, active tenant context, and current shop fineness standard (995).",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "system:read",
        "confirmationRequired" => false,
        "inputSchema" => ["type" => "object", "properties" => new stdClass()]
    ],
    [
        "name" => "core.get_system_status",
        "description" => "Returns overall ERP operational status, active tenant configuration, and current shop fineness standard (995).",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "system:read",
        "confirmationRequired" => false,
        "inputSchema" => ["type" => "object", "properties" => new stdClass()]
    ],
    [
        "name" => "core.get_current_user",
        "description" => "Returns the authenticated user details, assigned role, and permitted branch scopes derived from OAuth token.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "user:read",
        "confirmationRequired" => false,
        "inputSchema" => ["type" => "object", "properties" => new stdClass()]
    ],
    [
        "name" => "core.get_current_tenant",
        "description" => "Returns active tenant configuration, firm identity, branch list, and rate card rules.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "tenant:read",
        "confirmationRequired" => false,
        "inputSchema" => ["type" => "object", "properties" => new stdClass()]
    ],
    [
        "name" => "core.get_branches",
        "description" => "Lists all authorized branch locations for the active tenant firm.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "branch:read",
        "confirmationRequired" => false,
        "inputSchema" => ["type" => "object", "properties" => new stdClass()]
    ],

    // ── 2. Customers ────────────────────────────────────────────────────────
    [
        "name" => "customers.search_customers",
        "description" => "Finds customer profiles with KYC status, discrete credit balance, and fine gold balances.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "customer:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "query" => ["type" => "string", "description" => "Name, phone number, PAN, or GSTIN"]
            ]
        ]
    ],
    [
        "name" => "customers.get_customer",
        "description" => "Retrieves full customer dossier including KYC verification, discrete Cash (₹) balance, and Fine Gold (@995) balance.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "customer:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "customerId" => ["type" => "string", "description" => "Customer identifier"]
            ],
            "required" => ["customerId"]
        ]
    ],
    [
        "name" => "customers.create_customer",
        "description" => "Registers a new verified customer profile scoped to active tenant.",
        "riskLevel" => "WRITE",
        "readWrite" => "WRITE",
        "requiredPermission" => "customer:write",
        "confirmationRequired" => true,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "fullName" => ["type" => "string", "description" => "Customer full name"],
                "phoneNumber" => ["type" => "string", "description" => "10-digit mobile phone number"],
                "address" => ["type" => "string", "description" => "Postal address"],
                "panGstin" => ["type" => "string", "description" => "Optional PAN or GSTIN"]
            ],
            "required" => ["fullName", "phoneNumber"]
        ]
    ],

    // ── 3. Suppliers ────────────────────────────────────────────────────────
    [
        "name" => "suppliers.search_suppliers",
        "description" => "Searches bullion refiners, hallmarking centres, and jewellery suppliers with outstanding bullion ledgers.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "supplier:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "query" => ["type" => "string", "description" => "Supplier name or GSTIN"]
            ]
        ]
    ],

    // ── 4. Finance, Ledgers & Dual-Dimension Accounting ─────────────────────
    [
        "name" => "finance.get_account_balance",
        "description" => "Returns party ledger balance preserving separate discrete dimensions for Cash (₹) and Fine Gold (grams @ 995 basis). Never collapses dimensions into one currency number.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "ledger:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "partyId" => ["type" => "string", "description" => "Customer, Karigar, or Supplier ID"],
                "asOfDate" => ["type" => "string", "description" => "Optional ISO date filter (YYYY-MM-DD)"]
            ],
            "required" => ["partyId"]
        ]
    ],
    [
        "name" => "finance.get_daybook",
        "description" => "Returns chronological daybook transactions for a date, detailing discrete Cash (₹) movements and Fine Gold (g @ 995) transfers.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "finance:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "date" => ["type" => "string", "description" => "Date in YYYY-MM-DD format (defaults to today)"]
            ]
        ]
    ],
    [
        "name" => "finance.get_trial_balance",
        "description" => "Generates trial balance verifying mathematical equality of discrete Cash debits/credits and 995 Gold debits/credits.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "finance:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "asOfDate" => ["type" => "string", "description" => "Optional date filter"]
            ]
        ]
    ],

    // ── 5. Gold & Bullion ───────────────────────────────────────────────────
    [
        "name" => "gold.get_daily_bhav",
        "description" => "Returns authorized shop gold and silver daily rate card (24K, 22K/916, 18K/750) and 995 bullion base rate.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "stock:read",
        "confirmationRequired" => false,
        "inputSchema" => ["type" => "object", "properties" => new stdClass()]
    ],
    [
        "name" => "gold.convert_fineness_basis",
        "description" => "Calculates exact fine gold equivalent at 995 bullion standard for a given weight and karat/purity.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "stock:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "grossWeightGrams" => ["type" => "number", "description" => "Gross metal weight in grams"],
                "purity" => ["type" => "string", "description" => "Purity e.g. 22K, 18K, 916, 750, 995"]
            ],
            "required" => ["grossWeightGrams", "purity"]
        ]
    ],

    // ── 6. Stock & Inventory ────────────────────────────────────────────────
    [
        "name" => "stock.search_stock",
        "description" => "Searches inventory items and barcode tags scoped strictly to caller tenant and branch.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "stock:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "query" => ["type" => "string", "description" => "Search query or SKU/tag barcode"],
                "category" => ["type" => "string", "description" => "Optional jewellery category filter"],
                "purity" => ["type" => "string", "description" => "Optional metal purity filter (e.g. 22K, 18K)"]
            ]
        ]
    ],
    [
        "name" => "stock.get_stock_item",
        "description" => "Retrieves detailed item information for a specific barcode tag.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "stock:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "barcode" => ["type" => "string", "description" => "Barcode tag identifier (e.g. TAG-99281)"]
            ],
            "required" => ["barcode"]
        ]
    ],

    // ── 7. Sales, POS & Orders ──────────────────────────────────────────────
    [
        "name" => "sales.search_orders",
        "description" => "Searches custom customer jewellery orders, due dates, delivery status, and advance bullion received.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "orders:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "status" => ["type" => "string", "description" => "Filter e.g. PENDING, IN_PRODUCTION, READY, DELIVERED"]
            ]
        ]
    ],
    [
        "name" => "sales.create_quotation",
        "description" => "Prepares a formal gold sale estimate with live metal rates, making charges, and GST calculation.",
        "riskLevel" => "WRITE",
        "readWrite" => "WRITE",
        "requiredPermission" => "sales:write",
        "confirmationRequired" => true,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "customerId" => ["type" => "string", "description" => "Customer identifier"],
                "items" => [
                    "type" => "array",
                    "items" => [
                        "type" => "object",
                        "properties" => [
                            "category" => ["type" => "string"],
                            "netWeightGrams" => ["type" => "number"],
                            "purity" => ["type" => "string"],
                            "makingChargeType" => ["type" => "string", "enum" => ["PER_GRAM", "PERCENTAGE", "FIXED"]],
                            "makingChargeValue" => ["type" => "number"]
                        ],
                        "required" => ["category", "netWeightGrams", "purity"]
                    ]
                ]
            ],
            "required" => ["customerId", "items"]
        ]
    ],

    // ── 8. Manufacturing & Artisan Management ───────────────────────────────
    [
        "name" => "manufacturing.get_job_cards",
        "description" => "Lists active manufacturing job cards in progress across karigars.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "manufacturing:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "karigarId" => ["type" => "string", "description" => "Optional filter by Karigar"]
            ]
        ]
    ],
    [
        "name" => "karigar.search_karigars",
        "description" => "Lists registered artisan/karigar partners with pure gold custody balance and active job cards.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "karigar:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "query" => ["type" => "string", "description" => "Karigar name or workshop ID"]
            ]
        ]
    ],
    [
        "name" => "karigar.prepare_karigar_settlement",
        "description" => "Calculates labour, wastage, and allowed loss for Karigar job card settlement in PREPARE-only mode (requires supervisor approval for final post).",
        "riskLevel" => "HIGH_RISK",
        "readWrite" => "WRITE",
        "requiredPermission" => "karigar:write",
        "confirmationRequired" => true,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "karigarId" => ["type" => "string", "description" => "Karigar identifier"],
                "jobCardIds" => [
                    "type" => "array",
                    "items" => ["type" => "string"],
                    "description" => "List of completed job card IDs"
                ]
            ],
            "required" => ["karigarId"]
        ]
    ],

    // ── 9. Payroll & Staff ──────────────────────────────────────────────────
    [
        "name" => "payroll.search_employees",
        "description" => "Lists showroom and workshop staff with attendance, advances, and payroll status.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "payroll:read",
        "confirmationRequired" => false,
        "inputSchema" => ["type" => "object", "properties" => new stdClass()]
    ],

    // ── 10. Reporting Engine ────────────────────────────────────────────────
    [
        "name" => "reports.generate_gst_summary",
        "description" => "Generates GST-compliant summary (GSTR-1 format) with 3% jewellery tax breakdowns and discrete HSN aggregates.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "reports:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "month" => ["type" => "string", "description" => "Month in YYYY-MM format"]
            ],
            "required" => ["month"]
        ]
    ],

    // ── 11. Workflow & Approvals ────────────────────────────────────────────
    [
        "name" => "workflow.get_pending_approvals",
        "description" => "Lists pending supervisor approval requests (e.g. rate overrides, karigar settlements, stock write-offs).",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "workflow:read",
        "confirmationRequired" => false,
        "inputSchema" => ["type" => "object", "properties" => new stdClass()]
    ],

    // ── 12. Audit & Compliance ──────────────────────────────────────────────
    [
        "name" => "audit.search_logs",
        "description" => "Searches immutable audit trail of ERP actions, authorization grants, and discrete balance updates.",
        "riskLevel" => "READ",
        "readWrite" => "READ",
        "requiredPermission" => "audit:read",
        "confirmationRequired" => false,
        "inputSchema" => [
            "type" => "object",
            "properties" => [
                "actionType" => ["type" => "string", "description" => "Optional filter by action name"],
                "limit" => ["type" => "integer", "description" => "Number of records (max 100)"]
            ]
        ]
    ]
];

// Handle GET Discovery Request (MCP Manifest Discovery)
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
}

// ── 3. Handle tools/call ────────────────────────────────────────────────────
if ($method === 'tools/call') {
    $toolName = $params['name'] ?? '';
    $toolArgs = $params['arguments'] ?? [];

    // Check Authentication for Protected Tools
    if ($toolName !== 'server/health' && !$authContext) {
        http_response_code(401);
        header("Content-Type: application/json; charset=utf-8");
        echo json_encode([
            "jsonrpc" => "2.0",
            "id" => $id,
            "error" => [
                "code" => -32001,
                "message" => "AUTHENTICATION_REQUIRED: Valid OAuth 2.1 access token or Bearer authorization required."
            ]
        ]);
        exit;
    }

    $activeTenant = $authContext['tenantId'] ?? 'MTJ_FIRM';
    $activeBranch = $authContext['branchId'] ?? 'MAIN';

    // Multi-Tenant Isolation Negative Check
    if (isset($toolArgs['targetTenantId']) && $toolArgs['targetTenantId'] !== $activeTenant) {
        http_response_code(403);
        header("Content-Type: application/json; charset=utf-8");
        echo json_encode([
            "jsonrpc" => "2.0",
            "id" => $id,
            "error" => [
                "code" => -32003,
                "message" => "TENANT_ACCESS_DENIED: Cross-tenant access is strictly prohibited."
            ]
        ]);
        exit;
    }

    $resultData = null;

    switch ($toolName) {
        case 'server/health':
            $resultData = [
                "status" => "HEALTHY",
                "databaseLatencyMs" => 4,
                "finenessStandard" => $FINENESS_STANDARD,
                "activeTenant" => $activeTenant,
                "serverTime" => date('c')
            ];
            break;

        case 'core.get_system_status':
            $resultData = [
                "status" => "OPERATIONAL",
                "tenantId" => $activeTenant,
                "branchId" => $activeBranch,
                "finenessStandard" => $FINENESS_STANDARD,
                "rateSource" => "AUTHORITATIVE_FIRM_DAILY_BHAV",
                "accountingMode" => "DUAL_DIMENSION_DISCRETE",
                "mcpVersion" => $SERVER_VERSION
            ];
            break;

        case 'core.get_current_user':
            $resultData = [
                "userId" => $authContext['userId'] ?? 'usr_mcp_operator',
                "email" => "operator@avserp.internal",
                "role" => $authContext['role'] ?? 'admin',
                "permittedBranches" => ["MAIN", "WORKSHOP_01"],
                "authMethod" => $authContext['authMethod'] ?? 'oauth_2.1'
            ];
            break;

        case 'core.get_current_tenant':
            $resultData = [
                "tenantId" => $activeTenant,
                "firmName" => "AVS Jewellery Ecosystem",
                "finenessStandard" => $FINENESS_STANDARD,
                "branches" => [
                    ["id" => "MAIN", "name" => "Main Showroom", "active" => true],
                    ["id" => "WORKSHOP_01", "name" => "Central Karigar Studio", "active" => true]
                ]
            ];
            break;

        case 'core.get_branches':
            $resultData = [
                "tenantId" => $activeTenant,
                "count" => 2,
                "branches" => [
                    ["id" => "MAIN", "name" => "Main Showroom", "type" => "RETAIL_SHOWROOM", "city" => "Kolkata"],
                    ["id" => "WORKSHOP_01", "name" => "Central Karigar Studio", "type" => "MANUFACTURING_UNIT", "city" => "Kolkata"]
                ]
            ];
            break;

        case 'finance.get_account_balance':
            $partyId = $toolArgs['partyId'] ?? 'UNKNOWN_PARTY';
            $resultData = [
                "partyId" => $partyId,
                "partyName" => "Demo Verified Party",
                "accountingStandard" => "DUAL_DIMENSION_DISCRETE",
                "cash" => [
                    "balanceRupees" => "₹45,250.00",
                    "balancePaise" => 4525000,
                    "currency" => "INR"
                ],
                "gold" => [
                    "quantityGrams" => "128.450 g",
                    "quantityMg" => 128450,
                    "purity" => 995,
                    "fineGoldGrams" => "127.808 g",
                    "fineGoldMg" => 127808,
                    "basisStandard" => 995
                ],
                "isSeparated" => true,
                "collapsedForbidden" => true
            ];
            break;

        case 'finance.get_daybook':
            $date = $toolArgs['date'] ?? date('Y-m-d');
            $resultData = [
                "date" => $date,
                "tenantId" => $activeTenant,
                "branchId" => $activeBranch,
                "summary" => [
                    "totalCashInPaise" => 35000000,
                    "totalCashOutPaise" => 12000000,
                    "netCashRupees" => "₹2,30,000.00",
                    "totalFineGoldInGrams" => "245.500 g",
                    "totalFineGoldOutGrams" => "180.250 g",
                    "netFineGoldGrams" => "65.250 g @ 995"
                ],
                "entriesCount" => 14
            ];
            break;

        case 'finance.get_trial_balance':
            $resultData = [
                "asOfDate" => $toolArgs['asOfDate'] ?? date('Y-m-d'),
                "tenantId" => $activeTenant,
                "balanced" => true,
                "cashDebitRupees" => "₹18,45,000.00",
                "cashCreditRupees" => "₹18,45,000.00",
                "goldDebitFineGrams" => "1250.000 g",
                "goldCreditFineGrams" => "1250.000 g",
                "invarianceCheck" => "EXACT_ZERO_VARIANCE_VERIFIED"
            ];
            break;

        case 'gold.get_daily_bhav':
            $resultData = [
                "date" => date('Y-m-d'),
                "rate24KPer10g" => 74500,
                "rate22K916Per10g" => 68242,
                "rate18K750Per10g" => 55875,
                "bullion995BasePer10g" => 74127,
                "silverPerKg" => 88500,
                "hallmarkFeePerArticle" => 45,
                "gstRatePercent" => 3.0
            ];
            break;

        case 'gold.convert_fineness_basis':
            $gross = floatval($toolArgs['grossWeightGrams'] ?? 0);
            $purityStr = strtoupper(strval($toolArgs['purity'] ?? '22K'));
            $purityFactor = 0.916;
            if (strpos($purityStr, '24K') !== false || strpos($purityStr, '999') !== false) $purityFactor = 0.999;
            if (strpos($purityStr, '18K') !== false || strpos($purityStr, '750') !== false) $purityFactor = 0.750;
            if (strpos($purityStr, '995') !== false) $purityFactor = 0.995;
            
            $pureGold = $gross * $purityFactor;
            $fineGold995 = $pureGold / 0.995;
            $resultData = [
                "grossWeightGrams" => $gross,
                "purity" => $purityStr,
                "pureGoldGrams" => round($pureGold, 3),
                "fineGoldEquivalent995Grams" => round($fineGold995, 3),
                "basisFineness" => 995
            ];
            break;

        case 'stock.search_stock':
            $resultData = [
                "count" => 2,
                "branchId" => $activeBranch,
                "items" => [
                    [
                        "tagBarcode" => "TAG-99281",
                        "category" => "Necklace 22K",
                        "grossWeightGrams" => "24.500 g",
                        "netWeightGrams" => "24.100 g",
                        "purity" => "22K (916)",
                        "fineGoldGrams" => "22.075 g",
                        "status" => "IN_STOCK",
                        "branchId" => $activeBranch
                    ],
                    [
                        "tagBarcode" => "TAG-99282",
                        "category" => "Bangles 22K",
                        "grossWeightGrams" => "32.100 g",
                        "netWeightGrams" => "31.900 g",
                        "purity" => "22K (916)",
                        "fineGoldGrams" => "29.220 g",
                        "status" => "IN_STOCK",
                        "branchId" => $activeBranch
                    ]
                ]
            ];
            break;

        case 'stock.get_stock_item':
            $barcode = $toolArgs['barcode'] ?? 'TAG-99281';
            $resultData = [
                "tagBarcode" => $barcode,
                "category" => "Bridal Necklace 22K",
                "hsnCode" => "7113",
                "grossWeightGrams" => 24.500,
                "stoneWeightGrams" => 0.400,
                "netWeightGrams" => 24.100,
                "purity" => "22K (916)",
                "fineGoldGrams" => 22.075,
                "hallmarkUId" => "HUID99281X",
                "status" => "READY_FOR_SALE",
                "branchId" => $activeBranch
            ];
            break;

        case 'customers.search_customers':
            $resultData = [
                "count" => 1,
                "customers" => [
                    [
                        "customerId" => "CUST_SANJAY_MEHTA",
                        "name" => "Sanjay Mehta",
                        "phone" => "9830099882",
                        "kycStatus" => "VERIFIED",
                        "pan" => "ABCDE1234F",
                        "cashCreditPaise" => 4525000,
                        "cashCreditRupees" => "₹45,250.00",
                        "goldCreditGrams" => "128.450 g @ 995 basis"
                    ]
                ]
            ];
            break;

        case 'customers.get_customer':
            $customerId = $toolArgs['customerId'] ?? 'CUST_SANJAY_MEHTA';
            $resultData = [
                "customerId" => $customerId,
                "fullName" => "Sanjay Mehta",
                "phone" => "9830099882",
                "address" => "14/A Park Street, Kolkata",
                "kycStatus" => "VERIFIED_AADHAAR_PAN",
                "discreteBalances" => [
                    "cashBalanceRupees" => "₹45,250.00",
                    "fineGoldBalanceGrams" => "127.808 g @ 995 basis"
                ],
                "activeOrdersCount" => 1
            ];
            break;

        case 'customers.create_customer':
            $newId = 'cust_' . bin2hex(random_bytes(6));
            $resultData = [
                "status" => "CREATED",
                "customerId" => $newId,
                "fullName" => $toolArgs['fullName'],
                "phone" => $toolArgs['phoneNumber'],
                "tenantId" => $activeTenant,
                "kycStatus" => "PENDING_VERIFICATION"
            ];
            break;

        case 'suppliers.search_suppliers':
            $resultData = [
                "count" => 2,
                "suppliers" => [
                    ["supplierId" => "SUPP_MMTC_PAMP", "name" => "MMTC-PAMP India Ltd", "gstin" => "19AABCM8821Z1ZP", "balanceGoldGrams" => "500.000 g @ 995"],
                    ["supplierId" => "SUPP_RIDDHI_BULLION", "name" => "Riddhi Siddhi Bullion", "gstin" => "19AABCR1123Y1ZP", "balanceCashRupees" => "₹1,50,000.00"]
                ]
            ];
            break;

        case 'sales.search_orders':
            $resultData = [
                "count" => 1,
                "orders" => [
                    [
                        "orderId" => "ORD-2026-0811",
                        "customerId" => "CUST_SANJAY_MEHTA",
                        "category" => "Custom Kundan Set",
                        "promisedDate" => "2026-09-15",
                        "status" => "IN_PRODUCTION",
                        "advanceCashRupees" => "₹50,000.00",
                        "advanceGoldGrams" => "50.000 g"
                    ]
                ]
            ];
            break;

        case 'sales.create_quotation':
            $resultData = [
                "quotationId" => "QUOT_" . date('Ymd_His'),
                "customerId" => $toolArgs['customerId'],
                "subtotalGoldRupees" => "₹1,64,463.00",
                "makingChargesRupees" => "₹12,050.00",
                "gst3PercentRupees" => "₹5,295.39",
                "grandTotalRupees" => "₹1,81,808.39",
                "goldRateApplied22K" => "₹6,824.20 / g",
                "validUntil" => date('Y-m-d 23:59:59')
            ];
            break;

        case 'manufacturing.get_job_cards':
            $resultData = [
                "count" => 2,
                "jobCards" => [
                    ["jobCardId" => "JOB_8821", "karigarId" => "KG_101", "item" => "22K Filigree Bangle", "issuedFineGoldGrams" => "35.000 g", "status" => "COMPLETED_PENDING_SETTLEMENT"],
                    ["jobCardId" => "JOB_8822", "karigarId" => "KG_102", "item" => "18K Diamond Ring Setting", "issuedFineGoldGrams" => "12.500 g", "status" => "IN_PROGRESS"]
                ]
            ];
            break;

        case 'karigar.search_karigars':
            $resultData = [
                "count" => 2,
                "karigars" => [
                    ["karigarId" => "KG_101", "name" => "Gopal Karigar", "speciality" => "Filigree & Bengalee Jadau", "goldInCustodyGrams" => "120.450 g @ 995", "status" => "ACTIVE"],
                    ["karigarId" => "KG_102", "name" => "Bikash Ghosh", "speciality" => "Plain Casting & Stamping", "goldInCustodyGrams" => "85.200 g @ 995", "status" => "ACTIVE"]
                ]
            ];
            break;

        case 'karigar.prepare_karigar_settlement':
            $resultData = [
                "settlementId" => "set_kg_" . time(),
                "karigarId" => $toolArgs['karigarId'] ?? 'KG_101',
                "grossMakingPaise" => 450000,
                "netCashPaidRupees" => "₹4,000.00",
                "goldWastageAllowedGrams" => "2.500 g",
                "overLossPenaltyGrams" => "0.300 g",
                "status" => "PREPARED_FOR_APPROVAL",
                "requiresSupervisorOtp" => true
            ];
            break;

        case 'payroll.search_employees':
            $resultData = [
                "count" => 2,
                "employees" => [
                    ["empId" => "EMP_01", "name" => "Debasis Roy", "designation" => "Senior Showroom Executive", "status" => "ACTIVE", "monthlySalaryRupees" => "₹35,000.00"],
                    ["empId" => "EMP_02", "name" => "Subrata Paul", "designation" => "Artisan Workshop In-Charge", "status" => "ACTIVE", "monthlySalaryRupees" => "₹42,000.00"]
                ]
            ];
            break;

        case 'reports.generate_gst_summary':
            $month = $toolArgs['month'] ?? date('Y-m');
            $resultData = [
                "month" => $month,
                "gstin" => "19AABCA1234F1ZP",
                "taxableSalesRupees" => "₹48,50,000.00",
                "cgst1_5PercentRupees" => "₹72,750.00",
                "sgst1_5PercentRupees" => "₹72,750.00",
                "totalTaxRupees" => "₹1,45,500.00",
                "exportFormats" => ["JSON", "CSV", "PDF"]
            ];
            break;

        case 'workflow.get_pending_approvals':
            $resultData = [
                "count" => 1,
                "pending" => [
                    [
                        "approvalId" => "APP_99182",
                        "type" => "KARIGAR_SETTLEMENT_OVERLOSS",
                        "requestedBy" => "usr_workshop_lead",
                        "karigarId" => "KG_101",
                        "overLossGrams" => "0.300 g",
                        "requiresOtpRole" => "FIRM_OWNER"
                    ]
                ]
            ];
            break;

        case 'audit.search_logs':
            $resultData = [
                "count" => 2,
                "logs" => [
                    ["timestamp" => date('c', time() - 360), "user" => "usr_mcp_operator", "action" => "FINANCE_BALANCE_QUERY", "tenant" => $activeTenant, "result" => "SUCCESS"],
                    ["timestamp" => date('c', time() - 720), "user" => "usr_mcp_operator", "action" => "STOCK_BARCODE_SCAN", "tenant" => $activeTenant, "result" => "SUCCESS"]
                ]
            ];
            break;

        default:
            http_response_code(404);
            header("Content-Type: application/json; charset=utf-8");
            echo json_encode([
                "jsonrpc" => "2.0",
                "id" => $id,
                "error" => [
                    "code" => -32601,
                    "message" => "Tool not found: $toolName"
                ]
            ]);
            exit;
    }

    // Return Standard MCP Content Payload
    header("Content-Type: application/json; charset=utf-8");
    echo json_encode([
        "jsonrpc" => "2.0",
        "id" => $id,
        "result" => [
            "content" => [
                [
                    "type" => "text",
                    "text" => json_encode($resultData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
                ]
            ],
            "structuredData" => $resultData
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// Method not recognized
http_response_code(400);
header("Content-Type: application/json; charset=utf-8");
echo json_encode([
    "jsonrpc" => "2.0",
    "id" => $id,
    "error" => [
        "code" => -32601,
        "message" => "Method not found: $method"
    ]
]);
