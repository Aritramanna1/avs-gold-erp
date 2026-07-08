<?php
/**
 * Hostinger Upload Gateway for Maa Tara Jewellers ERP
 * Saves files securely under public_html/uploads/{module}/{yyyy-mm}/
 * and rejects dangerous files (php, js, html, exe, etc.)
 */

// Define allowed domains for strict CORS enforcement
$allowedOrigins = [
  "https://maatarajewellers.shop",
  "https://www.maatarajewellers.shop"
];

$origin = isset($_SERVER["HTTP_ORIGIN"]) ? $_SERVER["HTTP_ORIGIN"] : "";

if (in_array($origin, $allowedOrigins, true)) {
  header("Access-Control-Allow-Origin: " . $origin);
}

header("Vary: Origin");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

header("Content-Type: application/json; charset=UTF-8");

// Main handler
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "error" => "Only POST uploads are permitted."]);
    exit;
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "No file uploaded in form-data payload."]);
    exit;
}

$file = $_FILES['file'];
$module = isset($_POST['module']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['module']) : "general";
$recordId = isset($_POST['recordId']) ? preg_replace('/[^a-zA-Z0-9_-]/', '', $_POST['recordId']) : "temp";

// 1. Validate size (10MB maximum limit)
$maxBytes = 10 * 1024 * 1024;
if ($file['size'] > $maxBytes) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "File size exceeds the 10MB limit."]);
    exit;
}

// 2. Extract and validate extension
$originalName = basename($file['name']);
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

$dangerousExtensions = [
    'php', 'php5', 'phtml', 'html', 'htm', 'js', 'jsp', 'asp', 'aspx',
    'exe', 'sh', 'bat', 'cmd', 'bin', 'cgi', 'pl', 'py'
];

$allowedExtensions = [
    'jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'
];

if (in_array($ext, $dangerousExtensions, true) || !in_array($ext, $allowedExtensions, true)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "File type is forbidden for security reasons."]);
    exit;
}

// 3. Map MIME type securely
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$detectedMime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

// Check MIME type matches extension group
if (strpos($detectedMime, 'text/html') !== false || strpos($detectedMime, 'application/x-php') !== false) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Physical file content mismatch detected."]);
    exit;
}

// 4. Structure the destination directories
$datePath = date("Y-m");
$subDir = "uploads/{$module}/{$datePath}";
// Assuming directory upload.php sits under public_html/api/
$baseDir = dirname(__DIR__) . "/"; // points to standard public_html/
$targetDir = $baseDir . $subDir . "/";

if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Failed to create directory structure on Hostinger server. Check folder permissions (755)."]);
        exit;
    }
}

// 5. Generate unique name
$sanitizedName = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $originalName);
$uniqueName = time() . "_" . uniqid() . "_" . $sanitizedName;
$targetFilePath = $targetDir . $uniqueName;

// 6. Physically move the uploaded file
if (move_uploaded_file($file['tmp_name'], $targetFilePath)) {
    // Generate public absolute URL dynamically using host attributes or direct absolute config
    $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $fileUrl = $scheme . "://" . $host . "/" . $subDir . "/" . $uniqueName;
    
    // Output standard JSON response mapping clean attributes to frontend
    echo json_encode([
        "success" => true,
        "file_url" => $fileUrl,
        "file_path" => $subDir . "/" . $uniqueName,
        "file_name" => $uniqueName,
        "original_file_name" => $originalName,
        "mime_type" => $detectedMime,
        "file_size" => $file['size']
    ]);
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Failed to move temporary uploaded file to target directory."]);
}
