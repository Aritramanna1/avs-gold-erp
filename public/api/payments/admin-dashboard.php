<?php
/**
 * MTJ / AVS ERP — Hostinger Admin Payment Dashboard & Reconciliation API
 *
 * Endpoint: /api/payments/admin-dashboard.php
 *
 * Supplies aggregated payment telemetry, multi-filter search, subscription metrics,
 * and automated discrepancy reconciliation across internal payments and gateway states.
 */

require_once __DIR__ . '/config.php';
handleCors();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'overview';

// ── 1. Overview Telemetry & Aggregated Stats ────────────────────────────────
if ($action === 'overview') {
    $paymentsRes = supabaseRequest('rest/v1/internal_payments?order=created_at.desc&limit=100', 'GET', null, true);
    $subsRes = supabaseRequest('rest/v1/tenant_subscriptions?order=created_at.desc&limit=100', 'GET', null, true);

    $payments = ($paymentsRes['ok'] && is_array($paymentsRes['data'])) ? $paymentsRes['data'] : [];
    $subs = ($subsRes['ok'] && is_array($subsRes['data'])) ? $subsRes['data'] : [];

    $stats = [
        'payments' => [
            'total_count' => count($payments),
            'paid_count' => 0,
            'pending_count' => 0,
            'failed_count' => 0,
            'refunded_count' => 0,
            'total_volume_paise' => 0,
        ],
        'subscriptions' => [
            'total_count' => count($subs),
            'active_count' => 0,
            'trial_count' => 0,
            'past_due_count' => 0,
            'grace_count' => 0,
            'suspended_count' => 0,
            'expired_count' => 0,
        ],
        'reconciliation_alerts' => [],
    ];

    foreach ($payments as $p) {
        $status = $p['status'] ?? 'PENDING';
        if ($status === PAYMENT_STATUS_PAID) {
            $stats['payments']['paid_count']++;
            $stats['payments']['total_volume_paise'] += intval($p['amount_paise'] ?? 0);
        } elseif ($status === PAYMENT_STATUS_PENDING) {
            $stats['payments']['pending_count']++;
        } elseif ($status === PAYMENT_STATUS_FAILED) {
            $stats['payments']['failed_count']++;
        } elseif (in_array($status, [PAYMENT_STATUS_REFUNDED, PAYMENT_STATUS_PARTIALLY_REFUNDED])) {
            $stats['payments']['refunded_count']++;
        }
    }

    foreach ($subs as $s) {
        $status = $s['status'] ?? 'TRIAL';
        if ($status === SUB_STATUS_ACTIVE) $stats['subscriptions']['active_count']++;
        elseif ($status === SUB_STATUS_TRIAL) $stats['subscriptions']['trial_count']++;
        elseif ($status === SUB_STATUS_PAST_DUE) $stats['subscriptions']['past_due_count']++;
        elseif ($status === SUB_STATUS_GRACE_PERIOD) $stats['subscriptions']['grace_count']++;
        elseif ($status === SUB_STATUS_SUSPENDED) $stats['subscriptions']['suspended_count']++;
        elseif ($status === SUB_STATUS_EXPIRED) $stats['subscriptions']['expired_count']++;
    }

    // ── Automated Reconciliation Audit Check ────────────────────────────────
    foreach ($payments as $p) {
        // If payment has Razorpay payment ID recorded but status is PENDING, flag mismatch
        if (!empty($p['razorpay_payment_id']) && $p['status'] === PAYMENT_STATUS_PENDING) {
            $stats['reconciliation_alerts'][] = [
                'type' => 'PAYMENT_STATE_MISMATCH',
                'severity' => 'WARNING',
                'internal_payment_id' => $p['id'],
                'razorpay_order_id' => $p['razorpay_order_id'],
                'razorpay_payment_id' => $p['razorpay_payment_id'],
                'description' => 'Payment captured at gateway but marked as PENDING internally. Reconcile to resolve.',
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'recent_payments' => array_slice($payments, 0, 15),
        'recent_subscriptions' => array_slice($subs, 0, 15),
    ]);
    exit;
}

// ── 2. Multi-Criteria Payment Search ────────────────────────────────────────
if ($action === 'search') {
    $q = trim($_GET['q'] ?? '');
    $status = trim($_GET['status'] ?? '');
    $tenantId = trim($_GET['tenant_id'] ?? '');

    $filter = 'order=created_at.desc&limit=50';
    if (!empty($status)) {
        $filter .= "&status=eq.{$status}";
    }
    if (!empty($tenantId)) {
        $filter .= "&tenant_id=eq.{$tenantId}";
    }

    $res = supabaseRequest("rest/v1/internal_payments?{$filter}", 'GET', null, true);
    $items = ($res['ok'] && is_array($res['data'])) ? $res['data'] : [];

    // Client search filter for generic query (order ID, payment ID, ref)
    if (!empty($q)) {
        $qLower = strtolower($q);
        $items = array_filter($items, function($item) use ($qLower) {
            return (
                strpos(strtolower($item['id'] ?? ''), $qLower) !== false ||
                strpos(strtolower($item['razorpay_order_id'] ?? ''), $qLower) !== false ||
                strpos(strtolower($item['razorpay_payment_id'] ?? ''), $qLower) !== false ||
                strpos(strtolower($item['tenant_id'] ?? ''), $qLower) !== false ||
                strpos(strtolower($item['plan_code'] ?? ''), $qLower) !== false
            );
        });
        $items = array_values($items);
    }

    echo json_encode(['success' => true, 'count' => count($items), 'payments' => $items]);
    exit;
}

// ── 3. Manual Reconciliation Fix ────────────────────────────────────────────
if ($action === 'reconcile_fix' && $method === 'POST') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true) ?: [];
    $paymentId = trim($data['payment_id'] ?? '');
    $forcedStatus = trim($data['target_status'] ?? PAYMENT_STATUS_PAID);

    if (empty($paymentId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Payment ID is required']);
        exit;
    }

    supabaseRequest("rest/v1/internal_payments?id=eq.{$paymentId}", 'PATCH', [
        'status' => $forcedStatus,
        'updated_at' => date('c'),
    ], true);

    recordPaymentAudit('manual_reconciliation_applied', $paymentId, [
        'forced_status' => $forcedStatus,
        'reason' => $data['reason'] ?? 'Admin manual reconciliation resolution',
    ]);

    echo json_encode(['success' => true, 'message' => "Payment {$paymentId} reconciled to {$forcedStatus}"]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Invalid action']);
