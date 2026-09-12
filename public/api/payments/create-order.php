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
$itemType = trim($data['type'] ?? '');
$credits = intval($data['credits'] ?? 0);
$platformInvoiceId = trim($data['platform_invoice_id'] ?? $data['platformInvoiceId'] ?? $data['invoice_id'] ?? '');
$directAmountPaise = intval($data['amount_paise'] ?? $data['amountPaise'] ?? 0);

// ── 1. Authoritative Server-Side Item & Pricing Resolution ───────────────────
$plan = null;
$amountPaise = 0;
$currency = 'INR';

if ($itemType === 'credits' || $credits > 0 || strpos($planCode, 'credits_') === 0) {
    if ($credits <= 0 && strpos($planCode, 'credits_') === 0) {
        $credits = intval(substr($planCode, 8));
    }
    if ($credits < 100) {
        http_response_code(400);
        echo json_encode(['error' => 'Minimum credit purchase is 100 credits (₹100)']);
        exit;
    }
    // Check if direct pack amount is provided, otherwise default to 1 Credit = ₹1.00 = 100 paise
    $amountPaise = ($directAmountPaise > 0) ? $directAmountPaise : ($credits * 100);
    $planCode = 'credits_' . $credits;
    $plan = [
        'id' => $planCode,
        'name' => "AVS Credits Top-up ({$credits} Credits)",
        'price_minor' => $amountPaise,
        'currency' => 'INR',
    ];
} elseif ($itemType === 'extension' || strpos($planCode, 'ext_') === 0) {
    $extCatalog = [
        'ext_gst' => ['id' => 'ext_gst', 'name' => 'Direct GST Portal & E-Way Bill Auto-Filing Engine', 'price_minor' => 99900, 'currency' => 'INR'],
        'ext_barcode' => ['id' => 'ext_barcode', 'name' => 'Thermal Barcode & RFID Smart Tagging', 'price_minor' => 149900, 'currency' => 'INR'],
        'ext_payroll' => ['id' => 'ext_payroll', 'name' => 'Biometric Attendance & Karigar Wage Cloud', 'price_minor' => 79900, 'currency' => 'INR'],
        'ext_multibranch' => ['id' => 'ext_multibranch', 'name' => 'Multi-Branch Real-Time Vault Bridge', 'price_minor' => 199900, 'currency' => 'INR'],
        'ext_tally' => ['id' => 'ext_tally', 'name' => 'Tally Prime & Busy Financial Accounting Bridge', 'price_minor' => 69900, 'currency' => 'INR'],
        'ext_scheme' => ['id' => 'ext_scheme', 'name' => 'Customer Jewellery Scheme & Dhanteras Kitty App', 'price_minor' => 119900, 'currency' => 'INR'],
    ];
    $plan = $extCatalog[$planCode] ?? null;
    $amountPaise = $directAmountPaise > 0 ? $directAmountPaise : ($plan ? $plan['price_minor'] : 99900);
    if (!$plan) {
        $plan = [
            'id' => $planCode ?: 'ext_custom',
            'name' => 'AVS ERP Extension Add-on',
            'price_minor' => $amountPaise,
            'currency' => 'INR',
        ];
    }
} elseif ($itemType === 'invoice' || !empty($platformInvoiceId)) {
    if ($directAmountPaise <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invoice payment amount must be greater than 0']);
        exit;
    }
    $amountPaise = $directAmountPaise;
    $planCode = 'inv_' . ($platformInvoiceId ?: 'direct');
    $plan = [
        'id' => $planCode,
        'name' => "Platform Invoice " . ($platformInvoiceId ?: 'Payment'),
        'price_minor' => $amountPaise,
        'currency' => 'INR',
    ];
} else {
    // Standard Plan Purchase
    if (empty($planCode)) {
        http_response_code(400);
        echo json_encode(['error' => 'Plan code is required']);
        exit;
    }

    $planRes = supabaseRequest("rest/v1/platform_plans?code=eq.{$planCode}&is_active=eq.true&limit=1", 'GET', null, true);
    if ($planRes['ok'] && is_array($planRes['data']) && !empty($planRes['data']) && is_array($planRes['data'][0]) && isset($planRes['data'][0]['price_minor'])) {
        $plan = $planRes['data'][0];
    }

    // Fallback catalog
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
}

if ($amountPaise <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Calculated order amount must be greater than zero']);
    exit;
}

$currency = $plan['currency'] ?? 'INR';
$gatewayConfig = getAuthoritativePaymentConfig();
$mode = $gatewayConfig['mode']; // LIVE or TEST
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
    $curlErr = curl_error($ch);
    curl_close($ch);

    $orderData = json_decode($response, true);
    if ($httpCode >= 200 && $httpCode < 300 && !empty($orderData['id'])) {
        $razorpayOrderId = $orderData['id'];
    } else {
        if ($mode === 'LIVE') {
            http_response_code(502);
            $errMsg = $orderData['error']['description'] ?? ($curlErr ?: "Razorpay Order creation failed (HTTP {$httpCode})");
            echo json_encode([
                'success' => false,
                'error' => $errMsg,
                'upstream_code' => $httpCode,
                'details' => $orderData,
            ]);
            exit;
        }
    }
}

// In TEST/mock mode only, generate sandbox order ID fallback
if (empty($razorpayOrderId)) {
    if ($mode === 'LIVE') {
        http_response_code(500);
        echo json_encode(['error' => 'Unable to create Razorpay live order. Verify API credentials.']);
        exit;
    }
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
