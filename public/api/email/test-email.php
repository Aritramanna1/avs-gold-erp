<?php
/**
 * AVS Gold ERP — Hostinger SMTP Test Email Dispatcher
 *
 * Endpoint: POST /api/email/test-email.php
 *
 * Dispatches a live test email through Hostinger SMTP with server-side AVS Gold ERP branding.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/secrets.php';
require_once __DIR__ . '/HostingerSmtpClient.php';

handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true) ?: [];

$to = trim($payload['to'] ?? '');
if (empty($to) || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Valid recipient email address is required.']);
    exit;
}

$creds = loadHostingerCredentials();

// Allow overrides from payload for testing prior to save
$host = !empty($payload['host']) ? trim($payload['host']) : $creds['host'];
$port = !empty($payload['port']) ? (int)$payload['port'] : $creds['port'];
$encryption = !empty($payload['encryption']) ? trim($payload['encryption']) : $creds['encryption'];
$username = !empty($payload['username']) ? trim($payload['username']) : $creds['username'];
$password = !empty($payload['password']) ? trim($payload['password']) : $creds['password'];
$fromEmail = !empty($payload['fromEmail']) ? trim($payload['fromEmail']) : ($creds['fromEmail'] ?: $username);
$fromName = !empty($payload['fromName']) ? trim($payload['fromName']) : $creds['fromName'];
$replyTo = !empty($payload['replyTo']) ? trim($payload['replyTo']) : $creds['replyTo'];

if (empty($username) || empty($password)) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'status' => 'HOSTINGER_EMAIL_NOT_CONFIGURED',
        'error' => 'Hostinger Email not configured. Enter Hostinger mailbox + SMTP password to enable email delivery.',
    ]);
    exit;
}

$subject = "AVS Gold ERP — Hostinger Email Delivery Verification";
$timestamp = date('d M Y, H:i:s T');
$htmlBody = "
<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; line-height: 1.6;\">
  <div style=\"background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 24px; margin-bottom: 20px;\">
    <div style=\"color: #b45309; font-weight: 800; font-size: 16px; margin-bottom: 8px;\">
      Hostinger SMTP Delivery Verified
    </div>
    <p style=\"margin: 0 0 16px 0; font-size: 13px; color: #44403c;\">
      This is a real test email dispatched from your <strong>AVS Gold ERP Platform</strong> via Hostinger SMTP.
    </p>
    <table style=\"width: 100%; border-collapse: collapse; font-size: 12px;\">
      <tr>
        <td style=\"padding: 6px 0; color: #78716c; width: 140px;\">SMTP Server:</td>
        <td style=\"padding: 6px 0; font-family: monospace; font-weight: bold;\">{$host}:{$port} ({$encryption})</td>
      </tr>
      <tr>
        <td style=\"padding: 6px 0; color: #78716c;\">Sender Identity:</td>
        <td style=\"padding: 6px 0; font-family: monospace;\">{$fromName} &lt;{$fromEmail}&gt;</td>
      </tr>
      <tr>
        <td style=\"padding: 6px 0; color: #78716c;\">Authenticated User:</td>
        <td style=\"padding: 6px 0; font-family: monospace;\">{$username}</td>
      </tr>
      <tr>
        <td style=\"padding: 6px 0; color: #78716c;\">Dispatch Time:</td>
        <td style=\"padding: 6px 0; font-family: monospace;\">{$timestamp}</td>
      </tr>
    </table>
  </div>
  <p style=\"font-size: 12px; color: #57534e;\">
    All platform communications, invoice dispatches, quotations, and account notifications will now route reliably through this Hostinger email provider.
  </p>
</div>";

try {
    $client = new HostingerSmtpClient($host, $port, $encryption, $username, $password);
    $sendResult = $client->sendMail([
        'to' => $to,
        'subject' => $subject,
        'htmlBody' => $htmlBody,
        'fromEmail' => $fromEmail,
        'fromName' => $fromName,
        'replyTo' => $replyTo,
        'tenantId' => 'platform',
    ]);

    // Record audit event
    supabaseRequest('rest/v1/platform_audit_events', 'POST', [
        'action' => 'EMAIL_DISPATCHED',
        'target_type' => 'email_test',
        'reason' => "Hostinger test email sent to {$to} (Message-ID: {$sendResult['messageId']})",
        'created_at' => date('c'),
    ], true);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'status' => 'SENT',
        'messageId' => $sendResult['messageId'],
        'provider' => 'Hostinger Email',
        'smtpHost' => "{$host}:{$port}",
        'to' => $to,
        'from' => "{$fromName} <{$fromEmail}>",
        'timestamp' => $sendResult['timestamp'],
        'deliveryResult' => $sendResult['smtpResponse'],
    ]);
} catch (Exception $e) {
    supabaseRequest('rest/v1/platform_audit_events', 'POST', [
        'action' => 'EMAIL_FAILED',
        'target_type' => 'email_test',
        'reason' => "Hostinger test email failed for {$to}: {$e->getMessage()}",
        'created_at' => date('c'),
    ], true);

    http_response_code(200);
    echo json_encode([
        'success' => false,
        'status' => 'FAILED',
        'error' => $e->getMessage(),
        'host' => $host,
        'port' => $port,
    ]);
}
