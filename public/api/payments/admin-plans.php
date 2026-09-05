<?php
/**
 * MTJ / AVS ERP — Hostinger SaaS Plan & Subscription Engine Admin API
 *
 * Endpoint: /api/payments/admin-plans.php
 *
 * Full administrative CRUD for SaaS commercial plans, pricing, quotas,
 * trial periods, grace periods, feature entitlements, and historical preservation.
 */

require_once __DIR__ . '/config.php';
handleCors();

$method = $_SERVER['REQUEST_METHOD'];

// ── 1. GET: List All Configured SaaS Plans ──────────────────────────────────
if ($method === 'GET') {
    $res = supabaseRequest('rest/v1/platform_plans?order=price_minor.asc', 'GET', null, true);
    $plans = ($res['ok'] && !empty($res['data'])) ? $res['data'] : [];

    // If empty DB table, return default seed catalog
    if (empty($plans)) {
        $plans = [
            [
                'id' => 'plan_mtg',
                'code' => 'avs_mtg',
                'name' => 'AVS MTG Express',
                'description' => 'Fast MTG gold workflow management',
                'price_minor' => 499900,
                'currency' => 'INR',
                'billing_cycle' => 'monthly',
                'trial_days' => 14,
                'grace_days' => 7,
                'max_seats' => 3,
                'max_branches' => 1,
                'max_storage_gb' => 10,
                'features' => ['inventory', 'billing', 'mtg', 'reports'],
                'is_active' => true,
                'is_archived' => false,
            ],
            [
                'id' => 'plan_10k',
                'code' => 'avs_manufacturing_10k',
                'name' => 'AVS Manufacturing 10K',
                'description' => 'Standard manufacturing for small workshop',
                'price_minor' => 999900,
                'currency' => 'INR',
                'billing_cycle' => 'monthly',
                'trial_days' => 14,
                'grace_days' => 7,
                'max_seats' => 5,
                'max_branches' => 1,
                'max_storage_gb' => 25,
                'features' => ['inventory', 'billing', 'manufacturing', 'karigar_portal', 'reports'],
                'is_active' => true,
                'is_archived' => false,
            ],
            [
                'id' => 'plan_30k',
                'code' => 'avs_manufacturing_30k',
                'name' => 'AVS Manufacturing 30K',
                'description' => 'Advanced multi-branch jewellery production',
                'price_minor' => 2999900,
                'currency' => 'INR',
                'billing_cycle' => 'monthly',
                'trial_days' => 14,
                'grace_days' => 14,
                'max_seats' => 15,
                'max_branches' => 3,
                'max_storage_gb' => 100,
                'features' => ['inventory', 'billing', 'manufacturing', 'karigar_portal', 'customer_portal', 'reports', 'qr_printing', 'whatsapp_managed'],
                'is_active' => true,
                'is_archived' => false,
            ],
            [
                'id' => 'plan_50k',
                'code' => 'avs_manufacturing_50k',
                'name' => 'AVS Manufacturing 50K Pro',
                'description' => 'Enterprise full multi-location SaaS with AI & unlimited portals',
                'price_minor' => 4999900,
                'currency' => 'INR',
                'billing_cycle' => 'monthly',
                'trial_days' => 30,
                'grace_days' => 15,
                'max_seats' => 50,
                'max_branches' => 10,
                'max_storage_gb' => 500,
                'features' => ['all_modules', 'ai_assistant', 'unlimited_portals', 'custom_reports', 'dedicated_sla', 'cloud_vault'],
                'is_active' => true,
                'is_archived' => false,
            ],
        ];
    }

    echo json_encode(['success' => true, 'plans' => $plans]);
    exit;
}

// ── 2. POST: Plan Management Actions ────────────────────────────────────────
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];
    $action = $data['action'] ?? 'update_plan';

    if ($action === 'create_plan') {
        $code = trim($data['code'] ?? '');
        $name = trim($data['name'] ?? '');
        $priceInr = floatval($data['price_inr'] ?? 0);
        $priceMinor = intval($data['price_minor'] ?? round($priceInr * 100));

        if (empty($code) || empty($name) || $priceMinor <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Plan code, name, and positive price are required']);
            exit;
        }

        $newPlan = [
            'id' => 'plan_' . bin2hex(random_bytes(6)),
            'code' => $code,
            'name' => $name,
            'description' => trim($data['description'] ?? ''),
            'price_minor' => $priceMinor,
            'currency' => trim($data['currency'] ?? 'INR'),
            'billing_cycle' => trim($data['billing_cycle'] ?? 'monthly'),
            'trial_days' => intval($data['trial_days'] ?? 14),
            'grace_days' => intval($data['grace_days'] ?? 7),
            'max_seats' => intval($data['max_seats'] ?? 5),
            'max_branches' => intval($data['max_branches'] ?? 1),
            'max_storage_gb' => intval($data['max_storage_gb'] ?? 25),
            'features' => is_array($data['features'] ?? null) ? $data['features'] : ['inventory', 'billing'],
            'is_active' => true,
            'is_archived' => false,
            'created_at' => date('c'),
            'updated_at' => date('c'),
        ];

        supabaseRequest('rest/v1/platform_plans', 'POST', $newPlan, true);
        recordPaymentAudit('plan_created', $newPlan['id'], $newPlan);

        http_response_code(201);
        echo json_encode(['success' => true, 'plan' => $newPlan]);
        exit;
    }

    if ($action === 'update_plan') {
        $planId = trim($data['id'] ?? $data['plan_id'] ?? '');
        if (empty($planId)) {
            http_response_code(400);
            echo json_encode(['error' => 'Plan ID is required']);
            exit;
        }

        $patch = ['updated_at' => date('c')];
        if (isset($data['name'])) $patch['name'] = trim($data['name']);
        if (isset($data['description'])) $patch['description'] = trim($data['description']);
        if (isset($data['price_minor'])) $patch['price_minor'] = intval($data['price_minor']);
        if (isset($data['price_inr'])) $patch['price_minor'] = intval(round(floatval($data['price_inr']) * 100));
        if (isset($data['trial_days'])) $patch['trial_days'] = intval($data['trial_days']);
        if (isset($data['grace_days'])) $patch['grace_days'] = intval($data['grace_days']);
        if (isset($data['max_seats'])) $patch['max_seats'] = intval($data['max_seats']);
        if (isset($data['max_branches'])) $patch['max_branches'] = intval($data['max_branches']);
        if (isset($data['max_storage_gb'])) $patch['max_storage_gb'] = intval($data['max_storage_gb']);
        if (isset($data['features']) && is_array($data['features'])) $patch['features'] = $data['features'];
        if (isset($data['is_active'])) $patch['is_active'] = (bool)$data['is_active'];
        if (isset($data['is_archived'])) $patch['is_archived'] = (bool)$data['is_archived'];

        supabaseRequest("rest/v1/platform_plans?id=eq.{$planId}", 'PATCH', $patch, true);
        recordPaymentAudit('plan_updated', $planId, $patch);

        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Plan updated successfully']);
        exit;
    }
}

http_response_code(400);
echo json_encode(['error' => 'Invalid action']);
