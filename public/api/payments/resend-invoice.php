<?php
/**
 * MTJ / AVS ERP — Admin Resend Invoice Endpoint
 *
 * Endpoint: /api/payments/resend-invoice.php
 *
 * Allows platform administrators to manually resend or retry delivering
 * verified tax invoices to registered tenant emails without duplicating invoices.
 */

require_once __DIR__ . '/invoice-service.php';
handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: [];

$invoiceId = trim($data['invoice_id'] ?? '');
$customEmail = trim($data['recipient_email'] ?? '');

if (empty($invoiceId)) {
    http_response_code(400);
    echo json_encode(['error' => 'invoice_id is required']);
    exit;
}

// Fetch invoice from database
$res = supabaseRequest("rest/v1/platform_invoices?id=eq.{$invoiceId}&limit=1", 'GET', null, true);
if (!$res['ok'] || empty($res['data'])) {
    http_response_code(404);
    echo json_encode(['error' => 'Invoice not found']);
    exit;
}

$invoice = $res['data'][0];

if (!empty($customEmail) && filter_var($customEmail, FILTER_VALIDATE_EMAIL)) {
    $invoice['tenant_email'] = $customEmail;
    // Update invoice record with updated email
    supabaseRequest("rest/v1/platform_invoices?id=eq.{$invoiceId}", 'PATCH', [
        'tenant_email' => $customEmail,
    ], true);
}

$dispatchResult = dispatchInvoiceEmail($invoice);

http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => "Invoice {$invoice['invoice_no']} sent to {$dispatchResult['recipient']}",
    'email_status' => $dispatchResult['email_status'],
    'recipient' => $dispatchResult['recipient'],
]);
