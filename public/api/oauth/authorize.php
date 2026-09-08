<?php
/**
 * AVS Jewellery ERP — OAuth 2.1 Authorization & Consent Endpoint
 *
 * Endpoint: /api/oauth/authorize.php
 * Handles Authorization Code Flow with PKCE (RFC 7636) and User Consent.
 */

require_once __DIR__ . '/oauth-service.php';

$clientId = $_GET['client_id'] ?? $_POST['client_id'] ?? 'mcp_client';
$redirectUri = $_GET['redirect_uri'] ?? $_POST['redirect_uri'] ?? '';
$responseType = $_GET['response_type'] ?? $_POST['response_type'] ?? 'code';
$scope = $_GET['scope'] ?? $_POST['scope'] ?? 'erp:read';
$state = $_GET['state'] ?? $_POST['state'] ?? '';
$codeChallenge = $_GET['code_challenge'] ?? $_POST['code_challenge'] ?? '';
$codeChallengeMethod = $_GET['code_challenge_method'] ?? $_POST['code_challenge_method'] ?? 'S256';

// Validate redirect_uri presence
if (empty($redirectUri)) {
    http_response_code(400);
    echo "<h1>400 Bad Request</h1><p>Missing required parameter: redirect_uri</p>";
    exit;
}

// Check if user submitted consent (POST or action=approve)
$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'deny') {
    $redirectUrl = $redirectUri . (strpos($redirectUri, '?') === false ? '?' : '&') . http_build_query([
        'error' => 'access_denied',
        'error_description' => 'User denied authorization',
        'state' => $state
    ]);
    header("Location: $redirectUrl");
    exit;
}

if ($action === 'approve' || $action === 'allow') {
    // Generate secure authorization code
    $authCode = 'ac_' . bin2hex(random_bytes(24));
    $tenantId = $_POST['tenant_id'] ?? $_GET['tenant_id'] ?? 'MTJ_FIRM';
    $branchId = $_POST['branch_id'] ?? $_GET['branch_id'] ?? 'MAIN';
    $userId = $_POST['user_id'] ?? $_GET['user_id'] ?? 'usr_mcp_operator';
    
    storeAuthCode($authCode, [
        'client_id' => $clientId,
        'redirect_uri' => $redirectUri,
        'scope' => $scope,
        'code_challenge' => $codeChallenge,
        'code_challenge_method' => $codeChallengeMethod,
        'user_id' => $userId,
        'tenant_id' => $tenantId,
        'branch_id' => $branchId,
        'state' => $state
    ]);
    
    $redirectUrl = $redirectUri . (strpos($redirectUri, '?') === false ? '?' : '&') . http_build_query([
        'code' => $authCode,
        'state' => $state
    ]);
    
    header("Location: $redirectUrl");
    exit;
}

// Render Premium HTML Consent Screen
$requestedScopes = array_filter(explode(' ', $scope));
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
            --border: #1f293d;
            --gold: #f59e0b;
            --gold-light: #fbbf24;
            --text: #f9fafb;
            --text-muted: #9ca3af;
            --accent: #d97706;
            --danger: #ef4444;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--bg); color: var(--text); display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 520px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
        .badge { background: linear-gradient(135deg, var(--gold), var(--accent)); color: #000; font-weight: 800; font-size: 14px; padding: 6px 12px; border-radius: 8px; }
        h1 { font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        p.desc { font-size: 14px; color: var(--text-muted); line-height: 1.5; margin-bottom: 20px; }
        .section { background: rgba(0,0,0,0.25); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gold-light); margin-bottom: 8px; }
        .scope-list { list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
        .scope-item { display: flex; align-items: center; gap: 8px; color: var(--text); }
        .scope-icon { color: var(--gold); }
        .selector-row { display: flex; gap: 12px; margin-bottom: 16px; }
        .selector-col { flex: 1; }
        label { display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
        select { width: 100%; background: #1a2234; border: 1px solid var(--border); border-radius: 8px; color: #fff; padding: 10px; font-size: 13px; outline: none; }
        .actions { display: flex; gap: 12px; margin-top: 24px; }
        button { flex: 1; padding: 14px; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; transition: all 0.2s; border: none; }
        .btn-allow { background: linear-gradient(135deg, var(--gold), var(--accent)); color: #000; }
        .btn-allow:hover { opacity: 0.95; transform: translateY(-1px); }
        .btn-deny { background: #1e293b; color: var(--text-muted); border: 1px solid var(--border); }
        .btn-deny:hover { background: #334155; color: #fff; }
        .footer-note { font-size: 11px; color: var(--text-muted); text-align: center; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="brand">
            <span class="badge">AVS ERP</span>
            <span style="font-size: 14px; font-weight: 600; color: var(--gold-light);">Model Context Protocol (MCP)</span>
        </div>
        <h1>Authorize Application</h1>
        <p class="desc">
            <strong><?php echo htmlspecialchars($clientId); ?></strong> is requesting authorized access to your AVS Jewellery ERP tenant.
        </p>

        <form method="POST" action="authorize.php">
            <input type="hidden" name="client_id" value="<?php echo htmlspecialchars($clientId); ?>">
            <input type="hidden" name="redirect_uri" value="<?php echo htmlspecialchars($redirectUri); ?>">
            <input type="hidden" name="scope" value="<?php echo htmlspecialchars($scope); ?>">
            <input type="hidden" name="state" value="<?php echo htmlspecialchars($state); ?>">
            <input type="hidden" name="code_challenge" value="<?php echo htmlspecialchars($codeChallenge); ?>">
            <input type="hidden" name="code_challenge_method" value="<?php echo htmlspecialchars($codeChallengeMethod); ?>">
            <input type="hidden" name="user_id" value="usr_mcp_operator">

            <div class="selector-row">
                <div class="selector-col">
                    <label for="tenant_id">Tenant / Firm</label>
                    <select name="tenant_id" id="tenant_id">
                        <option value="MTJ_FIRM" selected>Maa Tara Jewellers (MTJ_FIRM)</option>
                        <option value="AVS_DEMO">AVS Demo Showroom (AVS_DEMO)</option>
                    </select>
                </div>
                <div class="selector-col">
                    <label for="branch_id">Authorized Branch</label>
                    <select name="branch_id" id="branch_id">
                        <option value="MAIN" selected>Main Showroom (MAIN)</option>
                        <option value="WORKSHOP_01">Karigar Workshop (WORKSHOP_01)</option>
                    </select>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Requested Permissions</div>
                <ul class="scope-list">
                    <?php foreach ($requestedScopes as $s): ?>
                        <li class="scope-item">
                            <span class="scope-icon">✓</span>
                            <span><code><?php echo htmlspecialchars($s); ?></code></span>
                        </li>
                    <?php endforeach; ?>
                </ul>
            </div>

            <div class="actions">
                <button type="submit" name="action" value="deny" class="btn-deny">Deny</button>
                <button type="submit" name="action" value="allow" class="btn-allow">Authorize & Allow</button>
            </div>
        </form>

        <p class="footer-note">
            Standard Bullion Fineness Basis: 995. High-risk write operations require Supervisor approval.
        </p>
    </div>
</body>
</html>
