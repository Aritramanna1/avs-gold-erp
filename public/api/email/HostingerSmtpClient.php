<?php
/**
 * AVS Gold ERP — Native Hostinger SMTP Client & Protocol Engine
 *
 * Implements RFC 5321 / RFC 4954 SMTP Client over TCP sockets with SSL/TLS and STARTTLS.
 * Provides:
 * 1. Authenticated SMTP email transmission to Hostinger (smtp.hostinger.com:465 / 587)
 * 2. Diagnostic connection testing (DNS resolution, TCP connectivity, TLS handshake, SMTP AUTH)
 * 3. Base64 attachment support for PDF Invoices, Quotations, and Reports
 * 4. Automatic standard AVS Gold ERP branded footer injection
 * 5. Structured logging and unique Message-ID generation
 */

class HostingerSmtpClient {
    private $host;
    private $port;
    private $encryption; // 'ssl', 'tls', or 'none'
    private $username;
    private $password;
    private $timeout;
    private $socket = null;
    private $debugLog = [];

    public function __construct($host = 'smtp.hostinger.com', $port = 465, $encryption = 'ssl', $username = '', $password = '', $timeout = 20) {
        $this->host = trim($host) ?: 'smtp.hostinger.com';
        $this->port = (int)$port ?: 465;
        $this->encryption = strtolower(trim($encryption)) ?: ($this->port === 465 ? 'ssl' : 'tls');
        $this->username = trim($username);
        $this->password = trim($password);
        $this->timeout = $timeout;
    }

    public function getDebugLog() {
        return $this->debugLog;
    }

    private function log($msg) {
        // Redact password if it ever appears in logs
        if (!empty($this->password)) {
            $msg = str_replace($this->password, '***REDACTED***', $msg);
            $msg = str_replace(base64_encode($this->password), '***REDACTED_BASE64***', $msg);
        }
        $this->debugLog[] = date('H:i:s') . ' ' . $msg;
    }

    /**
     * Diagnostic Test Connection without sending an email.
     * Checks DNS -> TCP Socket -> TLS -> EHLO -> AUTH LOGIN -> QUIT.
     */
    public function testConnection() {
        $result = [
            'success' => false,
            'status' => 'DISCONNECTED',
            'host' => $this->host,
            'port' => $this->port,
            'encryption' => strtoupper($this->encryption),
            'dnsResolved' => false,
            'ipAddress' => null,
            'tcpConnected' => false,
            'tlsHandshake' => false,
            'smtpBanner' => null,
            'authenticated' => false,
            'error' => null,
            'diagnostics' => [],
        ];

        if (empty($this->username) || empty($this->password)) {
            $result['error'] = 'SMTP Username and Password are required for Hostinger authentication.';
            $result['status'] = 'MISSING_CREDENTIALS';
            return $result;
        }

        // 1. DNS Resolution
        $ip = @gethostbyname($this->host);
        if (!$ip || $ip === $this->host) {
            $result['error'] = "DNS resolution failed for host: {$this->host}";
            $result['status'] = 'DNS_FAILED';
            return $result;
        }
        $result['dnsResolved'] = true;
        $result['ipAddress'] = $ip;
        $this->log("DNS resolved {$this->host} -> {$ip}");

        // 2. Connect
        try {
            $this->connect();
            $result['tcpConnected'] = true;
            $result['tlsHandshake'] = true;
            $result['smtpBanner'] = end($this->debugLog);

            // 3. Authenticate
            $this->authenticate();
            $result['authenticated'] = true;
            $result['success'] = true;
            $result['status'] = 'AUTHENTICATED';
            $this->log("Hostinger SMTP authentication successful.");

            // 4. Clean disconnect
            $this->sendCommand("QUIT", 221);
            $this->close();
        } catch (Exception $e) {
            $this->close();
            $result['error'] = $e->getMessage();
            $result['status'] = 'AUTH_FAILED';
            $this->log("Connection test failed: " . $e->getMessage());
        }

        $result['diagnostics'] = $this->debugLog;
        return $result;
    }

    /**
     * Send Transactional Email via Hostinger SMTP Socket
     */
    public function sendMail($params) {
        $to = trim($params['to'] ?? '');
        $subject = trim($params['subject'] ?? '');
        $htmlBody = $params['htmlBody'] ?? ($params['html'] ?? '');
        $fromEmail = trim($params['fromEmail'] ?? '') ?: $this->username;
        $fromName = trim($params['fromName'] ?? '') ?: 'AVS Gold ERP';
        $replyTo = trim($params['replyTo'] ?? '') ?: $fromEmail;
        $attachments = $params['attachments'] ?? [];
        $tenantId = $params['tenantId'] ?? 'platform';

        if (empty($to)) {
            throw new Exception("Recipient 'to' email address is required.");
        }
        if (empty($subject)) {
            throw new Exception("Email 'subject' is required.");
        }

        // Guarantee Mandatory Standardized AVS Gold ERP Branded Footer
        if (!str_contains($htmlBody, 'AVS_BRANDED_FOOTER')) {
            $htmlBody .= $this->generateStandardFooter();
        }

        $messageId = sprintf("<%s.%s@%s>", time(), bin2hex(random_bytes(8)), parse_url('https://' . $this->host, PHP_URL_HOST) ?: 'arivahly.in');

        // Connect and Authenticate
        $this->connect();
        $this->authenticate();

        // Envelope sender & recipient
        $this->sendCommand("MAIL FROM:<{$fromEmail}>", 250);
        $this->sendCommand("RCPT TO:<{$to}>", 250);
        $this->sendCommand("DATA", 354);

        // Build MIME payload
        $mime = $this->buildMimeMessage([
            'to' => $to,
            'fromEmail' => $fromEmail,
            'fromName' => $fromName,
            'replyTo' => $replyTo,
            'subject' => $subject,
            'messageId' => $messageId,
            'htmlBody' => $htmlBody,
            'attachments' => $attachments,
            'tenantId' => $tenantId,
        ]);

        $this->write($mime . "\r\n.\r\n");
        $resp = $this->readResponse();
        if ($resp['code'] !== 250) {
            throw new Exception("SMTP DATA rejected: {$resp['code']} {$resp['message']}");
        }

        $this->sendCommand("QUIT", 221);
        $this->close();

        return [
            'success' => true,
            'messageId' => $messageId,
            'to' => $to,
            'from' => "{$fromName} <{$fromEmail}>",
            'host' => $this->host,
            'port' => $this->port,
            'smtpResponse' => $resp['message'],
            'timestamp' => date('c'),
        ];
    }

    private function connect() {
        $target = $this->host;
        $contextOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ]
        ];
        $context = stream_context_create($contextOptions);

        if ($this->encryption === 'ssl' || $this->port === 465) {
            $target = "ssl://{$this->host}";
        }

        $errno = 0;
        $errstr = '';
        $this->log("Connecting to {$target}:{$this->port}...");
        $this->socket = @stream_socket_client(
            "{$target}:{$this->port}",
            $errno,
            $errstr,
            $this->timeout,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if (!$this->socket) {
            throw new Exception("Cannot connect to SMTP server ({$target}:{$this->port}): [{$errno}] {$errstr}");
        }

        stream_set_timeout($this->socket, $this->timeout);

        // Initial Server Greeting
        $banner = $this->readResponse();
        if ($banner['code'] !== 220) {
            throw new Exception("Unexpected SMTP banner: {$banner['code']} {$banner['message']}");
        }
        $this->log("Connected: {$banner['message']}");

        // EHLO Handshake
        $ehlo = $this->sendCommand("EHLO " . (gethostname() ?: 'erp.arivahly.in'), 250);

        // Handle STARTTLS on port 587
        if (($this->encryption === 'tls' || $this->port === 587) && strpos($ehlo['message'], 'STARTTLS') !== false) {
            $this->log("Initiating STARTTLS negotiation...");
            $this->sendCommand("STARTTLS", 220);
            $cryptoMethod = STREAM_CRYPTO_METHOD_TLS_CLIENT;
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
                $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
            }
            if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
                $cryptoMethod |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
            }

            if (!@stream_socket_enable_crypto($this->socket, true, $cryptoMethod)) {
                throw new Exception("STARTTLS cryptographic handshake failed with Hostinger server.");
            }
            $this->log("STARTTLS encryption enabled.");
            // Re-send EHLO after TLS negotiation
            $this->sendCommand("EHLO " . (gethostname() ?: 'erp.arivahly.in'), 250);
        }
    }

    private function authenticate() {
        if (empty($this->username) || empty($this->password)) {
            throw new Exception("SMTP Username or Password missing.");
        }

        $this->log("Authenticating as '{$this->username}' via AUTH LOGIN...");
        $this->sendCommand("AUTH LOGIN", 334);
        $this->sendCommand(base64_encode($this->username), 334);
        $resp = $this->sendCommand(base64_encode($this->password), 235);
        $this->log("AUTH LOGIN successful: {$resp['message']}");
    }

    private function sendCommand($cmd, $expectedCode = null) {
        $this->write($cmd . "\r\n");
        $resp = $this->readResponse();
        if ($expectedCode !== null && $resp['code'] !== $expectedCode) {
            throw new Exception("SMTP command failed ({$cmd}): Expected {$expectedCode}, received {$resp['code']} {$resp['message']}");
        }
        return $resp;
    }

    private function write($data) {
        if (!$this->socket) {
            throw new Exception("Socket is closed.");
        }
        @fwrite($this->socket, $data);
    }

    private function readResponse() {
        if (!$this->socket) {
            throw new Exception("Socket is closed.");
        }
        $line = '';
        $message = '';
        $code = 0;

        while (!feof($this->socket)) {
            $str = @fgets($this->socket, 1024);
            if ($str === false) break;
            $line = trim($str);
            $message .= $line . "\n";
            if (strlen($line) >= 3 && is_numeric(substr($line, 0, 3))) {
                $code = (int)substr($line, 0, 3);
                // RFC 5321: If 4th char is '-' it's a multiline response, continue reading
                if (strlen($line) < 4 || substr($line, 3, 1) === ' ') {
                    break;
                }
            }
        }

        $this->log("<< {$code} " . trim($message));
        return ['code' => $code, 'message' => trim($message)];
    }

    private function close() {
        if ($this->socket) {
            @fclose($this->socket);
            $this->socket = null;
        }
    }

    private function buildMimeMessage($p) {
        $boundary = "==Multipart_Boundary_AVS_" . md5(uniqid(time(), true));

        $headers = [];
        $headers[] = "Date: " . date('r');
        $headers[] = "To: <{$p['to']}>";
        $headers[] = "From: {$p['fromName']} <{$p['fromEmail']}>";
        $headers[] = "Reply-To: <{$p['replyTo']}>";
        $headers[] = "Subject: =?UTF-8?B?" . base64_encode($p['subject']) . "?=";
        $headers[] = "Message-ID: {$p['messageId']}";
        $headers[] = "X-Mailer: AVS-Gold-ERP-Hostinger-Engine";
        $headers[] = "X-AVS-Tenant: {$p['tenantId']}";
        $headers[] = "MIME-Version: 1.0";

        if (empty($p['attachments'])) {
            $headers[] = "Content-Type: text/html; charset=UTF-8";
            $headers[] = "Content-Transfer-Encoding: 8bit";
            return implode("\r\n", $headers) . "\r\n\r\n" . $p['htmlBody'];
        }

        $headers[] = "Content-Type: multipart/mixed; boundary=\"{$boundary}\"";
        $body = implode("\r\n", $headers) . "\r\n\r\n";

        // HTML Content Part
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Type: text/html; charset=UTF-8\r\n";
        $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
        $body .= $p['htmlBody'] . "\r\n\r\n";

        // Attachments
        foreach ($p['attachments'] as $att) {
            $filename = preg_replace('/[^a-zA-Z0-9._\-]/', '_', $att['filename'] ?? 'document.pdf');
            $rawBase64 = $att['contentBase64'] ?? ($att['content'] ?? '');
            $contentType = $att['contentType'] ?? 'application/pdf';

            if (!empty($rawBase64)) {
                $body .= "--{$boundary}\r\n";
                $body .= "Content-Type: {$contentType}; name=\"{$filename}\"\r\n";
                $body .= "Content-Transfer-Encoding: base64\r\n";
                $body .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
                $body .= chunk_split($rawBase64) . "\r\n\r\n";
            }
        }

        $body .= "--{$boundary}--";
        return $body;
    }

    private function generateStandardFooter() {
        return '
        <!-- AVS_BRANDED_FOOTER -->
        <div style="margin-top: 36px; padding-top: 24px; border-top: 2px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #64748b; line-height: 1.6;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align: top; padding-bottom: 12px;">
                <div style="display: inline-block; font-weight: 800; font-size: 13px; color: #b45309; letter-spacing: 0.5px;">
                  AVS GOLD ERP
                </div>
                <span style="font-size: 10px; color: #94a3b8; margin-left: 8px; font-family: monospace;">PLATFORM VERIFIED</span>
                <div style="margin-top: 4px; color: #475569; font-size: 11px;">
                  Enterprise Jewellery Manufacturing, Bullion Accounting & Retail POS Solution
                </div>
              </td>
            </tr>
            <tr>
              <td style="background-color: #f8fafc; border-radius: 6px; padding: 12px; border: 1px solid #e2e8f0;">
                <div style="color: #334155; font-size: 11px;">
                  <strong>Support & Governance:</strong> <a href="mailto:support@arivahly.in" style="color: #b45309; text-decoration: none;">support@arivahly.in</a>
                  &bull; <strong>Web:</strong> <a href="https://erp.arivahly.in" style="color: #b45309; text-decoration: none;">erp.arivahly.in</a>
                </div>
                <div style="margin-top: 6px; font-size: 10px; color: #94a3b8;">
                  Confidentiality Notice: This message and any attached documents are strictly intended for the designated recipient. If received in error, please immediately notify the sender and delete this transmission.
                </div>
              </td>
            </tr>
          </table>
        </div>';
    }
}
