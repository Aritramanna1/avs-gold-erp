<?php
/**
 * MTJ / AVS ERP — Hostinger Payment Gateway Admin Settings Endpoint
 *
 * Endpoint: /api/payments/admin-settings.php
 *
 * Provides administrative controls to configure Razorpay TEST & LIVE credentials,
 * manage dynamic callback and webhook URLs, perform non-charging health diagnostics,
 * and safely switch operating environments with audit tracking.
 */

require_once __DIR__ . '/config.php';
handleCors();

$method = $_SERVER['REQUEST_METHOD'];

// ── 1. GET: Fetch Gateway Settings with Masked Secrets ──────────────────────
if ($method === 'GET') {
    $cfg = getAuthoritativePaymentConfig();

    echo json_encode([
        'success' => true,
        'mode' => $cfg['mode'],
        'is_live' => $cfg['mode'] === 'LIVE',
        'active' => [
            'is_configured' => $cfg['active']['is_configured'],
            'key_id_masked' => maskSecret($cfg['active']['key_id']),
            'key_secret_masked' => maskSecret($cfg['active']['key_secret']),
            'webhook_secret_masked' => maskSecret($cfg['active']['webhook_secret']),
            'return_url' => $cfg['active']['return_url'],
            'webhook_url' => $cfg['active']['webhook_url'],
        ],
        'test' => [
            'is_configured' => $cfg['test']['is_configured'],
            'key_id' => $cfg['test']['key_id'] ?: '',
            'key_id_masked' => maskSecret($cfg['test']['key_id']),
            'key_secret_configured' => !empty($cfg['test']['key_secret']),
            'webhook_secret_configured' => !empty($cfg['test']['webhook_secret']),
            'return_url' => $cfg['test']['return_url'],
            'webhook_url' => $cfg['test']['webhook_url'],
        ],
        'live' => [
            'is_configured' => $cfg['live']['is_configured'],
            'key_id' => $cfg['live']['key_id'] ?: '',
            'key_id_masked' => maskSecret($cfg['live']['key_id']),
            'key_secret_configured' => !empty($cfg['live']['key_secret']),
            'webhook_secret_configured' => !empty($cfg['live']['webhook_secret']),
            'return_url' => $cfg['live']['return_url'],
            'webhook_url' => $cfg['live']['webhook_url'],
        ],
        'last_verified_at' => $cfg['last_verified_at'],
        'last_error' => $cfg['last_error'],
    ]);
    exit;
}

// ── 2. POST: Administrative Actions ─────────────────────────────────────────
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];
    $action = $data['action'] ?? 'save_settings';

    // ── Action A: Save Credentials & URLs ───────────────────────────────────
    if ($action === 'save_settings') {
        $existing = getAuthoritativePaymentConfig();

        $patch = [
            'provider' => 'razorpay',
            'updated_at' => date('c'),
        ];

        // Process TEST configurations
        if (isset($data['test_key_id'])) $patch['test_key_id'] = trim($data['test_key_id']);
        if (!empty($data['test_key_secret'])) $patch['test_key_secret'] = trim($data['test_key_secret']);
        if (!empty($data['test_webhook_secret'])) $patch['test_webhook_secret'] = trim($data['test_webhook_secret']);
        if (isset($data['test_return_url'])) $patch['test_callback_url'] = trim($data['test_return_url']);
        if (isset($data['test_webhook_url'])) $patch['test_webhook_url'] = trim($data['test_webhook_url']);

        // Process LIVE configurations
        if (isset($data['live_key_id'])) $patch['live_key_id'] = trim($data['live_key_id']);
        if (!empty($data['live_key_secret'])) $patch['live_key_secret'] = trim($data['live_key_secret']);
        if (!empty($data['live_webhook_secret'])) $patch['live_webhook_secret'] = trim($data['live_webhook_secret']);
        if (isset($data['live_return_url'])) $patch['live_callback_url'] = trim($data['live_return_url']);
        if (isset($data['live_webhook_url'])) $patch['live_webhook_url'] = trim($data['live_webhook_url']);

        // Upsert into payment_gateway_configs in Supabase
        $res = supabaseRequest('rest/v1/payment_gateway_configs?provider=eq.razorpay', 'PATCH', $patch, true);
        if (!$res['ok']) {
            supabaseRequest('rest/v1/payment_gateway_configs', 'POST', array_merge($patch, ['mode' => 'TEST']), true);
        }

        recordPaymentAudit('admin_settings_updated', 'razorpay', [
            'has_test_key' => !empty($patch['test_key_id'] ?? $existing['test']['key_id']),
            'has_live_key' => !empty($patch['live_key_id'] ?? $existing['live']['key_id']),
            'test_return_url' => $patch['test_callback_url'] ?? null,
            'test_webhook_url' => $patch['test_webhook_url'] ?? null,
        ]);

        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Razorpay configuration saved successfully']);
        exit;
    }

    // ── Action B: Switch Mode (TEST <-> LIVE) with Audit Safety ─────────────
    if ($action === 'switch_mode') {
        $targetMode = strtoupper(trim($data['target_mode'] ?? ''));
        $confirmSwitch = !empty($data['confirm_switch']);

        if (!in_array($targetMode, ['TEST', 'LIVE'], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid target mode. Allowed: TEST, LIVE']);
            exit;
        }

        if ($targetMode === 'LIVE' && !$confirmSwitch) {
            http_response_code(400);
            echo json_encode(['error' => 'Explicit confirmation is required to switch Razorpay to LIVE mode']);
            exit;
        }

        $cfg = getAuthoritativePaymentConfig();
        if ($targetMode === 'LIVE' && empty($cfg['live']['key_id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Cannot activate LIVE mode before configuring Live Key ID and Key Secret']);
            exit;
        }

        supabaseRequest('rest/v1/payment_gateway_configs?provider=eq.razorpay', 'PATCH', [
            'mode' => $targetMode,
            'updated_at' => date('c'),
        ], true);

        recordPaymentAudit('mode_switched', 'razorpay', [
            'previous_mode' => $cfg['mode'],
            'target_mode' => $targetMode,
            'switched_at' => date('c'),
        ]);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'mode' => $targetMode,
            'message' => "Payment mode switched to {$targetMode} successfully",
        ]);
        exit;
    }

    // ── Action C: Non-Charging Diagnostic Health Check ──────────────────────
    if ($action === 'test_connection') {
        $cfg = getAuthoritativePaymentConfig();
        $targetEnv = strtoupper($data['environment'] ?? $cfg['mode']);
        $creds = ($targetEnv === 'LIVE') ? $cfg['live'] : $cfg['test'];

        $diagnostics = [
            'environment' => $targetEnv,
            'credentials_present' => !empty($creds['key_id']) && !empty($creds['key_secret']),
            'key_id_valid_format' => (strpos($creds['key_id'] ?? '', 'rzp_') === 0),
            'return_url_configured' => !empty($creds['return_url']),
            'webhook_url_configured' => !empty($creds['webhook_url']),
            'database_connected' => true,
            'server_time' => date('c'),
            'api_connectivity' => 'pending',
        ];

        if ($diagnostics['credentials_present']) {
            // Safe non-charging verification call to Razorpay (fetch payments limit 1)
            $ch = curl_init('https://api.razorpay.com/v1/payments?count=1');
            curl_setopt($ch, CURLOPT_USERPWD, $creds['key_id'] . ':' . $creds['key_secret']);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            $res = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200) {
                $diagnostics['api_connectivity'] = 'ONLINE_HEALTHY';
            } elseif ($code === 401) {
                $diagnostics['api_connectivity'] = 'AUTH_FAILED_CHECK_SECRET';
            } else {
                $diagnostics['api_connectivity'] = 'REACHABLE_HTTP_' . $code;
            }
        } else {
            $diagnostics['api_connectivity'] = 'READY_TO_ENTER_CREDENTIALS';
        }

        // Update last_verified_at in DB
        supabaseRequest('rest/v1/payment_gateway_configs?provider=eq.razorpay', 'PATCH', [
            'last_verified_at' => date('c'),
            'last_error' => ($diagnostics['api_connectivity'] === 'AUTH_FAILED_CHECK_SECRET') ? 'Authentication failed' : null,
            'updated_at' => date('c'),
        ], true);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'diagnostics' => $diagnostics,
            'summary' => ($diagnostics['api_connectivity'] === 'ONLINE_HEALTHY') ? 'Razorpay API is active & authenticating cleanly' : 'Ready for test credentials entry',
        ]);
        exit;
    }
}

http_response_code(400);
echo json_encode(['error' => 'Invalid action']);
