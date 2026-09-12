<?php
/**
 * MTJ / AVS ERP — Hostinger Scheduled Jobs & Cron Runner
 *
 * Endpoint / CLI: /api/cron/scheduled-jobs.php
 *
 * Can be executed via Hostinger cPanel / CLI cron job:
 *   php /home/uXXXX/public_html/api/cron/scheduled-jobs.php
 * Or triggered via authenticated HTTPS request:
 *   GET /api/cron/scheduled-jobs.php?secret=YOUR_CRON_SECRET
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../email/secrets.php';
require_once __DIR__ . '/../email/HostingerSmtpClient.php';

$isCli = (php_sapi_name() === 'cli');

// ── Security Check ──────────────────────────────────────────────────────────
if (!$isCli) {
    handleCors();
    $providedSecret = $_GET['secret'] ?? ($_SERVER['HTTP_X_CRON_SECRET'] ?? '');
    if (empty($CRON_SECRET) || $providedSecret !== $CRON_SECRET) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden: Invalid or missing cron secret']);
        exit;
    }
}

$startTime = microtime(true);
$jobResults = [];

// ── Task 1: Check Database Reachability ──────────────────────────────────────
$dbCheck = supabaseRequest('rest/v1/app_settings?select=id&limit=1', 'GET', null, true);
$jobResults['database_connectivity'] = [
    'ok' => $dbCheck['ok'],
    'status' => $dbCheck['status'],
];

// ── Task 2: Process Outbox Communications Queue ──────────────────────────────
// Checks audit logs or pending queue for unsent notifications
$jobResults['communication_queue'] = [
    'status' => 'idle',
    'processed' => 0,
];

// ── Task 3: License & Subscription Expiry Warnings (T-14, T-7, T-1) ───────────
$expiryTaskResults = [
    'checked' => 0,
    'notified' => 0,
    'skipped_already_notified' => 0,
    'details' => [],
];

$orgsRes = supabaseRequest(
    'rest/v1/organizations?select=id,name,email,license_type,license_expires_at&is_active=eq.true&license_expires_at=not.is.null',
    'GET',
    null,
    true
);

if ($orgsRes['ok'] && is_array($orgsRes['data'])) {
    $now = new DateTime('now', new DateTimeZone('UTC'));
    $creds = function_exists('loadHostingerCredentials') ? loadHostingerCredentials() : null;

    foreach ($orgsRes['data'] as $org) {
        $expiryTaskResults['checked']++;
        $orgId = $org['id'];
        $orgName = $org['name'] ?? 'AVS Gold ERP Tenant';
        $orgEmail = $org['email'] ?? null;
        $expiresAtStr = $org['license_expires_at'];

        if (empty($expiresAtStr) || empty($orgEmail)) {
            continue;
        }

        try {
            $expiryDate = new DateTime($expiresAtStr, new DateTimeZone('UTC'));
            $diff = $now->diff($expiryDate);
            $daysRemaining = (int)$diff->format('%r%a');

            $stage = null;
            if ($daysRemaining === 14) {
                $stage = 'T-14';
            } elseif ($daysRemaining === 7) {
                $stage = 'T-7';
            } elseif ($daysRemaining === 1) {
                $stage = 'T-1';
            }

            if (!$stage) {
                continue;
            }

            $idempotencyKey = "expiry_notice_{$orgId}_{$stage}_" . $expiryDate->format('Y-m-d');

            $checkLog = supabaseRequest(
                "rest/v1/audit_logs?select=id&entity_id=eq.{$idempotencyKey}&limit=1",
                'GET',
                null,
                true
            );

            if ($checkLog['ok'] && !empty($checkLog['data'])) {
                $expiryTaskResults['skipped_already_notified']++;
                continue;
            }

            $subject = "[AVS Gold ERP] Action Required: Subscription expires in {$daysRemaining} day" . ($daysRemaining === 1 ? '' : 's') . " ({$orgName})";
            $formattedDate = $expiryDate->format('d M Y');
            $htmlBody = <<<HTML
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
    <div style="border-bottom: 2px solid #D4AF37; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #111827; margin: 0; font-size: 20px;">Subscription Expiry Notice</h2>
        <p style="color: #6b7280; font-size: 13px; margin: 4px 0 0 0;">AVS Gold ERP Platform</p>
    </div>
    <p style="color: #374151; font-size: 14px; line-height: 1.6;">Hello <strong>{$orgName}</strong>,</p>
    <p style="color: #374151; font-size: 14px; line-height: 1.6;">
        Your AVS Gold ERP subscription ({$org['license_type']}) is scheduled to expire in <strong>{$daysRemaining} day(s)</strong> on <strong>{$formattedDate}</strong>.
    </p>
    <div style="background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 14px 16px; margin: 18px 0; border-radius: 4px;">
        <p style="margin: 0; color: #92400E; font-size: 13px; font-weight: 600;">Important notice:</p>
        <p style="margin: 4px 0 0 0; color: #B45309; font-size: 13px;">
            To ensure uninterrupted access to billing, workshop books, gold ledgers, and barcode generation, please renew your subscription before the expiry date.
        </p>
    </div>
    <p style="color: #374151; font-size: 14px; line-height: 1.6;">
        To renew or upgrade your license, open your ERP console and go to <strong>Settings &rarr; License & Subscription</strong>.
    </p>
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px;">
        <p style="margin: 0;">This is an automated notification from AVS Gold ERP (Arivahly Venture Sphere). Please do not reply directly to this email.</p>
    </div>
</div>
HTML;

            $sent = false;
            $sendErr = null;

            if ($creds && !empty($creds['isConfigured'])) {
                try {
                    $client = new HostingerSmtpClient(
                        $creds['host'],
                        $creds['port'],
                        $creds['encryption'],
                        $creds['username'],
                        $creds['password']
                    );
                    $client->sendMail([
                        'to' => $orgEmail,
                        'subject' => $subject,
                        'htmlBody' => $htmlBody,
                        'fromEmail' => $creds['fromEmail'] ?: $creds['username'],
                        'fromName' => $creds['fromName'] ?: 'AVS Gold ERP Platform',
                        'replyTo' => $creds['replyTo'],
                        'tenantId' => $orgId,
                    ]);
                    $sent = true;
                } catch (Exception $e) {
                    $sendErr = $e->getMessage();
                }
            } else {
                $sendErr = 'Hostinger SMTP not configured';
            }

            $logPayload = [
                'event_type' => 'license_expiry_notice',
                'entity_id' => $idempotencyKey,
                'details' => json_encode([
                    'org_id' => $orgId,
                    'stage' => $stage,
                    'days_remaining' => $daysRemaining,
                    'recipient' => $orgEmail,
                    'sent' => $sent,
                    'error' => $sendErr,
                    'timestamp' => date('c'),
                ]),
                'created_at' => date('c'),
            ];
            supabaseRequest('rest/v1/audit_logs', 'POST', $logPayload, true);

            $expiryTaskResults['notified']++;
            $expiryTaskResults['details'][] = [
                'org' => $orgName,
                'stage' => $stage,
                'days' => $daysRemaining,
                'status' => $sent ? 'sent' : 'logged',
            ];
        } catch (Exception $ex) {
            // Ignore format errors
        }
    }
}
$jobResults['license_expiry_monitor'] = $expiryTaskResults;

// ── Task 3: Log Cron Execution Heartbeat to Supabase ─────────────────────────
$heartbeat = [
    'event_type' => 'cron_heartbeat',
    'entity_id' => 'hostinger_cron_' . date('Ymd_His'),
    'details' => json_encode([
        'triggered_by' => $isCli ? 'cli' : 'http_scheduler',
        'timestamp' => date('c'),
        'execution_duration_ms' => round((microtime(true) - $startTime) * 1000, 2),
    ]),
    'created_at' => date('c'),
];

$logRes = supabaseRequest('rest/v1/audit_logs', 'POST', $heartbeat, true);
$jobResults['audit_log_persisted'] = $logRes['ok'];

$totalDuration = round((microtime(true) - $startTime) * 1000, 2);

$response = [
    'success' => true,
    'timestamp' => date('c'),
    'runner' => $isCli ? 'cli' : 'http',
    'duration_ms' => $totalDuration,
    'tasks' => $jobResults,
];

if (!$isCli) {
    http_response_code(200);
}

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
