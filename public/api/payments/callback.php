<?php
/**
 * MTJ / AVS ERP — Hostinger Payment Return & Callback Endpoint
 *
 * Endpoint: /api/payments/callback.php
 *
 * Verifies Razorpay checkout signatures server-side, reconciles internal payment records,
 * activates the tenant subscription, logs audit telemetry, and dispatches confirmation notifications.
 */

require_once __DIR__ . '/config.php';
handleCors();

$method = $_SERVER['REQUEST_METHOD'];
$input = [];

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw, true);
    $input = is_array($json) ? $json : $_POST;
} else {
    $input = $_GET;
}

$razorpayPaymentId = trim($input['razorpay_payment_id'] ?? '');
$razorpayOrderId = trim($input['razorpay_order_id'] ?? '');
$razorpaySignature = trim($input['razorpay_signature'] ?? '');
$internalPaymentId = trim($input['internal_payment_id'] ?? $input['ref'] ?? '');
$isApi = (!empty($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)
         || (!empty($input['is_api']) && $input['is_api'] === 'true');

if (empty($razorpayPaymentId) || empty($razorpayOrderId)) {
    if ($isApi) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing razorpay_payment_id or razorpay_order_id']);
        exit;
    }
    header('Location: /settings/license?payment=failed&error=missing_parameters');
    exit;
}

// ── 1. Fetch Authoritative Payment Gateway Config ───────────────────────────
$gatewayConfig = getAuthoritativePaymentConfig();
$activeSecret = $gatewayConfig['active']['key_secret'];
$mode = $gatewayConfig['mode'];

// ── 2. Server-Side HMAC SHA256 Signature Verification ───────────────────────
if (!empty($activeSecret)) {
    $isValid = verifyRazorpayReturnSignature($razorpayOrderId, $razorpayPaymentId, $razorpaySignature, $activeSecret);
    if (!$isValid) {
        recordPaymentAudit('callback_signature_failed', $razorpayOrderId, [
            'payment_id' => $razorpayPaymentId,
            'signature' => $razorpaySignature,
            'reason' => 'HMAC signature mismatch',
        ]);

        if ($isApi) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid Razorpay payment signature']);
            exit;
        }
        header('Location: /settings/license?payment=failed&error=invalid_signature');
        exit;
    }
}

// ── 3. Resolve Internal Payment Session ─────────────────────────────────────
$filter = !empty($internalPaymentId)
    ? "id=eq.{$internalPaymentId}"
    : "razorpay_order_id=eq.{$razorpayOrderId}";

$paymentRes = supabaseRequest("rest/v1/internal_payments?{$filter}&limit=1", 'GET', null, true);
$internalPayment = ($paymentRes['ok'] && !empty($paymentRes['data'])) ? $paymentRes['data'][0] : null;

$tenantId = $internalPayment['tenant_id'] ?? 'tenant_default';
$planCode = $internalPayment['plan_code'] ?? 'avs_manufacturing_30k';
$billingPeriod = $internalPayment['billing_period'] ?? 'monthly';
$daysToAdd = ($billingPeriod === 'annual') ? 365 : 30;

// ── 4. Idempotent State Transition ──────────────────────────────────────────
if ($internalPayment) {
    if ($internalPayment['status'] === PAYMENT_STATUS_PAID) {
        // Already fulfilled — return idempotent success
        if ($isApi) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'status' => 'PAID',
                'message' => 'Payment already fulfilled',
                'internal_payment_id' => $internalPayment['id'],
                'razorpay_payment_id' => $razorpayPaymentId,
            ]);
            exit;
        }
        header("Location: /settings/license?payment=success&ref={$internalPayment['id']}");
        exit;
    }

    // Update internal payment record to PAID
    supabaseRequest("rest/v1/internal_payments?id=eq.{$internalPayment['id']}", 'PATCH', [
        'status' => PAYMENT_STATUS_PAID,
        'razorpay_payment_id' => $razorpayPaymentId,
        'razorpay_signature' => $razorpaySignature,
        'updated_at' => date('c'),
    ], true);
}

// ── 5. Activate Tenant Subscription ─────────────────────────────────────────
$now = time();
$periodEnd = date('c', $now + ($daysToAdd * 86400));

$subRecord = [
    'tenant_id' => $tenantId,
    'plan_code' => $planCode,
    'status' => SUB_STATUS_ACTIVE,
    'current_period_start' => date('c', $now),
    'current_period_end' => $periodEnd,
    'updated_at' => date('c'),
];

// Upsert tenant subscription in Supabase
supabaseRequest('rest/v1/tenant_subscriptions', 'POST', $subRecord, true);

// ── 6. Audit Logging & Notification Dispatch ────────────────────────────────
recordPaymentAudit('verified_success', $razorpayPaymentId, [
    'internal_payment_id' => $internalPayment['id'] ?? null,
    'razorpay_order_id' => $razorpayOrderId,
    'amount_paise' => $internalPayment['amount_paise'] ?? 0,
    'tenant_id' => $tenantId,
    'plan_code' => $planCode,
    'environment' => $mode,
], $tenantId);

// Dispatch notification if email script is present
@include_once __DIR__ . '/../email/send.php';

if ($isApi) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'status' => 'PAID',
        'internal_payment_id' => $internalPayment['id'] ?? null,
        'razorpay_payment_id' => $razorpayPaymentId,
        'tenant_id' => $tenantId,
        'plan_code' => $planCode,
        'period_end' => $periodEnd,
    ]);
    exit;
}

$ref = $internalPayment['id'] ?? $razorpayPaymentId;
header("Location: /settings/license?payment=success&ref={$ref}");
exit;
