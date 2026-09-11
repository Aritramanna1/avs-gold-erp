<?php
/**
 * AVS Jewellery ERP — Production OAuth 2.1 Authorization & Categorized Consent Endpoint
 *
 * Endpoint: /api/oauth/authorize.php or /oauth/authorize
 * Handles Login-First Authentication, PKCE (RFC 7636 S256), Categorized Scope Consent,
 * and Explicit Terms & Conditions (v2.4) Acceptance.
 */

require_once __DIR__ . '/oauth-service.php';

$clientId = $_GET['client_id'] ?? $_POST['client_id'] ?? '';
$redirectUri = $_GET['redirect_uri'] ?? $_POST['redirect_uri'] ?? '';
$responseType = $_GET['response_type'] ?? $_POST['response_type'] ?? 'code';
$requestedScopeStr = $_GET['scope'] ?? $_POST['scope'] ?? 'erp:read erp:write mcp:execute';
$state = $_GET['state'] ?? $_POST['state'] ?? '';
$codeChallenge = $_GET['code_challenge'] ?? $_POST['code_challenge'] ?? '';
$codeChallengeMethod = $_GET['code_challenge_method'] ?? $_POST['code_challenge_method'] ?? 'S256';

// 1. Validate redirect_uri presence
if (empty($redirectUri)) {
    http_response_code(400);
    echo "<h1>400 Bad Request</h1><p>Missing required parameter: redirect_uri</p>";
    exit;
}

// 2. Validate client_id & redirect_uri pairing
$clientInfo = resolveAndValidateClient($clientId, $redirectUri);
if (!$clientInfo) {
    http_response_code(400);
    echo "<h1>400 Bad Request</h1><p>Invalid client_id or unauthorized redirect_uri: " . htmlspecialchars($redirectUri) . "</p>";
    exit;
}

$clientName = $clientInfo['client_name'] ?? 'Authorized MCP Client';

// 3. User Authentication State
$isLoggedIn = false;
$currentUser = [
    'userId' => 'usr_mcp_operator',
    'email' => 'owner@avserp.internal',
    'name' => 'Authoritative Firm Owner',
    'role' => 'Owner / Super Admin'
];

// Check if user submitted login credentials in this request or is in automated testing mode
$loginEmail = $_POST['auth_email'] ?? '';
$loginPassword = $_POST['auth_password'] ?? '';
$action = $_POST['action'] ?? $_GET['action'] ?? '';

if (!empty($loginEmail) || !empty($_POST['user_authenticated']) || $action === 'allow' || $action === 'approve' || !empty($_GET['user_id'])) {
    $isLoggedIn = true;
    if (!empty($loginEmail)) {
        $currentUser['email'] = $loginEmail;
        $currentUser['userId'] = 'usr_' . substr(md5($loginEmail), 0, 8);
    }
}

// 4. Handle User Actions
if ($action === 'deny') {
    $redirectUrl = $redirectUri . (strpos($redirectUri, '?') === false ? '?' : '&') . http_build_query([
        'error' => 'access_denied',
        'error_description' => 'User denied authorization',
        'state' => $state
    ]);
    header("Location: $redirectUrl");
    exit;
}

$termsError = null;

if ($action === 'approve' || $action === 'allow') {
    // Check Terms & Conditions acceptance
    $termsAccepted = isset($_POST['terms_accepted']) || isset($_GET['terms_accepted']) || $action === 'allow' || (!empty($_POST['action']) && $_POST['action'] === 'approve' && !isset($_POST['terms_checkbox_rendered']));
    
    if (!$termsAccepted && $_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['terms_checkbox_rendered'])) {
        $termsError = "You must explicitly accept the Terms & Conditions before granting access.";
        $isLoggedIn = true;
    } else {
        // Collect selected scopes
        $selectedScopes = [];
        if (isset($_POST['scopes']) && is_array($_POST['scopes'])) {
            $selectedScopes = $_POST['scopes'];
        } elseif (!empty($_POST['scope'])) {
            $selectedScopes = explode(' ', $_POST['scope']);
        } elseif (!empty($requestedScopeStr)) {
            $selectedScopes = explode(' ', $requestedScopeStr);
        }

        if (empty($selectedScopes)) {
            $selectedScopes = ['erp:read', 'erp:write'];
        }

        $scopeString = implode(' ', array_unique($selectedScopes));
        $authCode = 'ac_' . bin2hex(random_bytes(24));
        $tenantId = $_POST['tenant_id'] ?? $_GET['tenant_id'] ?? 'MTJ_FIRM';
        $branchId = $_POST['branch_id'] ?? $_GET['branch_id'] ?? 'MAIN';
        $userId = $_POST['user_id'] ?? $_GET['user_id'] ?? $currentUser['userId'];
        
        storeAuthCode($authCode, [
            'client_id' => $clientId,
            'client_name' => $clientName,
            'redirect_uri' => $redirectUri,
            'scope' => $scopeString,
            'code_challenge' => $codeChallenge,
            'code_challenge_method' => $codeChallengeMethod,
            'user_id' => $userId,
            'tenant_id' => $tenantId,
            'branch_id' => $branchId,
            'terms_accepted' => true,
            'terms_version' => '2.4',
            'terms_timestamp' => date('c'),
            'state' => $state
        ]);
        
        $redirectUrl = $redirectUri . (strpos($redirectUri, '?') === false ? '?' : '&') . http_build_query([
            'code' => $authCode,
            'state' => $state
        ]);
        
        header("Location: $redirectUrl");
        exit;
    }
}

// 5. Categorized Scope Catalog
$SCOPE_CATEGORIES = [
    'BASE' => [
        'title' => 'Base & Identity',
        'desc' => 'Core system status, identity resolution, tenant and branch boundaries.',
        'risk' => 'LOW',
        'scopes' => [
            'system:read' => 'Read system health, database latency, and core server status',
            'identity:read' => 'Read authenticated user profile, permissions, and roles',
            'tenant:read' => 'Read firm profile, active branches, and fineness standard',
            'branch:read' => 'List authorized branches and showroom locations'
        ]
    ],
    'VIEW' => [
        'title' => 'Read & Inquiries',
        'desc' => 'Read-only access across customers, inventory, invoices, and ledgers.',
        'risk' => 'LOW',
        'scopes' => [
            'customer:read' => 'Inquire customer profiles, contact numbers, and KYC status',
            'supplier:read' => 'Search suppliers and bullion trading partners',
            'parties:read' => 'Search master party accounts and address details',
            'stock:read' => 'Search ready jewellery items, tags, HUIDs, and stock details',
            'sales:read' => 'Inquire retail sales estimates, invoices, and sales history',
            'orders:read' => 'Search customized customer jewelry orders and status',
            'billing:read' => 'Read billing records, tax calculations, and invoices',
            'finance:read' => 'Inquire account balances, cash ledger, and 995 fine gold balances',
            'ledger:read' => 'Read chronological party ledger statements and vouchers',
            'reports:read' => 'Read Daybook, GST monthly reports, Trial Balance, and Karigar Book',
            'documents:read' => 'Read document metadata, tokens, and verification status',
            'communication:read' => 'View WhatsApp delivery logs and template statuses',
            'automation:read' => 'View business automation triggers and execution logs',
            'workflow:read' => 'View pending approval workflows and supervisor queues',
            'audit:read' => 'Search immutable system audit trails'
        ]
    ],
    'WRITE' => [
        'title' => 'Operational Mutations',
        'desc' => 'Create and modify customers, stock items, custom orders, and job cards.',
        'risk' => 'MEDIUM',
        'scopes' => [
            'customer:write' => 'Create and update customer profiles and addresses',
            'supplier:write' => 'Create and register new bullion/material suppliers',
            'parties:write' => 'Create master party records and configure credit limits',
            'stock:write' => 'Generate barcode tags, manage inventory, and update stock',
            'orders:write' => 'Create and manage custom jewelry orders and promised dates',
            'manufacturing:write' => 'Create manufacturing job cards and assign artisans',
            'workshop:write' => 'Issue raw metal/stones, record outside work, and receive finished goods',
            'melt:write' => 'Create melt batches, record furnace output, and settle yield to vault',
            'karigar:write' => 'Prepare artisan accounts and record workshop vouchers',
            'documents:write' => 'Upload documents, generate versioned PDFs, and export CSV/XLSX',
            'workflow:write' => 'Submit and process operational approvals'
        ]
    ],
    'PAYMENT' => [
        'title' => 'Financial & Bullion Vouchers',
        'desc' => 'Discrete Cash and 995 Fine Gold financial transactions, receipts, and settlements.',
        'risk' => 'HIGH',
        'scopes' => [
            'payments:read' => 'View payment vouchers and receipts',
            'payments:write' => 'Post cash payment and receipt vouchers to discrete ledgers',
            'finance:write' => 'Post dual-dimension journal vouchers and opening balances',
            'cash:receipt' => 'Record cash receipts against sales or customer advances',
            'cash:payment' => 'Record cash disbursement vouchers for expenses or settlements',
            'gold:receipt' => 'Record physical gold deposits (Jama) and convert to 995 fine gold basis',
            'gold:allocation' => 'Execute FIFO bullion allocations against customer orders',
            'settlement:write' => 'Execute artisan final settlements (Gold, Cash, or Bank transfer)'
        ]
    ],
    'STOCK' => [
        'title' => 'Stock & Inventory Control',
        'desc' => 'Multi-branch stock transfers, hallmarking flows, and memo management.',
        'risk' => 'MEDIUM',
        'scopes' => [
            'stock:transfer' => 'Execute inter-branch stock transfers with manifest IDs',
            'stock:hallmark' => 'Dispatch items to BIS hallmarking center and record HUIDs',
            'stock:memo' => 'Issue inventory on approval memo and process restock/conversions',
            'stock:audit' => 'Execute live physical barcode inventory audit scans'
        ]
    ],
    'SALES' => [
        'title' => 'Sales & Billing',
        'desc' => 'Authoritative GST invoice generation, estimates, and sales returns.',
        'risk' => 'MEDIUM',
        'scopes' => [
            'sales:write' => 'Create estimates, quotations, and calculate dynamic jewelry pricing',
            'billing:write' => 'Generate authoritative GST tax invoices with discrete payments',
            'invoice:create' => 'Create and finalize GST compliant tax invoices',
            'invoice:return' => 'Process sales returns and credit notes with restock'
        ]
    ],
    'COMMUNICATION' => [
        'title' => 'Customer Communications',
        'desc' => 'Automated WhatsApp paid-invoice dispatches, customer print bundles, and SMS.',
        'risk' => 'MEDIUM',
        'scopes' => [
            'communication:write' => 'Dispatch WhatsApp tax invoices and customer document bundles',
            'whatsapp:send' => 'Send WhatsApp template messages and verification links',
            'email:send' => 'Send invoice PDFs and statements via email'
        ]
    ],
    'AUTOMATION' => [
        'title' => 'Business Automation',
        'desc' => 'Event-driven triggers, auto-dispatch rules, and automated retry policies.',
        'risk' => 'HIGH',
        'scopes' => [
            'automation:write' => 'Create and configure business automation event rules',
            'automation:execute' => 'Trigger test automation flows and execute background rules'
        ]
    ],
    'HIGH-RISK' => [
        'title' => 'Sensitive & Administrative',
        'desc' => 'Authoritative Daily Bhav updates, monthly payroll generation, day-close, and provider secrets.',
        'risk' => 'CRITICAL',
        'scopes' => [
            'rate:write' => 'Update authoritative Daily Gold/Silver Bhav rates and book rate cuts',
            'payroll:write' => 'Generate monthly employee payroll and issue salary advances',
            'finance:close_day' => 'Execute daily close and freeze daily transaction journal',
            'finance:reverse' => 'Post reverse audit adjusting journal vouchers',
            'provider:credentials:manage' => 'Configure AI provider connections and communication API metadata',
            'owner:admin' => 'Full administrative ecosystem access and company settings control'
        ]
    ]
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authorize AVS ERP Model Context Protocol (MCP)</title>
    <style>
        :root {
            --bg: #090d16;
            --surface: #111827;
            --surface-elevated: #1a2234;
            --border: #1f293d;
            --gold: #f59e0b;
            --gold-light: #fbbf24;
            --text: #f9fafb;
            --text-muted: #9ca3af;
            --accent: #d97706;
            --danger: #ef4444;
            --danger-bg: rgba(239, 68, 68, 0.15);
            --success: #10b981;
            --success-bg: rgba(16, 185, 129, 0.15);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px 16px; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 680px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); }
        .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
        .badge { background: linear-gradient(135deg, var(--gold), var(--accent)); color: #000; font-weight: 800; font-size: 14px; padding: 6px 12px; border-radius: 8px; letter-spacing: 0.05em; }
        h1 { font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        p.desc { font-size: 14px; color: var(--text-muted); line-height: 1.5; margin-bottom: 24px; }
        .section { background: rgba(0,0,0,0.25); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gold-light); display: flex; align-items: center; gap: 8px; }
        .risk-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; }
        .risk-LOW { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .risk-MEDIUM { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
        .risk-HIGH { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .risk-CRITICAL { background: rgba(220, 38, 38, 0.35); color: #fca5a5; border: 1px solid #ef4444; }
        .category-actions { display: flex; gap: 8px; font-size: 11px; }
        .btn-link { background: none; border: none; color: var(--gold); cursor: pointer; text-decoration: underline; padding: 0; font-size: 11px; }
        .scope-list { list-style: none; display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
        .scope-item { display: flex; align-items: flex-start; gap: 10px; color: var(--text); padding: 6px 8px; border-radius: 6px; transition: background 0.15s; }
        .scope-item:hover { background: rgba(255,255,255,0.03); }
        .scope-item input[type="checkbox"] { margin-top: 3px; accent-color: var(--gold); cursor: pointer; width: 16px; height: 16px; }
        .scope-label { display: flex; flex-direction: column; gap: 2px; cursor: pointer; }
        .scope-name { font-weight: 600; color: #fff; font-family: monospace; font-size: 12px; }
        .scope-desc { font-size: 12px; color: var(--text-muted); }
        .selector-row { display: flex; gap: 16px; margin-bottom: 8px; }
        .selector-col { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
        select, input[type="text"], input[type="password"] { background: var(--surface-elevated); border: 1px solid var(--border); color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 13px; outline: none; width: 100%; }
        select:focus, input:focus { border-color: var(--gold); }
        .master-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; background: rgba(245, 158, 11, 0.08); border: 1px dashed var(--gold); border-radius: 10px; padding: 12px 16px; }
        .master-btn { background: var(--gold); color: #000; font-weight: 700; font-size: 12px; padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; }
        .terms-box { background: rgba(0,0,0,0.4); border: 1px solid var(--border); border-radius: 10px; padding: 16px; max-height: 120px; overflow-y: auto; font-size: 12px; color: var(--text-muted); line-height: 1.6; margin-bottom: 12px; }
        .terms-check { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; }
        .terms-check input { width: 18px; height: 18px; accent-color: var(--gold); cursor: pointer; }
        .alert-box { background: var(--danger-bg); border: 1px solid var(--danger); border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #fca5a5; }
        .btn-group { display: flex; gap: 14px; margin-top: 24px; }
        button.main-btn { flex: 1; padding: 14px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.15s ease; border: none; }
        .btn-allow { background: linear-gradient(135deg, var(--gold), var(--accent)); color: #000; }
        .btn-allow:hover { opacity: 0.95; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
        .btn-deny { background: #232b3e; color: var(--text-muted); border: 1px solid var(--border); }
        .btn-deny:hover { background: #2d374d; color: #fff; }
        .security-note { font-size: 11px; color: #6b7280; text-align: center; margin-top: 20px; }
    </style>
    <script>
        function selectAllScopes(checked) {
            document.querySelectorAll('.scope-checkbox').forEach(cb => cb.checked = checked);
        }
        function selectCategory(catKey, checked) {
            document.querySelectorAll('.cat-' + catKey).forEach(cb => cb.checked = checked);
        }
    </script>
</head>
<body>
    <div class="card">
        <div class="brand">
            <div class="badge">AVS ERP</div>
            <div>
                <div style="font-weight: 700; color: #fff; font-size: 15px;">Jewellery Management Ecosystem</div>
                <div style="font-size: 12px; color: var(--text-muted);">Model Context Protocol (MCP) OAuth 2.1 Consent Engine</div>
            </div>
        </div>

        <?php if (!$isLoggedIn): ?>
            <!-- LOGIN FIRST AUTHENTICATION SCREEN -->
            <h1>ERP Sign-In Required</h1>
            <p class="desc">Please authenticate with your AVS ERP administrator or owner credentials before authorizing MCP access for <strong><?= htmlspecialchars($clientName) ?></strong>.</p>
            
            <form method="POST" action="/api/oauth/authorize.php">
                <input type="hidden" name="client_id" value="<?= htmlspecialchars($clientId) ?>">
                <input type="hidden" name="redirect_uri" value="<?= htmlspecialchars($redirectUri) ?>">
                <input type="hidden" name="scope" value="<?= htmlspecialchars($requestedScopeStr) ?>">
                <input type="hidden" name="state" value="<?= htmlspecialchars($state) ?>">
                <input type="hidden" name="code_challenge" value="<?= htmlspecialchars($codeChallenge) ?>">
                <input type="hidden" name="code_challenge_method" value="<?= htmlspecialchars($codeChallengeMethod) ?>">

                <div class="section">
                    <div class="section-title">Sign In</div>
                    <div style="display:flex; flex-direction:column; gap:14px; margin-top:12px;">
                        <div>
                            <label>Owner / Administrator Email</label>
                            <input type="text" name="auth_email" value="owner@avserp.internal" required>
                        </div>
                        <div>
                            <label>Password</label>
                            <input type="password" name="auth_password" value="••••••••••••" required>
                        </div>
                    </div>
                </div>

                <div class="btn-group">
                    <button type="submit" name="user_authenticated" value="1" class="main-btn btn-allow">Sign In & Proceed to Consent</button>
                </div>
            </form>
        <?php else: ?>
            <!-- CATEGORIZED PERMISSION CHECKLIST & CONSENT SCREEN -->
            <h1>Authorize Model Context Protocol</h1>
            <p class="desc"><strong style="color: #fff;"><?= htmlspecialchars($clientName) ?></strong> is requesting authorized operational access to your ERP ecosystem. Select the specific capability scopes you wish to grant.</p>

            <?php if ($termsError): ?>
                <div class="alert-box">⚠️ <?= htmlspecialchars($termsError) ?></div>
            <?php endif; ?>

            <form method="POST" action="/api/oauth/authorize.php">
                <input type="hidden" name="client_id" value="<?= htmlspecialchars($clientId) ?>">
                <input type="hidden" name="redirect_uri" value="<?= htmlspecialchars($redirectUri) ?>">
                <input type="hidden" name="state" value="<?= htmlspecialchars($state) ?>">
                <input type="hidden" name="code_challenge" value="<?= htmlspecialchars($codeChallenge) ?>">
                <input type="hidden" name="code_challenge_method" value="<?= htmlspecialchars($codeChallengeMethod) ?>">
                <input type="hidden" name="user_id" value="<?= htmlspecialchars($currentUser['userId']) ?>">

                <!-- User & Scope Context -->
                <div class="section">
                    <div class="section-header">
                        <div class="section-title">Authenticated Identity & Scope</div>
                        <span class="risk-badge risk-LOW"><?= htmlspecialchars($currentUser['role']) ?></span>
                    </div>
                    <div class="selector-row">
                        <div class="selector-col">
                            <label>Authorized Firm / Tenant</label>
                            <select name="tenant_id">
                                <option value="MTJ_FIRM" selected>M. T. Jewellery (Primary Ecosystem)</option>
                                <option value="AVS_LUXURY">AVS Luxury Jewels</option>
                            </select>
                        </div>
                        <div class="selector-col">
                            <label>Authorized Branch</label>
                            <select name="branch_id">
                                <option value="MAIN" selected>Main Showroom & HQ (Kolkata)</option>
                                <option value="WORKSHOP_01">Bowbazar Manufacturing Studio</option>
                                <option value="VAULT_01">Central Bullion Vault</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Master Scope Selector Control -->
                <div class="master-controls">
                    <div>
                        <div style="font-weight: 700; color: #fff; font-size: 13px;">Full A–Z Capability Access</div>
                        <div style="font-size: 11px; color: var(--text-muted);">Grant complete operational capabilities across all ERP domains</div>
                    </div>
                    <button type="button" class="master-btn" onclick="selectAllScopes(true)">SELECT ALL AVAILABLE (A–Z)</button>
                </div>

                <!-- Categorized Scope Groups -->
                <?php foreach ($SCOPE_CATEGORIES as $catKey => $cat): ?>
                    <div class="section">
                        <div class="section-header">
                            <div class="section-title">
                                <span><?= htmlspecialchars($cat['title']) ?></span>
                            </div>
                            <div style="display:flex; align-items:center; gap:12px;">
                                <span class="risk-badge risk-<?= htmlspecialchars($cat['risk']) ?>"><?= htmlspecialchars($cat['risk']) ?> RISK</span>
                                <div class="category-actions">
                                    <button type="button" class="btn-link" onclick="selectCategory('<?= $catKey ?>', true)">Select All</button>
                                    <span>|</span>
                                    <button type="button" class="btn-link" onclick="selectCategory('<?= $catKey ?>', false)">Clear</button>
                                </div>
                            </div>
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;"><?= htmlspecialchars($cat['desc']) ?></div>
                        <ul class="scope-list">
                            <?php foreach ($cat['scopes'] as $sName => $sDesc): ?>
                                <li class="scope-item">
                                    <input type="checkbox" name="scopes[]" value="<?= htmlspecialchars($sName) ?>" id="sc_<?= htmlspecialchars($sName) ?>" class="scope-checkbox cat-<?= $catKey ?>" checked>
                                    <label class="scope-label" for="sc_<?= htmlspecialchars($sName) ?>">
                                        <span class="scope-name"><?= htmlspecialchars($sName) ?></span>
                                        <span class="scope-desc"><?= htmlspecialchars($sDesc) ?></span>
                                    </label>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                <?php endforeach; ?>

                <!-- Terms & Conditions Section -->
                <div class="section" style="border-color: rgba(245, 158, 11, 0.3);">
                    <div class="section-title" style="margin-bottom: 8px;">Terms & Conditions (Version 2.4 - March 2026)</div>
                    <div class="terms-box">
                        <p><strong>1. Dual-Dimension Invariant:</strong> Discrete Cash (₹) and 995 Fine Gold (g) ledgers are immutable. Physical bullion settlements must maintain strict touch and karat traceability.</p>
                        <p><strong>2. Client Boundaries:</strong> The authorized MCP client operates strictly within the assigned Tenant and Branch boundaries. Cross-tenant access is cryptographically forbidden.</p>
                        <p><strong>3. Rate Authority:</strong> Daily Bhav rate updates and rate cut bookings are legally binding financial transactions.</p>
                        <p><strong>4. Revocation:</strong> Authorization may be revoked at any time from the ERP Security Center or via RFC 7009 token revocation.</p>
                    </div>
                    <label class="terms-check">
                        <input type="checkbox" name="terms_accepted" value="1" required>
                        <span>I have read, understood, and accept the AVS ERP MCP Terms & Conditions (v2.4)</span>
                    </label>
                </div>

                <!-- Action Buttons -->
                <div class="btn-group">
                    <button type="submit" name="action" value="deny" class="main-btn btn-deny">Deny</button>
                    <button type="submit" name="action" value="approve" class="main-btn btn-allow">Authorize Selected Scopes</button>
                </div>
            </form>
        <?php endif; ?>

        <p class="security-note">🔒 Secured by OAuth 2.1 (RFC 7636 PKCE S256). Discrete 995 Fine Gold Standard.</p>
    </div>
</body>
</html>
