# Ornexa Integration Architecture

## Current Direction

Supabase Auth/PostgreSQL are authoritative for online business data. Integrations may include WhatsApp providers, email, printers, barcode/QR, weighing scale, storage, Cloudflare/R2, Tally/export, AI provider, public/customer/karigar portals, and support tooling.

## Rules

Integrations must be configurable, tenant-safe, auditable, retryable, and observable. Failed external side effects must not duplicate financial/stock postings.

Business modules should enqueue communications/documents from source transactions rather than constructing unrelated messages.
