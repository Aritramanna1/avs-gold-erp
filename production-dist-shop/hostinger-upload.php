<?php
/**
 * @deprecated RETIRED — ERP attachments upload to Cloudflare R2 via
 * `VITE_R2_PROXY_URL` / `src/lib/supabase-storage.ts`. This PHP endpoint is
 * not called by the app. Kept only so old site trees do not 404 if something
 * still hits the path; it refuses new uploads.
 */
http_response_code(410);
header('Content-Type: application/json');
echo json_encode([
  'success' => false,
  'error' => 'Retired. Upload via Cloudflare R2 (VITE_R2_PROXY_URL).',
]);
exit;

/* Legacy body below is intentionally unreachable. */
/**
 * MTJ ERP — Hostinger File Upload Endpoint (canonical — 2026-07-10)
 *
 * This is the ONE upload endpoint the ERP is built against. It replaces two
 * prior duplicate scripts (root /hostinger-upload.php and
 * /api/upload.php) that had drifted into incompatible response shapes and
 * validation rules — see CLEANUP_AUDIT_2026-07-10.md for the comparison.
 *
 * Deploy this file to your Hostinger server at:
 *   https://yourdomain.com/api/hostinger-upload.php
 *
 * Then set that exact URL in ERP → Settings → Firm Profile →
 * "Hostinger Upload URL". The client (src/lib/hostinger-client.ts) checks
 * the JSON response's `success` boolean — do not change this endpoint's
 * response shape without updating that file too.
 *
 * Security: Only authenticated ERP users can trigger uploads (the ERP sends
 * the request from the browser after login). Files are stored under
 * /uploads/{module}/{yyyy-mm}/ and served publicly; module is restricted to
 * a known allow-list, and file content (MIME) is cross-checked against its
 * extension so a renamed script can't slip through.
 */

// ── CORS (allow your ERP origin only) ─────────────────────────────────────────
$allowed_origins = [
    // Replace with your ERP's real domain, e.g. "https://erp.yourshop.com"
    'http://localhost:3000',
    'https://localhost:3000',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// ── Configuration ─────────────────────────────────────────────────────────────

$UPLOAD_ROOT = __DIR__ . '/../uploads';
$PUBLIC_BASE = '/uploads'; // relative to web root — adjust if needed
$MAX_SIZE_MB = 10;

// Every module string any part of the ERP is allowed to upload under.
// "invoices" is used by document-pdf-service.ts for generated invoice PDFs
// shared via email/WhatsApp — the rest mirror HostingerModule in
// src/lib/hostinger-storage.ts. Keep in sync with both call sites.
$ALLOWED_MODULES = [
    'invoices',
    'firm-logos',
    'catalog',
    'order-attachments',
    'repair-photos',
    'expense-attachments',
    'billing-attachments',
    'kyc-documents',
    'gold-settlement-proofs',
    'worker-documents',
    'customer-documents',
];

$ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'];
$ALLOWED_MIMES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

// ── Validate request ──────────────────────────────────────────────────────────

if (empty($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No file uploaded']);
    exit;
}

$file   = $_FILES['file'];
$module = strtolower(trim($_POST['module'] ?? ''));
$recordId = preg_replace('/[^a-zA-Z0-9\-_]/', '', $_POST['recordId'] ?? 'unknown');

if (!in_array($module, $ALLOWED_MODULES, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Invalid or missing module: '{$module}'"]);
    exit;
}

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Upload error: ' . $file['error']]);
    exit;
}

if ($file['size'] > $MAX_SIZE_MB * 1024 * 1024) {
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => "File exceeds {$MAX_SIZE_MB}MB limit"]);
    exit;
}

$original = basename($file['name']);
$ext      = strtolower(pathinfo($original, PATHINFO_EXTENSION));

if (!in_array($ext, $ALLOWED_EXTS, true)) {
    http_response_code(415);
    echo json_encode(['success' => false, 'error' => "File type .{$ext} not allowed"]);
    exit;
}

// ── Verify actual file content matches its extension ──────────────────────────

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime  = $finfo->file($file['tmp_name']);

$mimeOk = in_array($mime, $ALLOWED_MIMES, true);
if (!$mimeOk) {
    if ($ext === 'pdf' && strpos($mime, 'pdf') !== false) $mimeOk = true;
    if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true) && strpos($mime, 'image/') === 0) $mimeOk = true;
}
if (!$mimeOk) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => "File content ({$mime}) does not match extension .{$ext}",
    ]);
    exit;
}

// ── Build storage path ────────────────────────────────────────────────────────

$ym       = date('Y-m');
$unique   = uniqid('', true);
$safeOrig = preg_replace('/[^a-zA-Z0-9._\-]/', '_', pathinfo($original, PATHINFO_FILENAME));
$fileName = "{$safeOrig}_{$unique}.{$ext}";

$dir = "{$UPLOAD_ROOT}/{$module}/{$ym}";
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Could not create upload directory']);
    exit;
}

// Silence-is-golden index for directory security
if (!file_exists("$dir/index.php")) {
    file_put_contents("$dir/index.php", '<?php // silence is golden');
}

$filePath = "{$dir}/{$fileName}";

if (!move_uploaded_file($file['tmp_name'], $filePath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to move uploaded file']);
    exit;
}

// ── Return public URL ─────────────────────────────────────────────────────────

$scheme  = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
$host    = $_SERVER['HTTP_HOST'] ?? 'localhost';
$fileUrl = "{$scheme}://{$host}{$PUBLIC_BASE}/{$module}/{$ym}/{$fileName}";
$relPath = "{$module}/{$ym}/{$fileName}";

http_response_code(200);
echo json_encode([
    'success'           => true,
    'file_url'          => $fileUrl,
    'file_path'         => $relPath,
    'file_name'         => $fileName,
    'original_file_name' => $original,
    'mime_type'         => $mime,
    'file_size'         => $file['size'],
]);
