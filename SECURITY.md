# Security Policy

We take security vulnerabilities seriously. Please review the security guidelines below to understand how vulnerabilities are handled.

## Reporting a Vulnerability

If you discover a potential security vulnerability within this project, **do not** open a public issue. Instead, report it responsibly:

1. **Email Reports**: Send a detailed description of the vulnerability to `security@arivahly.in`.
2. **Details to Include**:
   - Step-by-step instructions to reproduce the issue.
   - Any potential impact or proof of concept.
   - Software version and environment details.

We will acknowledge receipt of your report within 48 hours and work with you to release a security patch in a timely manner.

## Secure Defaults
This application runs with secure-by-default options:
- Local storage and local passwords are encrypted/hashed.
- Network API sessions employ JWT tokens with strict expiry.
- License validity checks are performed cryptographically via signatures.
