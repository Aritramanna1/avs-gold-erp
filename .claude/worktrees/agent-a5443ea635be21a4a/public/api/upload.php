<?php
// Secure Hostinger Upload Endpoint for MTJ ERP
// Deployed to maatarajewellers.shop/api/upload.php

// Configure CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Block non-POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "status" => "error", 
        "message" => "Method Not Allowed. Only POST requests are allowed."
    ]);
    exit();
}

// Verify file array is present
if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode([
        "status" => "error", 
        "message" => "No file uploaded. Please send a 'file' parameter."
    ]);
    exit();
}

$file = $_FILES['file'];
$module = isset($_POST['module']) ? trim($_POST['module']) : '';
$record_id = isset($_POST['recordId']) ? trim($_POST['recordId']) : 'unknown';

// Sanitize record_id to prevent any directory traversal or malicious characters
$record_id = preg_replace('/[^a-zA-Z0-9_-]/', '', $record_id);
if (empty($record_id)) {
    $record_id = 'record';
}

// Supported modules and folder structures mapping
$allowed_modules = [
    'firm-logos',
    'catalog',
    'order-attachments',
    'repair-photos',
    'expense-attachments',
    'billing-attachments',
    'kyc-documents',
    'gold-settlement-proofs',
    'worker-documents',
    'customer-documents'
];

if (!in_array($module, $allowed_modules)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error", 
        "message" => "Invalid or missing module directory: '" . htmlspecialchars($module) . "'"
    ]);
    exit();
}

// Validate file upload status
if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode([
        "status" => "error", 
        "message" => "Upload failed on server with error code: " . $file['error']
    ]);
    exit();
}

// Validate file size limit: 10MB maximum (10 * 1024 * 1024)
$max_size = 10 * 1024 * 1024;
if ($file['size'] > $max_size) {
    http_response_code(400);
    echo json_encode([
        "status" => "error", 
        "message" => "File size exceeds limit of 10MB (Got " . number_format($file['size'] / 1024 / 1024, 2) . "MB)."
    ]);
    exit();
}

// Validate file name and extension
$original_name = basename($file['name']);
$ext = strtolower(pathinfo($original_name, PATHINFO_EXTENSION));

$allowed_extensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'];
$blocked_extensions = ['php', 'js', 'html', 'exe', 'sh', 'bat', 'cmd', 'phtml', 'php3', 'php4', 'php5', 'phps', 'htaccess', 'htpasswd'];

if (!in_array($ext, $allowed_extensions) || in_array($ext, $blocked_extensions)) {
    http_response_code(400);
    echo json_encode([
        "status" => "error", 
        "message" => "Forbidden file extension: '." . $ext . "' is not allowed."
    ]);
    exit();
}

// Verify actual file content / mime type
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime_type = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

$allowed_mimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
];

if (!in_array($mime_type, $allowed_mimes)) {
    // Basic image/document mime validation. If not in the list, double-check if it fits general categories
    $is_valid_fallback = false;
    if ($ext === 'pdf' && strpos($mime_type, 'pdf') !== false) $is_valid_fallback = true;
    if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp']) && strpos($mime_type, 'image/') === 0) $is_valid_fallback = true;
    
    if (!$is_valid_fallback) {
        http_response_code(400);
        echo json_encode([
            "status" => "error", 
            "message" => "Security verification failed: MIME type '" . $mime_type . "' does not match extension '." . $ext . "'."
        ]);
        exit();
    }
}

// File naming format: module/yyyy-mm/recordId-timestamp-random.ext
$year_month = date('Y-m');
$timestamp = time();
$random_str = bin2hex(random_bytes(4));
$generated_name = "{$record_id}-{$timestamp}-{$random_str}.{$ext}";

// Web storage locations setup (parallel to api/ folder)
$base_uploads_dir = dirname(__DIR__) . '/uploads';
$module_dir = "{$base_uploads_dir}/{$module}";
$target_dir = "{$module_dir}/{$year_month}";

// Ensure directory structure exists safely with zero exposure of indices
if (!is_dir($base_uploads_dir)) {
    mkdir($base_uploads_dir, 0755, true);
    file_put_contents("{$base_uploads_dir}/index.php", "<?php // Silence is golden");
}

if (!is_dir($module_dir)) {
    mkdir($module_dir, 0755, true);
    file_put_contents("{$module_dir}/index.php", "<?php // Silence is golden");
}

if (!is_dir($target_dir)) {
    mkdir($target_dir, 0755, true);
    file_put_contents("{$target_dir}/index.php", "<?php // Silence is golden");
}

$dest_path = "{$target_dir}/{$generated_name}";

// Move physical file to destination
if (move_uploaded_file($file['tmp_name'], $dest_path)) {
    // Create clean URL relative path to save
    $db_file_path = "uploads/{$module}/{$year_month}/{$generated_name}";
    
    // Auto-detect server protocol & host URL
    $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'];
    $db_file_url = "{$protocol}://{$host}/{$db_file_path}";

    http_response_code(200);
    echo json_encode([
        "status" => "success",
        "file_path" => $db_file_path,
        "file_url" => $db_file_url,
        "file_name" => $generated_name,
        "original_file_name" => $original_name,
        "mime_type" => $mime_type,
        "file_size" => $file['size']
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "status" => "error", 
        "message" => "Storage Error: Failed to write uploaded file to destination server directory."
    ]);
}
?>
