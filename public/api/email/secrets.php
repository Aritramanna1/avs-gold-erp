<?php
/**
 * AVS Gold ERP — Secure Server-Side Hostinger SMTP Credential Vault
 *
 * Implements AES-256 encrypted credential storage for Hostinger SMTP credentials.
 * The decrypted password NEVER leaves the server-side runtime and is never returned in API payloads.
 */

require_once __DIR__ . '/../config.php';

const SMTP_VAULT_FILE = __DIR__ . '/.hostinger_smtp_vault.php';

function getVaultEncryptionKey() {
    $secret = getenv('SUPABASE_SERVICE_ROLE_KEY') ?: (getenv('CRON_SECRET') ?: 'avs_hostinger_vault_salt_2026_master_key_995');
    return hash('sha256', $secret, true);
}

function encryptVaultSecret($plaintext) {
    if (empty($plaintext)) return '';
    $key = getVaultEncryptionKey();
    $iv = openssl_random_pseudo_bytes(16);
    $ciphertext = openssl_encrypt($plaintext, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
    $hmac = hash_hmac('sha256', $iv . $ciphertext, $key, true);
    return base64_encode($iv . $hmac . $ciphertext);
}

function decryptVaultSecret($encoded) {
    if (empty($encoded)) return '';
    $raw = base64_decode($encoded);
    if (strlen($raw) < 48) return ''; // 16 iv + 32 hmac

    $key = getVaultEncryptionKey();
    $iv = substr($raw, 0, 16);
    $hmac = substr($raw, 16, 32);
    $ciphertext = substr($raw, 48);

    $calculatedHmac = hash_hmac('sha256', $iv . $ciphertext, $key, true);
    if (!hash_equals($hmac, $calculatedHmac)) {
        return ''; // Integrity verification failed
    }

    return openssl_decrypt($ciphertext, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
}

/**
 * Load raw server-side Hostinger SMTP credentials
 */
function loadHostingerCredentials() {
    $default = [
        'host' => getenv('HOSTINGER_SMTP_HOST') ?: 'smtp.hostinger.com',
        'port' => (int)(getenv('HOSTINGER_SMTP_PORT') ?: 465),
        'encryption' => getenv('HOSTINGER_SMTP_ENCRYPTION') ?: 'ssl',
        'username' => getenv('HOSTINGER_SMTP_USER') ?: '',
        'password' => getenv('HOSTINGER_SMTP_PASS') ?: '',
        'fromEmail' => getenv('HOSTINGER_SMTP_FROM') ?: '',
        'fromName' => getenv('HOSTINGER_SMTP_FROM_NAME') ?: 'AVS Gold ERP',
        'replyTo' => getenv('HOSTINGER_SMTP_REPLY_TO') ?: 'support@arivahly.in',
        'isConfigured' => false,
        'lastTestedAt' => null,
        'lastTestStatus' => null,
    ];

    if (file_exists(SMTP_VAULT_FILE)) {
        $content = file_get_contents(SMTP_VAULT_FILE);
        // Strip <?php header
        $jsonStart = strpos($content, '{');
        if ($jsonStart !== false) {
            $jsonStr = substr($content, $jsonStart);
            $data = json_decode($jsonStr, true);
            if (is_array($data)) {
                $default['host'] = $data['host'] ?? $default['host'];
                $default['port'] = (int)($data['port'] ?? $default['port']);
                $default['encryption'] = $data['encryption'] ?? $default['encryption'];
                $default['username'] = $data['username'] ?? $default['username'];
                $default['fromEmail'] = $data['fromEmail'] ?? $default['fromEmail'];
                $default['fromName'] = $data['fromName'] ?? $default['fromName'];
                $default['replyTo'] = $data['replyTo'] ?? $default['replyTo'];
                $default['lastTestedAt'] = $data['lastTestedAt'] ?? null;
                $default['lastTestStatus'] = $data['lastTestStatus'] ?? null;

                if (!empty($data['encPassword'])) {
                    $decrypted = decryptVaultSecret($data['encPassword']);
                    if (!empty($decrypted)) {
                        $default['password'] = $decrypted;
                    }
                }
            }
        }
    }

    $default['isConfigured'] = !empty($default['username']) && !empty($default['password']);
    return $default;
}

/**
 * Save Hostinger SMTP credentials to secure vault
 */
function saveHostingerCredentials($input) {
    $current = loadHostingerCredentials();

    $host = !empty($input['host']) ? trim($input['host']) : 'smtp.hostinger.com';
    $port = !empty($input['port']) ? (int)$input['port'] : 465;
    $encryption = !empty($input['encryption']) ? strtolower(trim($input['encryption'])) : 'ssl';
    $username = !empty($input['username']) ? trim($input['username']) : $current['username'];
    $fromEmail = !empty($input['fromEmail']) ? trim($input['fromEmail']) : ($username ?: $current['fromEmail']);
    $fromName = !empty($input['fromName']) ? trim($input['fromName']) : 'AVS Gold ERP';
    $replyTo = !empty($input['replyTo']) ? trim($input['replyTo']) : 'support@arivahly.in';

    // Handle password: if new password provided, encrypt it; otherwise preserve existing encrypted password
    $password = !empty($input['password']) ? trim($input['password']) : $current['password'];
    $encPassword = encryptVaultSecret($password);

    $vaultPayload = [
        'host' => $host,
        'port' => $port,
        'encryption' => $encryption,
        'username' => $username,
        'encPassword' => $encPassword,
        'fromEmail' => $fromEmail,
        'fromName' => $fromName,
        'replyTo' => $replyTo,
        'lastTestedAt' => $input['lastTestedAt'] ?? $current['lastTestedAt'],
        'lastTestStatus' => $input['lastTestStatus'] ?? $current['lastTestStatus'],
        'updatedAt' => date('c'),
    ];

    $phpFileContent = "<?php http_response_code(403); exit('Access Denied'); ?>\n" . json_encode($vaultPayload, JSON_PRETTY_PRINT);
    file_put_contents(SMTP_VAULT_FILE, $phpFileContent, LOCK_EX);
    @chmod(SMTP_VAULT_FILE, 0600);

    return getPublicHostingerStatus();
}

/**
 * Return safe public metadata (Password is strictly omitted)
 */
function getPublicHostingerStatus() {
    $creds = loadHostingerCredentials();
    
    // Check MX records for the sender domain
    $domain = '';
    $mxRecords = [];
    $mxValid = false;
    if (!empty($creds['fromEmail']) && strpos($creds['fromEmail'], '@') !== false) {
        $parts = explode('@', $creds['fromEmail']);
        $domain = end($parts);
        if (function_exists('getmxrr') && !empty($domain)) {
            $hosts = [];
            @getmxrr($domain, $hosts);
            $mxRecords = $hosts;
            foreach ($hosts as $mx) {
                if (stripos($mx, 'hostinger') !== false || stripos($mx, 'titan.email') !== false || stripos($mx, 'mail') !== false) {
                    $mxValid = true;
                    break;
                }
            }
        }
    }

    return [
        'provider' => 'Hostinger Email',
        'isConfigured' => $creds['isConfigured'],
        'hasPassword' => !empty($creds['password']),
        'host' => $creds['host'],
        'port' => $creds['port'],
        'encryption' => strtoupper($creds['encryption']),
        'username' => $creds['username'],
        'fromEmail' => $creds['fromEmail'],
        'fromName' => $creds['fromName'],
        'replyTo' => $creds['replyTo'],
        'domain' => $domain,
        'mxRecords' => $mxRecords,
        'mxValid' => $mxValid,
        'lastTestedAt' => $creds['lastTestedAt'],
        'lastTestStatus' => $creds['lastTestStatus'],
    ];
}
