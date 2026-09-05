<?php
/**
 * MTJ / AVS ERP — Hostinger Backend Configuration & Helpers
 *
 * Provides shared configuration, environment variable loading, and
 * secure communication with Supabase PostgreSQL / Auth REST API.
 */

// Prevent direct execution outside API scripts
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    http_response_code(403);
    echo json_encode(['error' => 'Direct access forbidden']);
    exit;
}

// ── Environment Variable Loader ─────────────────────────────────────────────
function loadEnvFile($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line) || $line[0] === '#') continue;
        if (strpos($line, '=') !== false) {
            list($key, $val) = explode('=', $line, 2);
            $key = trim($key);
            $val = trim($val, " \t\n\r\0\x0B\"'");
            if (!isset($_ENV[$key])) {
                $_ENV[$key] = $val;
                putenv("$key=$val");
            }
        }
    }
}

// Search for .env files in root or parent directories
loadEnvFile(__DIR__ . '/../../.env');
loadEnvFile(__DIR__ . '/../../.env.local');
loadEnvFile(__DIR__ . '/../../.env.production');

// ── Master Configuration Values ─────────────────────────────────────────────
// Authoritative Supabase Production Project
$AUTHORITATIVE_SUPABASE_URL = 'https://dqgrrafuoxaorvyrcuuh.supabase.co';
$AUTHORITATIVE_SUPABASE_ANON_KEY = 'sb_publishable_nJNeQ0ZIit5jFjK-J2qCMA_wvs8llEN';

$envUrl = getenv('VITE_SUPABASE_URL') ?: (getenv('SUPABASE_URL') ?: '');
if (empty($envUrl) || strpos($envUrl, 'xrvsvzfqjptzbxjscnvf') !== false || strpos($envUrl, 'mtj-erp') !== false) {
    $SUPABASE_URL = $AUTHORITATIVE_SUPABASE_URL;
} else {
    $SUPABASE_URL = $envUrl;
}

$envKey = getenv('VITE_SUPABASE_ANON_KEY') ?: (getenv('SUPABASE_ANON_KEY') ?: (getenv('VITE_SUPABASE_PUBLISHABLE_KEY') ?: ''));
if (empty($envKey) || strpos($envKey, 'sb_publishable_nJNeQ0ZIit5jFjK-J2qCMA_wvs8llEN') !== false || $SUPABASE_URL === $AUTHORITATIVE_SUPABASE_URL) {
    $SUPABASE_ANON_KEY = $AUTHORITATIVE_SUPABASE_ANON_KEY;
} else {
    $SUPABASE_ANON_KEY = $envKey;
}
$SUPABASE_SERVICE_ROLE_KEY = getenv('SUPABASE_SERVICE_ROLE_KEY') ?: '';

$RAZORPAY_KEY_ID = getenv('RAZORPAY_KEY_ID') ?: '';
$RAZORPAY_KEY_SECRET = getenv('RAZORPAY_KEY_SECRET') ?: '';
$RAZORPAY_WEBHOOK_SECRET = getenv('RAZORPAY_WEBHOOK_SECRET') ?: '';

$WHATSAPP_VERIFY_TOKEN = getenv('WHATSAPP_VERIFY_TOKEN') ?: 'mtj_avs_whatsapp_secure_2026';
$WHATSAPP_ACCESS_TOKEN = getenv('WHATSAPP_ACCESS_TOKEN') ?: '';
$WHATSAPP_PHONE_NUMBER_ID = getenv('WHATSAPP_PHONE_NUMBER_ID') ?: '';

$CRON_SECRET = getenv('CRON_SECRET') ?: 'mtj_avs_cron_secure_key_2026';

// ── CORS & Output Helpers ───────────────────────────────────────────────────
function handleCors() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Cron-Secret, X-Razorpay-Signature');
    header('Content-Type: application/json; charset=utf-8');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ── Supabase REST API Client Helper ─────────────────────────────────────────
function supabaseRequest($endpoint, $method = 'GET', $data = null, $useServiceRole = false) {
    global $SUPABASE_URL, $SUPABASE_ANON_KEY, $SUPABASE_SERVICE_ROLE_KEY;

    $url = rtrim($SUPABASE_URL, '/') . '/' . ltrim($endpoint, '/');
    $key = $useServiceRole && !empty($SUPABASE_SERVICE_ROLE_KEY) ? $SUPABASE_SERVICE_ROLE_KEY : $SUPABASE_ANON_KEY;

    $headers = [
        'Content-Type: application/json',
        'apikey: ' . $key,
        'Authorization: Bearer ' . $key,
        'Prefer: return=representation'
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($data) ? $data : json_encode($data));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    return [
        'ok' => $httpCode >= 200 && $httpCode < 300,
        'status' => $httpCode,
        'data' => json_decode($response, true) ?: $response,
        'error' => $error ?: ($httpCode >= 400 ? $response : null)
    ];
}
