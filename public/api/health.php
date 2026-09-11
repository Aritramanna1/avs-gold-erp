<?php
/**
 * MTJ / AVS ERP — Hostinger Backend Health Check & Diagnostics
 *
 * Endpoint: /api/health.php
 */

require_once __DIR__ . '/config.php';
handleCors();

$startTime = microtime(true);

// Verify required PHP extensions
$requiredExtensions = ['curl', 'json', 'fileinfo', 'openssl', 'mbstring'];
$missingExtensions = [];
foreach ($requiredExtensions as $ext) {
    if (!extension_loaded($ext)) {
        $missingExtensions[] = $ext;
    }
}

// Test connectivity to Supabase API Gateway
$supabaseStatus = false;
$supabaseLatencyMs = null;
$res = null;
if (!empty($SUPABASE_URL)) {
    $subStart = microtime(true);
    $res = supabaseRequest('auth/v1/settings', 'GET');
    $subEnd = microtime(true);
    $supabaseStatus = (isset($res['status']) && $res['status'] >= 200 && $res['status'] < 400);
    $supabaseLatencyMs = round(($subEnd - $subStart) * 1000, 2);
}

$isHealthy = empty($missingExtensions) && $supabaseStatus;
$totalTimeMs = round((microtime(true) - $startTime) * 1000, 2);

// Check if request is authenticated for detailed infrastructure diagnostics
$adminToken = $_GET['token'] ?? $_SERVER['HTTP_X_ADMIN_KEY'] ?? $_SERVER['HTTP_X_CRON_SECRET'] ?? '';
$isDiagnosticAuthorized = !empty($adminToken) && ($adminToken === $CRON_SECRET || $adminToken === $WHATSAPP_VERIFY_TOKEN);

if ($isDiagnosticAuthorized) {
    $response = [
        'status' => $isHealthy ? 'healthy' : 'degraded',
        'timestamp' => date('c'),
        'environment' => [
            'php_version' => PHP_VERSION,
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Hostinger/Apache',
            'memory_limit' => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time'),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size'),
            'missing_extensions' => $missingExtensions,
        ],
        'supabase' => [
            'configured_url' => $SUPABASE_URL,
            'reachable' => $supabaseStatus,
            'http_status' => $res['status'] ?? null,
            'error' => $supabaseStatus ? null : ($res['error'] ?? 'Connection error'),
            'latency_ms' => $supabaseLatencyMs,
        ],
        'latency_ms' => $totalTimeMs,
    ];
} else {
    // Sanitized public health response
    $response = [
        'status' => $isHealthy ? 'healthy' : 'degraded',
        'timestamp' => date('c'),
        'version' => '1.1.2',
        'service' => 'avs-erp-api',
        'dependencies' => [
            'database' => $supabaseStatus ? 'reachable' : 'unreachable',
            'extensions' => empty($missingExtensions) ? 'ok' : 'missing'
        ]
    ];
}

http_response_code($isHealthy ? 200 : 503);
echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
