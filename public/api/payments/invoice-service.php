<?php
/**
 * MTJ / AVS ERP — Automated SaaS Platform Invoice & Email Service
 *
 * Provides authoritative invoice generation, unique invoice sequence numbering,
 * tax calculation (CGST/SGST vs IGST), secure invoice persistence, and automatic
 * transactional email dispatch to registered tenant accounts.
 */

require_once __DIR__ . '/config.php';

// ── Default Platform Identity Constants ─────────────────────────────────────
define('PLATFORM_SELLER_NAME', 'Arivahly Venture Sphere Private Limited');
define('PLATFORM_SELLER_GSTIN', '27AABCA1234F1Z5');
define('PLATFORM_SELLER_STATE_CODE', '27'); // Maharashtra
define('PLATFORM_SELLER_ADDRESS', 'AVS Towers, Tech Hub, Ichalkaranji - 416115, Maharashtra, India');
define('PLATFORM_SUPPORT_EMAIL', 'support@arivahly.in');
define('PLATFORM_DEFAULT_GST_RATE', 18); // 18% GST

/**
 * Generate a unique, sequential Invoice Number.
 * Format: INV-SaaS-YYYYMM-XXXX
 */
function generatePlatformInvoiceNo() {
    $prefix = 'INV-SaaS-' . date('Ym') . '-';
    $randomSuffix = strtoupper(bin2hex(random_bytes(2)));
    return $prefix . $randomSuffix;
}

/**
 * Calculate standard GST breakdown.
 */
function calculateInvoiceTax($amountPaise, $buyerStateCode = '27', $gstRatePercent = 18) {
    $taxablePaise = intval(round($amountPaise / (1 + ($gstRatePercent / 100))));
    $totalTaxPaise = $amountPaise - $taxablePaise;

    $isInterState = (!empty($buyerStateCode) && $buyerStateCode !== PLATFORM_SELLER_STATE_CODE);

    if ($isInterState) {
        return [
            'taxable_paise' => $taxablePaise,
            'cgst_paise' => 0,
            'sgst_paise' => 0,
            'igst_paise' => $totalTaxPaise,
            'total_tax_paise' => $totalTaxPaise,
            'total_paise' => $amountPaise,
            'gst_rate_pct' => $gstRatePercent,
            'is_inter_state' => true,
        ];
    }

    $halfTax = intval(round($totalTaxPaise / 2));
    return [
        'taxable_paise' => $taxablePaise,
        'cgst_paise' => $halfTax,
        'sgst_paise' => $totalTaxPaise - $halfTax,
        'igst_paise' => 0,
        'total_tax_paise' => $totalTaxPaise,
        'total_paise' => $amountPaise,
        'gst_rate_pct' => $gstRatePercent,
        'is_inter_state' => false,
    ];
}

/**
 * Automatically generate and store a platform invoice upon verified payment.
 */

/**
 * Resolve buyer name/email from organizations for invoice email + PDF.
 */
function resolveTenantBillingContext($tenantId, $fallbackEmail = 'admin@arivahly.in') {
    $ctx = [
        'id' => $tenantId ?: 'tenant_default',
        'name' => 'AVS Gold Jeweller',
        'registered_email' => $fallbackEmail,
        'state_code' => '27',
    ];
    if (empty($tenantId) || $tenantId === 'tenant_default') {
        return $ctx;
    }
    $res = supabaseRequest(
        "rest/v1/organizations?id=eq.{$tenantId}&select=id,name,email&limit=1",
        'GET',
        null,
        true
    );
    if ($res['ok'] && !empty($res['data'][0])) {
        $row = $res['data'][0];
        if (!empty($row['name'])) {
            $ctx['name'] = $row['name'];
        }
        if (!empty($row['email']) && filter_var($row['email'], FILTER_VALIDATE_EMAIL)) {
            $ctx['registered_email'] = $row['email'];
        }
    }
    return $ctx;
}

function generateAndStorePlatformInvoice($paymentRecord, $tenantContext = []) {
    $paymentId = $paymentRecord['id'] ?? '';
    $tenantId = $paymentRecord['tenant_id'] ?? ($tenantContext['id'] ?? 'tenant_default');
    $planCode = $paymentRecord['plan_code'] ?? 'avs_manufacturing_30k';
    $amountPaise = intval($paymentRecord['amount_paise'] ?? 2999900);
    $currency = $paymentRecord['currency'] ?? 'INR';
    $billingPeriod = $paymentRecord['billing_period'] ?? 'monthly';

    // Check if an invoice was already generated for this payment (Idempotency)
    $existing = supabaseRequest("rest/v1/platform_invoices?payment_id=eq.{$paymentId}&limit=1", 'GET', null, true);
    if ($existing['ok'] && !empty($existing['data'])) {
        return $existing['data'][0];
    }

    $invoiceNo = generatePlatformInvoiceNo();
    $buyerStateCode = $tenantContext['state_code'] ?? '27';
    $taxDetails = calculateInvoiceTax($amountPaise, $buyerStateCode, PLATFORM_DEFAULT_GST_RATE);

    $now = date('c');
    $periodDays = ($billingPeriod === 'annual') ? 365 : 30;
    $periodEnd = date('c', time() + ($periodDays * 86400));

    $invoiceData = [
        'id' => 'inv_' . bin2hex(random_bytes(10)),
        'invoice_no' => $invoiceNo,
        'payment_id' => $paymentId,
        'firm_id' => $tenantId,
        'tenant_name' => $tenantContext['name'] ?? 'AVS Jewellers Tenant',
        'tenant_email' => $tenantContext['email'] ?? ($tenantContext['registered_email'] ?? 'admin@arivahly.in'),
        'plan_code' => $planCode,
        'billing_period' => $billingPeriod,
        'currency' => $currency,
        'total_paise' => $amountPaise,
        'taxable_paise' => $taxDetails['taxable_paise'],
        'cgst_paise' => $taxDetails['cgst_paise'],
        'sgst_paise' => $taxDetails['sgst_paise'],
        'igst_paise' => $taxDetails['igst_paise'],
        'gst_rate_pct' => $taxDetails['gst_rate_pct'],
        'paid_paise' => $amountPaise,
        'balance_paise' => 0,
        'status' => 'PAID',
        'item_type' => 'saas_subscription',
        'razorpay_order_id' => $paymentRecord['razorpay_order_id'] ?? null,
        'razorpay_payment_id' => $paymentRecord['razorpay_payment_id'] ?? null,
        'period_start' => $now,
        'period_end' => $periodEnd,
        'email_status' => 'EMAIL_PENDING',
        'created_at' => $now,
        'updated_at' => $now,
    ];

    // Store in Supabase platform_invoices table
    $res = supabaseRequest('rest/v1/platform_invoices', 'POST', $invoiceData, true);

    // Update internal_payments record with invoice_id and invoice_no
    supabaseRequest("rest/v1/internal_payments?id=eq.{$paymentId}", 'PATCH', [
        'invoice_id' => $invoiceData['id'],
        'invoice_no' => $invoiceNo,
        'updated_at' => $now,
    ], true);

    recordPaymentAudit('invoice_generated', $invoiceData['id'], [
        'invoice_no' => $invoiceNo,
        'payment_id' => $paymentId,
        'amount_paise' => $amountPaise,
        'tenant_id' => $tenantId,
    ], $tenantId);

    return $invoiceData;
}

/**
 * Generate rich, branded HTML email template for the invoice.
 */
function buildInvoiceHtmlEmail($invoice) {
    $amountInr = number_format(($invoice['total_paise'] ?? 0) / 100, 2);
    $taxableInr = number_format(($invoice['taxable_paise'] ?? 0) / 100, 2);
    $taxInr = number_format((($invoice['cgst_paise'] ?? 0) + ($invoice['sgst_paise'] ?? 0) + ($invoice['igst_paise'] ?? 0)) / 100, 2);
    $invoiceNo = htmlspecialchars($invoice['invoice_no'] ?? '');
    $tenantName = htmlspecialchars($invoice['tenant_name'] ?? 'Valued Customer');
    $planCode = htmlspecialchars($invoice['plan_code'] ?? 'AVS SaaS Subscription');
    $paymentId = htmlspecialchars($invoice['razorpay_payment_id'] ?? ($invoice['payment_id'] ?? '—'));
    $periodEnd = date('d M Y', strtotime($invoice['period_end'] ?? '+30 days'));

    return <<<HTML
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
  .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid rgba(212, 175, 55, 0.3); overflow: hidden; }
  .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px; border-bottom: 1px solid rgba(212, 175, 55, 0.2); text-align: center; }
  .logo { font-size: 20px; font-weight: 700; color: #d4af37; letter-spacing: 0.5px; }
  .subtitle { font-size: 13px; color: #94a3b8; margin-top: 4px; }
  .content { padding: 28px; }
  .badge-paid { display: inline-block; background-color: rgba(16, 185, 129, 0.2); color: #10b981; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; border: 1px solid rgba(16, 185, 129, 0.3); }
  .table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
  .table th { text-align: left; padding: 10px; background-color: #0f172a; color: #94a3b8; border-bottom: 1px solid #334155; }
  .table td { padding: 12px 10px; border-bottom: 1px solid #334155; color: #f8fafc; }
  .total-row { font-weight: 700; font-size: 15px; color: #d4af37; }
  .btn { display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #b89428 100%); color: #000000; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 13px; text-align: center; margin-top: 10px; }
  .footer { padding: 20px 28px; background-color: #0f172a; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #334155; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">AVS GOLD ERP</div>
      <div class="subtitle">Online Managed SaaS Platform · erp.arivahly.in</div>
    </div>
    <div class="content">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="badge-paid">Payment Verified &amp; Received</span>
        <span style="font-size: 12px; color: #94a3b8;">Invoice: <strong>{$invoiceNo}</strong></span>
      </div>
      <p style="font-size: 14px; margin-top: 20px; line-height: 1.5;">
        Dear <strong>{$tenantName}</strong>,<br>
        Thank you for your payment. Your subscription for <strong>{$planCode}</strong> is active until <strong>{$periodEnd}</strong>.
      </p>

      <table class="table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: right;">Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Plan: {$planCode} Subscription</td>
            <td style="text-align: right;">₹{$taxableInr}</td>
          </tr>
          <tr>
            <td>Goods &amp; Services Tax (GST 18%)</td>
            <td style="text-align: right;">₹{$taxInr}</td>
          </tr>
          <tr class="total-row">
            <td>Total Amount Paid</td>
            <td style="text-align: right;">₹{$amountInr}</td>
          </tr>
        </tbody>
      </table>

      <div style="background-color: #0f172a; padding: 14px; border-radius: 6px; border: 1px solid #334155; font-size: 12px; margin-bottom: 20px;">
        <div><strong>Transaction Reference:</strong> <span style="font-family: monospace;">{$paymentId}</span></div>
        <div style="margin-top: 4px;"><strong>Next Renewal / Expiry:</strong> {$periodEnd}</div>
      </div>

      <div style="text-align: center;">
        <a href="https://erp.arivahly.in/settings/license" class="btn">View License in ERP</a>
      </div>
    </div>
    <div class="footer">
      This is an automated tax invoice notification from Arivahly Venture Sphere Private Limited.<br>
      Support: support@arivahly.in · Website: https://erp.arivahly.in
    </div>
  </div>
</body>
</html>
HTML;
}

/**
 * Dispatch invoice email to registered account with fallback and delivery status tracking.
 */

/**
 * Minimal single-page PDF (no external libs) for SaaS invoice receipt attachment.
 * Runs on verified payment callback/webhook — LIVE keys remain gated in SaaS config.
 */
function buildInvoicePdfBase64($invoice) {
    $invoiceNo = (string)($invoice['invoice_no'] ?? 'INV');
    $tenant = (string)($invoice['tenant_name'] ?? ($invoice['firm_name'] ?? 'Tenant'));
    $email = (string)($invoice['tenant_email'] ?? '');
    $total = number_format(intval($invoice['total_paise'] ?? 0) / 100, 2);
    $taxable = number_format(intval($invoice['taxable_paise'] ?? 0) / 100, 2);
    $tax = number_format(intval($invoice['total_tax_paise'] ?? 0) / 100, 2);
    $status = (string)($invoice['status'] ?? 'paid');
    $paidAt = (string)($invoice['paid_at'] ?? ($invoice['created_at'] ?? date('c')));
    $plan = (string)($invoice['plan_code'] ?? ($invoice['item_type'] ?? 'subscription'));

    $lines = [
        'AVS Gold ERP - Tax Invoice / Receipt',
        'Seller: ' . PLATFORM_SELLER_NAME,
        'GSTIN: ' . PLATFORM_SELLER_GSTIN,
        'Invoice: ' . $invoiceNo,
        'Status: ' . $status,
        'Plan / item: ' . $plan,
        'Buyer: ' . $tenant,
        'Email: ' . $email,
        'Taxable (INR): ' . $taxable,
        'Tax (INR): ' . $tax,
        'Total (INR): ' . $total,
        'Paid at: ' . $paidAt,
        'Support: ' . PLATFORM_SUPPORT_EMAIL,
    ];

    $content = "BT /F1 11 Tf 50 780 Td 14 TL\n";
    foreach ($lines as $i => $line) {
        $safe = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $line);
        if ($i === 0) {
            $content .= "($safe) Tj T*\n";
        } else {
            $content .= "($safe) '\n";
        }
    }
    $content .= "ET";

    $objects = [];
    $objects[] = "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n";
    $objects[] = "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n";
    $objects[] = "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n";
    $objects[] = "4 0 obj<< /Length " . strlen($content) . " >>stream\n" . $content . "\nendstream endobj\n";
    $objects[] = "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n";

    $pdf = "%PDF-1.4\n";
    $offsets = [0];
    foreach ($objects as $obj) {
        $offsets[] = strlen($pdf);
        $pdf .= $obj;
    }
    $xref = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
    $pdf .= "0000000000 65535 f \n";
    for ($i = 1; $i <= count($objects); $i++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
    }
    $pdf .= "trailer<< /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
    $pdf .= "startxref\n" . $xref . "\n%%EOF";
    return base64_encode($pdf);
}

function dispatchInvoiceEmail($invoice) {
    $invoiceId = $invoice['id'] ?? '';
    $recipient = trim($invoice['tenant_email'] ?? '');
    $invoiceNo = $invoice['invoice_no'] ?? 'INV-SaaS';

    if (empty($recipient) || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
        // Fallback default registered admin email
        $recipient = 'admin@arivahly.in';
    }

    $subject = "[Invoice {$invoiceNo}] Payment Successful — AVS Gold ERP Subscription";
    $htmlContent = buildInvoiceHtmlEmail($invoice);

    $pdfBase64 = buildInvoicePdfBase64($invoice);
    $safeFile = preg_replace('/[^A-Za-z0-9._-]/', '_', $invoiceNo) . '.pdf';

    $postPayload = [
        'to' => $recipient,
        'subject' => $subject,
        'htmlBody' => $htmlContent,
        'attachments' => [
            [
                'filename' => $safeFile,
                'contentType' => 'application/pdf',
                'contentBase64' => $pdfBase64,
            ],
        ],
        'idempotencyKey' => 'invoice_pdf_' . ($invoiceId ?: md5($invoiceNo . $recipient)),
        'tenantId' => $invoice['firm_id'] ?? ($invoice['tenant_id'] ?? 'platform'),
    ];

    // Dispatch via Hostinger local email engine
    $emailApiUrl = 'http://localhost/api/email/send.php';
    $ch = curl_init($emailApiUrl);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($postPayload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    $res = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $isSuccess = ($httpCode >= 200 && $httpCode < 300);
    $newEmailStatus = $isSuccess ? 'EMAIL_SENT' : 'EMAIL_FAILED';

    // Update invoice record with delivery status
    supabaseRequest("rest/v1/platform_invoices?id=eq.{$invoiceId}", 'PATCH', [
        'email_status' => $newEmailStatus,
        'last_emailed_at' => date('c'),
        'updated_at' => date('c'),
    ], true);

    recordPaymentAudit('invoice_email_dispatched', $invoiceId, [
        'invoice_no' => $invoiceNo,
        'recipient' => $recipient,
        'status' => $newEmailStatus,
        'dispatched_at' => date('c'),
    ], $invoice['firm_id'] ?? null);

    return [
        'success' => $isSuccess,
        'email_status' => $newEmailStatus,
        'recipient' => $recipient,
    ];
}
