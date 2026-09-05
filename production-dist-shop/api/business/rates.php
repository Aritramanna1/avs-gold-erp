<?php
/**
 * MTJ / AVS ERP — Hostinger Bullion Rates Cache Endpoint
 *
 * Endpoint: /api/business/rates.php
 *
 * Provides fast server-cached market gold / silver rates without
 * taxing Supabase database connections or edge function quotas.
 */

require_once __DIR__ . '/../config.php';
handleCors();

$cacheFile = __DIR__ . '/rates_cache.json';

// GET: Return cached rates
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < 300)) {
        header('X-Cache: HIT');
        echo file_get_contents($cacheFile);
        exit;
    }

    // Fallback: Query current rates from Supabase app_settings
    $res = supabaseRequest('rest/v1/app_settings?select=data&limit=1', 'GET', null, false);
    $data = $res['data'][0]['data']['bullion'] ?? [
        'gold24k' => 7450,
        'gold22k' => 6850,
        'silver' => 88,
        'updated_at' => date('c'),
    ];

    @file_put_contents($cacheFile, json_encode($data));
    header('X-Cache: MISS');
    echo json_encode($data);
    exit;
}

// POST: Update rates cache
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    if ($payload) {
        $payload['updated_at'] = date('c');
        @file_put_contents($cacheFile, json_encode($payload));
        echo json_encode(['success' => true, 'data' => $payload]);
        exit;
    }
    http_response_code(400);
    echo json_encode(['error' => 'Invalid payload']);
    exit;
}
