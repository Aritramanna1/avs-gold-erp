<?php
/**
 * PHP Built-in Server Router for Local Development / QA
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// 1. Well-Known OAuth & OIDC Discovery
if ($uri === '/.well-known/oauth-authorization-server' || $uri === '/.well-known/openid-configuration') {
    require __DIR__ . '/api/oauth/well-known.php';
    return true;
}

// 2. OAuth API routes
if (strpos($uri, '/api/oauth/authorize') === 0 || $uri === '/oauth/authorize') {
    require __DIR__ . '/api/oauth/authorize.php';
    return true;
}
if (strpos($uri, '/api/oauth/token') === 0 || $uri === '/oauth/token') {
    require __DIR__ . '/api/oauth/token.php';
    return true;
}
if (strpos($uri, '/api/oauth/jwks') === 0 || $uri === '/oauth/jwks') {
    require __DIR__ . '/api/oauth/jwks.php';
    return true;
}
if (strpos($uri, '/api/oauth/revoke') === 0 || $uri === '/oauth/revoke') {
    require __DIR__ . '/api/oauth/revoke.php';
    return true;
}
if (strpos($uri, '/api/oauth/userinfo') === 0 || $uri === '/oauth/userinfo') {
    require __DIR__ . '/api/oauth/userinfo.php';
    return true;
}

// 3. MCP Gateway
if (strpos($uri, '/api/mcp') === 0) {
    require __DIR__ . '/api/mcp/index.php';
    return true;
}

// 4. Existing file/directory
$filePath = __DIR__ . $uri;
if (file_exists($filePath) && !is_dir($filePath)) {
    return false; // Serve file directly
}

// 5. Default fallback to index.html for SPA routes
if (file_exists(__DIR__ . '/index.html')) {
    require __DIR__ . '/index.html';
    return true;
}

return false;
