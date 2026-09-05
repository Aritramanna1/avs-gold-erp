<?php
/**
 * MTJ / AVS ERP — Hostinger Master Payment Configuration & Helper Library
 *
 * Provides shared payment configuration, secure credential masking,
 * TEST/LIVE mode isolation, signature verification, and database persistence.
 */

require_once __DIR__ . '/../config.php';

// ── Default Payment Settings & State Constants ──────────────────────────────
define('PAYMENT_STATUS_CREATED', 'CREATED');
define('PAYMENT_STATUS_PENDING', 'PENDING');
define('PAYMENT_STATUS_AUTHORIZED', 'AUTHORIZED');
define('PAYMENT_STATUS_PAID', 'PAID');
define('PAYMENT_STATUS_FAILED', 'FAILED');
define('PAYMENT_STATUS_CANCELLED', 'CANCELLED');
define('PAYMENT_STATUS_EXPIRED', 'EXPIRED');
define('PAYMENT_STATUS_REFUNDED', 'REFUNDED');
define('PAYMENT_STATUS_PARTIALLY_REFUNDED', 'PARTIALLY_REFUNDED');
define('PAYMENT_STATUS_DISPUTED', 'DISPUTED');
define('PAYMENT_STATUS_VERIFICATION_PENDING', 'VERIFICATION_PENDING');

define('SUB_STATUS_TRIAL', 'TRIAL');
define('SUB_STATUS_ACTIVE', 'ACTIVE');
define('SUB_STATUS_PAST_DUE', 'PAST_DUE');
define('SUB_STATUS_GRACE_PERIOD', 'GRACE_PERIOD');
define('SUB_STATUS_SUSPENDED', 'SUSPENDED');
define('SUB_STATUS_CANCELLED', 'CANCELLED');
define('SUB_STATUS_EXPIRED', 'EXPIRED');

/**
 * Mask secret string for safe display in Admin Panel.
 */
function maskSecret($secret) {
    if (empty($secret)) return 'Not Configured';
    $len = strlen($secret);
    if ($len <= 8) return str_repeat('•', 8);
    return substr($secret, 0, 4) . str_repeat('•', 8) . substr($secret, -4);
}

/**
 * Fetch authoritative payment gateway configuration from DB or fallback env.
 */
function getAuthoritativePaymentConfig() {
    global $RAZORPAY_KEY_ID, $RAZORPAY_KEY_SECRET, $RAZORPAY_WEBHOOK_SECRET;

    // Check DB for persisted configuration
    $dbRes = supabaseRequest('rest/v1/payment_gateway_configs?provider=eq.razorpay&limit=1', 'GET', null, true);
    $dbConfig = ($dbRes['ok'] && !empty($dbRes['data'])) ? $dbRes['data'][0] : null;

    $mode = $dbConfig['mode'] ?? (getenv('RAZORPAY_MODE') ?: 'TEST');
    $mode = strtoupper($mode) === 'LIVE' ? 'LIVE' : 'TEST';

    $testKeyId = $dbConfig['test_key_id'] ?? (getenv('RAZORPAY_TEST_KEY_ID') ?: $RAZORPAY_KEY_ID);
    $testKeySecret = $dbConfig['test_key_secret'] ?? (getenv('RAZORPAY_TEST_KEY_SECRET') ?: $RAZORPAY_KEY_SECRET);
    $testWebhookSecret = $dbConfig['test_webhook_secret'] ?? (getenv('RAZORPAY_TEST_WEBHOOK_SECRET') ?: $RAZORPAY_WEBHOOK_SECRET);
    $testReturnUrl = $dbConfig['test_callback_url'] ?? (getenv('RAZORPAY_TEST_RETURN_URL') ?: 'https://erp.arivahly.in/settings/license?payment=callback');
    $testWebhookUrl = $dbConfig['test_webhook_url'] ?? (getenv('RAZORPAY_TEST_WEBHOOK_URL') ?: 'https://erp.arivahly.in/api/webhooks/razorpay.php');

    $liveKeyId = $dbConfig['live_key_id'] ?? getenv('RAZORPAY_LIVE_KEY_ID');
    $liveKeySecret = $dbConfig['live_key_secret'] ?? getenv('RAZORPAY_LIVE_KEY_SECRET');
    $liveWebhookSecret = $dbConfig['live_webhook_secret'] ?? getenv('RAZORPAY_LIVE_WEBHOOK_SECRET');
    $liveReturnUrl = $dbConfig['live_callback_url'] ?? (getenv('RAZORPAY_LIVE_RETURN_URL') ?: 'https://erp.arivahly.in/settings/license?payment=callback');
    $liveWebhookUrl = $dbConfig['live_webhook_url'] ?? (getenv('RAZORPAY_LIVE_WEBHOOK_URL') ?: 'https://erp.arivahly.in/api/webhooks/razorpay.php');

    $activeKeyId = ($mode === 'LIVE') ? $liveKeyId : $testKeyId;
    $activeKeySecret = ($mode === 'LIVE') ? $liveKeySecret : $testKeySecret;
    $activeWebhookSecret = ($mode === 'LIVE') ? $liveWebhookSecret : $testWebhookSecret;
    $activeReturnUrl = ($mode === 'LIVE') ? $liveReturnUrl : $testReturnUrl;
    $activeWebhookUrl = ($mode === 'LIVE') ? $liveWebhookUrl : $testWebhookUrl;

    return [
        'mode' => $mode,
        'active' => [
            'key_id' => $activeKeyId,
            'key_secret' => $activeKeySecret,
            'webhook_secret' => $activeWebhookSecret,
            'return_url' => $activeReturnUrl,
            'webhook_url' => $activeWebhookUrl,
            'is_configured' => !empty($activeKeyId) && !empty($activeKeySecret),
        ],
        'test' => [
            'key_id' => $testKeyId,
            'key_secret' => $testKeySecret,
            'webhook_secret' => $testWebhookSecret,
            'return_url' => $testReturnUrl,
            'webhook_url' => $testWebhookUrl,
            'is_configured' => !empty($testKeyId) && !empty($testKeySecret),
        ],
        'live' => [
            'key_id' => $liveKeyId,
            'key_secret' => $liveKeySecret,
            'webhook_secret' => $liveWebhookSecret,
            'return_url' => $liveReturnUrl,
            'webhook_url' => $liveWebhookUrl,
            'is_configured' => !empty($liveKeyId) && !empty($liveKeySecret),
        ],
        'last_verified_at' => $dbConfig['last_verified_at'] ?? null,
        'last_error' => $dbConfig['last_error'] ?? null,
    ];
}

/**
 * Verify Razorpay Checkout return signature server-side.
 * expectedSignature = HMAC_SHA256(orderId + "|" + paymentId, keySecret)
 */
function verifyRazorpayReturnSignature($orderId, $paymentId, $signature, $secret) {
    if (empty($orderId) || empty($paymentId) || empty($signature) || empty($secret)) {
        return false;
    }
    $generatedSignature = hash_hmac('sha256', $orderId . '|' . $paymentId, $secret);
    return hash_equals($generatedSignature, $signature);
}

/**
 * Verify Razorpay Webhook signature server-side.
 * expectedSignature = HMAC_SHA256(rawPayload, webhookSecret)
 */
function verifyRazorpayWebhookSignature($rawPayload, $signature, $webhookSecret) {
    if (empty($rawPayload) || empty($signature) || empty($webhookSecret)) {
        return false;
    }
    $expectedSignature = hash_hmac('sha256', $rawPayload, $webhookSecret);
    return hash_equals($expectedSignature, $signature);
}

/**
 * Record Payment Audit Log.
 */
function recordPaymentAudit($eventType, $entityId, $details, $tenantId = null, $actorId = null) {
    $auditRecord = [
        'event_type' => 'payment_' . $eventType,
        'entity_id' => $entityId,
        'tenant_id' => $tenantId,
        'actor_id' => $actorId,
        'details' => json_encode($details),
        'created_at' => date('c'),
    ];
    return supabaseRequest('rest/v1/audit_logs', 'POST', $auditRecord, true);
}
