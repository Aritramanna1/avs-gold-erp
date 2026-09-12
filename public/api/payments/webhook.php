<?php
/**
 * MTJ / AVS ERP — Hostinger Production Razorpay Webhook Endpoint
 *
 * Endpoint: /api/payments/webhook.php & /api/webhooks/razorpay.php
 *
 * Provides cryptographic HMAC verification, strict idempotency & replay protection,
 * automated subscription state reconciliation, invoice generation, registered email delivery, and audit telemetry.
 */

require_once __DIR__ . '/invoice-service.php';
handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$rawPayload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';

$gatewayConfig = getAuthoritativePaymentConfig();
$webhookSecret = $gatewayConfig['active']['webhook_secret'];
$mode = $gatewayConfig['mode'];

// ── 1. Cryptographic HMAC Signature Verification ────────────────────────────
if (empty($signature)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required X-Razorpay-Signature header']);
    exit;
}

if (!empty($webhookSecret)) {
    $isValid = verifyRazorpayWebhookSignature($rawPayload, $signature, $webhookSecret);
    if (!$isValid) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid Razorpay Webhook Signature']);
        exit;
    }
}

$eventData = json_decode($rawPayload, true);
if (!$eventData || !isset($eventData['event'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Malformed Webhook Payload']);
    exit;
}

$event = $eventData['event'];
$eventId = $eventData['id'] ?? ('evt_' . md5($rawPayload));
$payload = $eventData['payload'] ?? [];
$payment = $payload['payment']['entity'] ?? [];
$order = $payload['order']['entity'] ?? [];
$refund = $payload['refund']['entity'] ?? [];
$subscription = $payload['subscription']['entity'] ?? [];
$settlement = $payload['settlement']['entity'] ?? [];

$paymentId = $payment['id'] ?? ($order['id'] ?? ($subscription['id'] ?? ($settlement['id'] ?? 'unknown')));
$orderId = $payment['order_id'] ?? ($order['id'] ?? '');
$amountPaise = intval($payment['amount'] ?? ($order['amount'] ?? ($settlement['amount'] ?? 0)));
$currency = $payment['currency'] ?? ($order['currency'] ?? 'INR');

// ── 2. Idempotency & Replay Protection Check ────────────────────────────────
$idempotencyKey = $eventId . ':' . $paymentId;
$dupCheck = supabaseRequest("rest/v1/audit_logs?event_type=eq.payment_webhook_processed&entity_id=eq.{$idempotencyKey}&limit=1", 'GET', null, true);

if ($dupCheck['ok'] && !empty($dupCheck['data'])) {
    // Duplicate event already processed — return 200 idempotent OK
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'event' => $event,
        'status' => 'duplicate_ignored',
        'message' => 'Event already processed',
    ]);
    exit;
}

// ── 3. Handle Payment Lifecycle Events ──────────────────────────────────────
$handledStatus = 'unhandled';
$invoiceGenerated = null;
$emailStatus = null;

switch ($event) {
    case 'payment.captured':
    case 'order.paid':
        $handledStatus = 'PAID';
        if (!empty($orderId)) {
            supabaseRequest("rest/v1/internal_payments?razorpay_order_id=eq.{$orderId}", 'PATCH', [
                'status' => PAYMENT_STATUS_PAID,
                'razorpay_payment_id' => $paymentId,
                'updated_at' => date('c'),
            ], true);

            // Fetch payment record
            $pmt = supabaseRequest("rest/v1/internal_payments?razorpay_order_id=eq.{$orderId}&limit=1", 'GET', null, true);
            $pmtRecord = ($pmt['ok'] && !empty($pmt['data'])) ? $pmt['data'][0] : [
                'id' => 'pay_webhook_' . bin2hex(random_bytes(6)),
                'tenant_id' => 'tenant_default',
                'plan_code' => 'avs_manufacturing_30k',
                'amount_paise' => $amountPaise,
                'currency' => $currency,
                'razorpay_order_id' => $orderId,
                'razorpay_payment_id' => $paymentId,
            ];

            $tenantId = $pmtRecord['tenant_id'] ?? 'tenant_default';
            $planCode = $pmtRecord['plan_code'] ?? 'avs_manufacturing_30k';
            $billingPeriod = $pmtRecord['billing_period'] ?? 'monthly';
            $days = ($billingPeriod === 'annual') ? 365 : 30;

            // Activate tenant subscription or Grant Credits
            if (strpos($planCode, 'credits_') === 0) {
                $credits = intval(substr($planCode, 8));
                supabaseRequest('rest/v1/rpc/grant_tenant_credits', 'POST', [
                    'p_credit_amount' => $credits,
                    'p_entry_type' => 'purchase',
                    'p_description' => "Webhook credit topup ({$paymentId})",
                    'p_metadata' => [
                        'razorpay_payment_id' => $paymentId,
                        'razorpay_order_id' => $orderId,
                        'event_id' => $eventId,
                    ],
                ], true);
            } else {
                supabaseRequest('rest/v1/tenant_subscriptions', 'POST', [
                    'tenant_id' => $tenantId,
                    'plan_code' => $planCode,
                    'status' => SUB_STATUS_ACTIVE,
                    'current_period_start' => date('c'),
                    'current_period_end' => date('c', time() + ($days * 86400)),
                    'updated_at' => date('c'),
                ], true);
            }

            // Automatically generate & email invoice
            $invoiceGenerated = generateAndStorePlatformInvoice(
                $pmtRecord,
                resolveTenantBillingContext($tenantId)
            );

            $dispatch = dispatchInvoiceEmail($invoiceGenerated);
            $emailStatus = $dispatch['email_status'];
        }
        break;

    case 'payment.failed':
        $handledStatus = 'FAILED';
        $errorReason = $payment['error_description'] ?? 'Payment authorization failed';
        if (!empty($orderId)) {
            supabaseRequest("rest/v1/internal_payments?razorpay_order_id=eq.{$orderId}", 'PATCH', [
                'status' => PAYMENT_STATUS_FAILED,
                'failure_reason' => $errorReason,
                'updated_at' => date('c'),
            ], true);
        }
        break;

    case 'refund.processed':
    case 'payment.refunded':
        $handledStatus = 'REFUNDED';
        $refundAmountPaise = intval($refund['amount'] ?? $amountPaise);
        if (!empty($paymentId)) {
            supabaseRequest("rest/v1/internal_payments?razorpay_payment_id=eq.{$paymentId}", 'PATCH', [
                'status' => PAYMENT_STATUS_REFUNDED,
                'updated_at' => date('c'),
            ], true);
        }
        break;

    case 'payment.authorized':
        $handledStatus = 'AUTHORIZED';
        if (!empty($orderId)) {
            supabaseRequest("rest/v1/internal_payments?razorpay_order_id=eq.{$orderId}", 'PATCH', [
                'status' => PAYMENT_STATUS_AUTHORIZED,
                'razorpay_payment_id' => $paymentId,
                'updated_at' => date('c'),
            ], true);
        }
        break;

    case 'subscription.activated':
    case 'subscription.resumed':
        $handledStatus = 'ACTIVE';
        $subNotes = $subscription['notes'] ?? [];
        $tenantId = $subNotes['tenant_id'] ?? 'tenant_default';
        $planCode = $subNotes['plan_code'] ?? 'avs_manufacturing_30k';
        supabaseRequest('rest/v1/tenant_subscriptions', 'POST', [
            'tenant_id' => $tenantId,
            'plan_code' => $planCode,
            'status' => SUB_STATUS_ACTIVE,
            'updated_at' => date('c'),
        ], true);
        break;

    case 'subscription.charged':
        $handledStatus = 'CHARGED';
        $subNotes = $subscription['notes'] ?? [];
        $tenantId = $subNotes['tenant_id'] ?? 'tenant_default';
        $planCode = $subNotes['plan_code'] ?? 'avs_manufacturing_30k';
        supabaseRequest('rest/v1/tenant_subscriptions', 'POST', [
            'tenant_id' => $tenantId,
            'plan_code' => $planCode,
            'status' => SUB_STATUS_ACTIVE,
            'current_period_end' => date('c', time() + (30 * 86400)),
            'updated_at' => date('c'),
        ], true);
        break;

    case 'subscription.cancelled':
        $handledStatus = 'CANCELLED';
        $subNotes = $subscription['notes'] ?? [];
        $tenantId = $subNotes['tenant_id'] ?? 'tenant_default';
        supabaseRequest("rest/v1/tenant_subscriptions?tenant_id=eq.{$tenantId}", 'PATCH', [
            'status' => SUB_STATUS_CANCELLED,
            'updated_at' => date('c'),
        ], true);
        break;

    case 'subscription.halted':
    case 'subscription.paused':
        $handledStatus = 'PAST_DUE';
        $subNotes = $subscription['notes'] ?? [];
        $tenantId = $subNotes['tenant_id'] ?? 'tenant_default';
        supabaseRequest("rest/v1/tenant_subscriptions?tenant_id=eq.{$tenantId}", 'PATCH', [
            'status' => SUB_STATUS_PAST_DUE,
            'updated_at' => date('c'),
        ], true);
        break;

    case 'settlement.processed':
        $handledStatus = 'SETTLED';
        break;

    default:
        $handledStatus = 'logged';
        break;
}

// ── 4. Audit Logging with Idempotency Mark ──────────────────────────────────
recordPaymentAudit('webhook_processed', $idempotencyKey, [
    'event' => $event,
    'event_id' => $eventId,
    'payment_id' => $paymentId,
    'order_id' => $orderId,
    'amount_paise' => $amountPaise,
    'currency' => $currency,
    'status' => $handledStatus,
    'invoice_no' => $invoiceGenerated['invoice_no'] ?? null,
    'email_status' => $emailStatus,
    'environment' => $mode,
]);

http_response_code(200);
echo json_encode([
    'success' => true,
    'event' => $event,
    'payment_id' => $paymentId,
    'order_id' => $orderId,
    'status' => $handledStatus,
    'invoice_no' => $invoiceGenerated['invoice_no'] ?? null,
    'email_status' => $emailStatus,
    'processed_at' => date('c'),
]);
