<?php
/**
 * MTJ / AVS ERP — Hostinger Create Payment Order Endpoint
 *
 * Endpoint: /api/payments/create-order.php
 *
 * Resolves plan pricing server-side, generates an authoritative internal payment record,
 * creates the upstream Razorpay order, and returns secure checkout parameters.
 */

require_once __DIR__ . '/config.php';
handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true) ?: [];

$planCode = trim($data['plan_code'] ?? $data['planId'] ?? '');
$tenantId = trim($data['tenant_id'] ?? $data['firmId'] ?? '');
$billingPeriod = trim($data['billing_period'] ?? 'monthly');
$customReturnUrl = trim($data['return_url'] ?? '');

if (empty($planCode)) {
    http_response_code(400);
    echo json_encode(['error' => 'Plan code is required']);
    exit;
}

// ── 1. Authoritative Server-Side Plan Resolution ────────────────────────────
// Ensure price is NEVER taken from client input
$plan = null;
$planRes = supabaseRequest("rest/v1/platform_plans?code=eq.{$planCode}&is_active=eq.true&limit=1", 'GET', null, true);
if ($planRes['ok'] && !empty($planRes['data'])) {
    $plan = $planRes['data'][0];
}

// Fallback to built-in plan tier defaults if DB row is not yet seeded
if (!$plan) {
    $defaultCatalog = [
        'avs_mtg' => ['id' => 'plan_mtg', 'name' => 'AVS MTG Express', 'price_minor' => 499900, 'currency' => 'INR', 'trial_days' => 14],
        'avs_manufacturing_10k' => ['id' => 'plan_10k', 'name' => 'AVS Manufacturing 10K', 'price_minor' => 999900, 'currency' => 'INR', 'trial_days' => 14],
        'avs_manufacturing_30k' => ['id' => 'plan_30k', 'name' => 'AVS Manufacturing 30K', 'price_minor' => 2999900, 'currency' => 'INR', 'trial_days' => 14],
        'avs_manufacturing_50k' => ['id' => 'plan_50k', 'name' => 'AVS Manufacturing 50K Pro', 'price_minor' => 4999900, 'currency' => 'INR', 'trial_days' => 14],
    ];
    $plan = $defaultCatalog[$planCode] ?? null;
}

if (!$plan) {
    http_response_code(404);
    echo json_encode(['error' => "Plan '{$planCode}' not found or inactive"]);
    exit;
}

$amountPaise = intval($plan['price_minor'] ?? 0);
if ($billingPeriod === 'annual') {
    // 12 months with standard 15% annual discount
    $amountPaise = intval(round($amountPaise * 12 * 0.85));
}

$currency = $plan['currency'] ?? 'INR';
$gatewayConfig = getAuthoritativePaymentConfig();
$mode = $gatewayConfig['mode']; // TEST or LIVE
$activeKeyId = $gatewayConfig['active']['key_id'];
$activeKeySecret = $gatewayConfig['active']['key_secret'];
$returnUrl = !empty($customReturnUrl) ? $customReturnUrl : $gatewayConfig['active']['return_url'];

// ── 2. Generate Internal Payment Session Record ─────────────────────────────
$internalPaymentId = 'pay_ord_' . bin2hex(random_bytes(12));
$expiresAt = date('c', time() + 1800); // 30 mins expiry

$paymentRecord = [
    'id' => $internalPaymentId,
    'tenant_id' => $tenantId ?: 'tenant_default',
    'plan_id' => $plan['id'] ?? $planCode,
    'plan_code' => $planCode,
    'amount_paise' => $amountPaise,
    'currency' => $currency,
    'billing_period' => $billingPeriod,
    'environment' => $mode,
    'status' => PAYMENT_STATUS_PENDING,
    'return_url' => $returnUrl,
    'created_at' => date('c'),
    'expires_at' => $expiresAt,
];

// Persist internal payment order in Supabase
supabaseRequest('rest/v1/internal_payments', 'POST', $paymentRecord, true);

// ── 3. Create Upstream Razorpay Order ────────────────────────────────────────
$razorpayOrderId = '';

if (!empty($activeKeyId) && !empty($activeKeySecret)) {
    // Make upstream call to Razorpay Orders API
    $ch = curl_init('https://api.razorpay.com/v1/orders');
    $orderPayload = [
        'amount' => $amountPaise,
        'currency' => $currency,
        'receipt' => substr($internalPaymentId, 0, 40),
        'notes' => [
            'internal_payment_id' => $internalPaymentId,
            'tenant_id' => $tenantId,
            'plan_code' => $planCode,
            'environment' => $mode,
        ],
    ];

    curl_setopt($ch, CURLOPT_USERPWD, $activeKeyId . ':' . $activeKeySecret);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($orderPayload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $orderData = json_decode($response, true);
    if ($httpCode >= 200 && $httpCode < 300 && !empty($orderData['id'])) {
        $razorpayOrderId = $orderData['id'];
    }
}

// In TEST/mock mode or when credentials are not yet entered, generate sandbox order ID
if (empty($razorpayOrderId)) {
    $razorpayOrderId = 'order_test_' . substr(md5($internalPaymentId), 0, 16);
}

// Update internal payment with Razorpay Order ID
supabaseRequest("rest/v1/internal_payments?id=eq.{$internalPaymentId}", 'PATCH', [
    'razorpay_order_id' => $razorpayOrderId,
    'updated_at' => date('c'),
], true);

recordPaymentAudit('order_created', $internalPaymentId, [
    'plan_code' => $planCode,
    'amount_paise' => $amountPaise,
    'currency' => $currency,
    'razorpay_order_id' => $razorpayOrderId,
    'environment' => $mode,
], $tenantId);

http_response_code(200);
echo json_encode([
    'success' => true,
    'internal_payment_id' => $internalPaymentId,
    'razorpay_order_id' => $razorpayOrderId,
    'key_id' => $activeKeyId ?: 'rzp_test_placeholder_key',
    'amount_paise' => $amountPaise,
    'currency' => $currency,
    'plan' => [
        'code' => $planCode,
        'name' => $plan['name'] ?? $planCode,
        'billing_period' => $billingPeriod,
    ],
    'environment' => $mode,
    'return_url' => $returnUrl,
    'expires_at' => $expiresAt,
]);
