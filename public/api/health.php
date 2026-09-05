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
if (!empty($SUPABASE_URL)) {
    $subStart = microtime(true);
    $res = supabaseRequest('auth/v1/settings', 'GET');
    $subEnd = microtime(true);
    $supabaseStatus = ($res['status'] >= 200 && $res['status'] < 400);
    $supabaseLatencyMs = round(($subEnd - $subStart) * 1000, 2);
}

$totalTimeMs = round((microtime(true) - $startTime) * 1000, 2);

$response = [
    'status' => empty($missingExtensions) ? 'healthy' : 'degraded',
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
        'error' => $supabaseStatus ? null : ($res['error'] ?? 'Unknown connection error'),
        'latency_ms' => $supabaseLatencyMs,
    ],
    'latency_ms' => $totalTimeMs,
];

http_response_code($response['status'] === 'healthy' ? 200 : 503);
echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
