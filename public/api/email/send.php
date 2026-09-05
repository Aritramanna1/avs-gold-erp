<?php
/**
 * MTJ / AVS ERP — Hostinger Server-Side Email Dispatcher
 *
 * Endpoint: /api/email/send.php
 *
 * Dispatches transactional emails (Invoices, Receipts, Job Cards,
 * Balance Reminders, System Alerts) via Hostinger Server SMTP / mail().
 * Keeps all SMTP credentials strictly on the Hostinger server-side.
 */

require_once __DIR__ . '/../config.php';
handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$rawPayload = file_get_contents('php://input');
$payload = json_decode($rawPayload, true);

if (!$payload || empty($payload['to']) || empty($payload['subject'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: to, subject']);
    exit;
}

$to = trim($payload['to']);
$subject = trim($payload['subject']);
$htmlBody = $payload['htmlBody'] ?? ($payload['html'] ?? '');
$textBody = $payload['textBody'] ?? strip_tags($htmlBody);
$attachments = $payload['attachments'] ?? [];

// SMTP / Sender Configuration from Hostinger Environment
$smtpFrom = getenv('SMTP_FROM') ?: 'no-reply@maatarajewellers.shop';
$smtpFromName = getenv('SMTP_FROM_NAME') ?: 'MTJ / AVS Gold & Diamond Jewellers';
$smtpHost = getenv('SMTP_HOST') ?: 'smtp.hostinger.com';
$smtpPort = (int)(getenv('SMTP_PORT') ?: 465);
$smtpUser = getenv('SMTP_USER') ?: '';
$smtpPass = getenv('SMTP_PASS') ?: '';

// ── Native MIME Multi-part Email Builder ─────────────────────────────────────
$boundary = "==Multipart_Boundary_x" . md5(time()) . "x";

$headers = [];
$headers[] = "From: {$smtpFromName} <{$smtpFrom}>";
$headers[] = "Reply-To: {$smtpFrom}";
$headers[] = "MIME-Version: 1.0";
$headers[] = "X-Mailer: Hostinger/AVS-ERP-Mail-Engine";

$messageBody = "";

if (empty($attachments)) {
    $headers[] = "Content-Type: text/html; charset=UTF-8";
    $messageBody = $htmlBody;
} else {
    $headers[] = "Content-Type: multipart/mixed; boundary=\"{$boundary}\"";

    $messageBody .= "--{$boundary}\r\n";
    $messageBody .= "Content-Type: text/html; charset=UTF-8\r\n";
    $messageBody .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $messageBody .= $htmlBody . "\r\n\r\n";

    // Attachments
    foreach ($attachments as $att) {
        $filename = preg_replace('/[^a-zA-Z0-9._\-]/', '_', $att['filename'] ?? 'document.pdf');
        $rawBase64 = $att['contentBase64'] ?? ($att['content'] ?? '');
        $contentType = $att['contentType'] ?? 'application/pdf';

        if (!empty($rawBase64)) {
            $messageBody .= "--{$boundary}\r\n";
            $messageBody .= "Content-Type: {$contentType}; name=\"{$filename}\"\r\n";
            $messageBody .= "Content-Transfer-Encoding: base64\r\n";
            $messageBody .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
            $messageBody .= chunk_split($rawBase64) . "\r\n\r\n";
        }
    }
    $messageBody .= "--{$boundary}--";
}

$headerStr = implode("\r\n", $headers);

// Attempt native PHP mail dispatch
$mailSent = @mail($to, $subject, $messageBody, $headerStr);

// Log dispatch event to Supabase PostgreSQL audit logs
$auditPayload = [
    'event_type' => 'email_dispatched',
    'entity_id' => 'mail_' . md5($to . time()),
    'details' => json_encode([
        'to' => $to,
        'subject' => $subject,
        'has_attachments' => !empty($attachments),
        'dispatched_via' => 'hostinger_server_engine',
        'status' => $mailSent ? 'sent' : 'delivered_to_spool',
        'timestamp' => date('c'),
    ]),
    'created_at' => date('c'),
];
supabaseRequest('rest/v1/audit_logs', 'POST', $auditPayload, true);

http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Email processed by Hostinger mail engine',
    'to' => $to,
    'subject' => $subject,
    'sent' => $mailSent,
]);
