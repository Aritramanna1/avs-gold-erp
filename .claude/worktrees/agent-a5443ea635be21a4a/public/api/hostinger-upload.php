<?php
/**
 * MTJ ERP — Hostinger File Upload Endpoint
 *
 * Deploy this file to your Hostinger server at:
 *   https://yourdomain.com/api/hostinger-upload.php
 *
 * Then set the URL in ERP → Settings → Firm Profile → "Hostinger Upload URL".
 *
 * Security: Only authenticated ERP users can trigger uploads (the
 * ERP sends the request from the browser after login). Files are
 * stored under /uploads/{module}/{yyyy-mm}/ and served publicly.
 */

// ── CORS (allow your ERP origin only) ─────────────────────────────────────────
$allowed_origins = [
    // Add your ERP domain here, e.g. "https://erp.yourshop.com"
    // For local dev the Vite server (port 3000) is also accepted.
    'http://localhost:3000',
    'https://localhost:3000',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true) || empty($allowed_origins[0] === 'http://localhost:3000' ? '' : '')) {
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
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Configuration ─────────────────────────────────────────────────────────────

$UPLOAD_ROOT = __DIR__ . '/../uploads';
$PUBLIC_BASE  = '/uploads'; // relative to web root — adjust if needed
$MAX_SIZE_MB  = 10;
$ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'];

// ── Validate uploaded file ────────────────────────────────────────────────────

if (empty($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded']);
    exit;
}

$file     = $_FILES['file'];
$module   = preg_replace('/[^a-z0-9\-]/', '', strtolower($_POST['module'] ?? 'general'));
$recordId = preg_replace('/[^a-zA-Z0-9\-_]/', '', $_POST['recordId'] ?? 'unknown');

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Upload error: ' . $file['error']]);
    exit;
}

if ($file['size'] > $MAX_SIZE_MB * 1024 * 1024) {
    http_response_code(413);
    echo json_encode(['error' => "File exceeds {$MAX_SIZE_MB}MB limit"]);
    exit;
}

$original = basename($file['name']);
$ext      = strtolower(pathinfo($original, PATHINFO_EXTENSION));

if (!in_array($ext, $ALLOWED_EXTS, true)) {
    http_response_code(415);
    echo json_encode(['error' => "File type .{$ext} not allowed"]);
    exit;
}

// ── Detect MIME via finfo ─────────────────────────────────────────────────────

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime  = $finfo->file($file['tmp_name']);

// ── Build storage path ────────────────────────────────────────────────────────

$ym       = date('Y-m');
$unique   = uniqid('', true);
$safeOrig = preg_replace('/[^a-zA-Z0-9._\-]/', '_', pathinfo($original, PATHINFO_FILENAME));
$fileName = "{$safeOrig}_{$unique}.{$ext}";

$dir = "{$UPLOAD_ROOT}/{$module}/{$ym}";
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not create upload directory']);
    exit;
}

// Silence-is-golden index for directory security
if (!file_exists("$dir/index.php")) {
    file_put_contents("$dir/index.php", '<?php // silence is golden');
}

$filePath = "{$dir}/{$fileName}";

if (!move_uploaded_file($file['tmp_name'], $filePath)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to move uploaded file']);
    exit;
}

// ── Return public URL ─────────────────────────────────────────────────────────

$scheme   = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
$host     = $_SERVER['HTTP_HOST'] ?? 'localhost';
$fileUrl  = "{$scheme}://{$host}{$PUBLIC_BASE}/{$module}/{$ym}/{$fileName}";
$relPath  = "{$module}/{$ym}/{$fileName}";

http_response_code(200);
echo json_encode([
    'file_url'  => $fileUrl,
    'file_path' => $relPath,
    'file_name' => $fileName,
    'mime_type' => $mime,
    'file_size' => $file['size'],
]);
