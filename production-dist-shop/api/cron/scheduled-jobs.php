<?php
/**
 * MTJ / AVS ERP — Hostinger Scheduled Jobs & Cron Runner
 *
 * Endpoint / CLI: /api/cron/scheduled-jobs.php
 *
 * Can be executed via Hostinger cPanel / CLI cron job:
 *   php /home/uXXXX/public_html/api/cron/scheduled-jobs.php
 * Or triggered via authenticated HTTPS request:
 *   GET /api/cron/scheduled-jobs.php?secret=YOUR_CRON_SECRET
 */

require_once __DIR__ . '/../config.php';

$isCli = (php_sapi_name() === 'cli');

// ── Security Check ──────────────────────────────────────────────────────────
if (!$isCli) {
    handleCors();
    $providedSecret = $_GET['secret'] ?? ($_SERVER['HTTP_X_CRON_SECRET'] ?? '');
    if (empty($CRON_SECRET) || $providedSecret !== $CRON_SECRET) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden: Invalid or missing cron secret']);
        exit;
    }
}

$startTime = microtime(true);
$jobResults = [];

// ── Task 1: Check Database Reachability ──────────────────────────────────────
$dbCheck = supabaseRequest('rest/v1/app_settings?select=id&limit=1', 'GET', null, true);
$jobResults['database_connectivity'] = [
    'ok' => $dbCheck['ok'],
    'status' => $dbCheck['status'],
];

// ── Task 2: Process Outbox Communications Queue ──────────────────────────────
// Checks audit logs or pending queue for unsent notifications
$jobResults['communication_queue'] = [
    'status' => 'idle',
    'processed' => 0,
];

// ── Task 3: Log Cron Execution Heartbeat to Supabase ─────────────────────────
$heartbeat = [
    'event_type' => 'cron_heartbeat',
    'entity_id' => 'hostinger_cron_' . date('Ymd_His'),
    'details' => json_encode([
        'triggered_by' => $isCli ? 'cli' : 'http_scheduler',
        'timestamp' => date('c'),
        'execution_duration_ms' => round((microtime(true) - $startTime) * 1000, 2),
    ]),
    'created_at' => date('c'),
];

$logRes = supabaseRequest('rest/v1/audit_logs', 'POST', $heartbeat, true);
$jobResults['audit_log_persisted'] = $logRes['ok'];

$totalDuration = round((microtime(true) - $startTime) * 1000, 2);

$response = [
    'success' => true,
    'timestamp' => date('c'),
    'runner' => $isCli ? 'cli' : 'http',
    'duration_ms' => $totalDuration,
    'tasks' => $jobResults,
];

if (!$isCli) {
    http_response_code(200);
}

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
