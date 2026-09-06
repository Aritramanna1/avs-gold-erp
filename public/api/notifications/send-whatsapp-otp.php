<?php
/**
 * AVS Communication Platform — WhatsApp OTP Dispatcher
 * Sends verification OTPs via Meta WhatsApp Cloud API.
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$phone = isset($input['phone']) ? trim($input['phone']) : '';
$otp = isset($input['otp']) ? trim($input['otp']) : '';

if (empty($phone)) {
    http_response_code(400);
    echo json_encode(['error' => 'Phone number is required']);
    exit;
}

// Clean phone number (default 91 for India)
$cleanPhone = preg_replace('/[^0-9]/', '', $phone);
if (strlen($cleanPhone) === 10) {
    $cleanPhone = '91' . $cleanPhone;
}

// Generate 6-digit OTP if not provided
if (empty($otp)) {
    $otp = strval(random_int(100000, 999999));
}

// Meta WhatsApp Cloud API Credentials for Arivahly Venture Sphere / AVS ERP
$accessToken = 'EAAPrlKaMANwBSXZCzZCsuyQn7mEdxDStlyzNEZA8elClIEHZCUVVxar1s3HqWzu0SorKJPmjzolibiKtXZAfkwzrH5GZBvIGLwPwTiFJrZCuFKHheRmahA8sm9yz5f01LSiSCDAQNhEQwn20OEMGkZCfeJsY0pwKgwYDYeRVYBHWWDiijqWRFUAnPBao62bW7rhi8iheIAG8xZAtVxdmDZAAEO3hiBhZA7zIV0m31tQyUjAhsRcuFuYq6xd4QRPakIFZAb5vBSjSwcQUd0YdZBNhmFLDDNCDW';
$phoneNumberId = '1333224859870918'; // Arivahly venture sphere Phone ID (+91 84597 21575)

// Fallback to secondary phone ID if needed
if (!empty($input['phone_number_id'])) {
    $phoneNumberId = $input['phone_number_id'];
}

$messagePayload = [
    'messaging_product' => 'whatsapp',
    'to' => $cleanPhone,
    'type' => 'text',
    'text' => [
        'body' => "Your AVS ERP verification code is: *{$otp}*\n\nValid for 10 minutes. Do not share this OTP with anyone.\n\n— Arivahly Venture Sphere"
    ]
];

$ch = curl_init("https://graph.facebook.com/v19.0/{$phoneNumberId}/messages");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $accessToken,
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($messagePayload));
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(500);
    echo json_encode(['error' => 'cURL error: ' . $curlError]);
    exit;
}

$resData = json_decode($response, true);

if ($httpCode >= 200 && $httpCode < 300) {
    echo json_encode([
        'success' => true,
        'message_id' => $resData['messages'][0]['id'] ?? null,
        'phone' => $cleanPhone,
        'otp' => $otp // In production client uses this session hash/verify
    ]);
} else {
    http_response_code($httpCode ?: 400);
    echo json_encode([
        'error' => $resData['error']['message'] ?? 'Failed to send WhatsApp message',
        'details' => $resData
    ]);
}
