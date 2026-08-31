# WhatsApp Guide

WhatsApp is configured only through Settings → WhatsApp and sent through `src/lib/comm`. Screens must not own credentials, provider selection, retries, templates, or phone-link construction.

WasenderAPI is the automated provider when configured; the WhatsApp deep-link provider is the manual fallback. The Personal Access Token and session API key are stored through Electron `safeStorage` in the main process. The renderer can set, clear, test, and use them but cannot read them back.

Configurable behavior includes branch/provider priority, base URL and identifiers, default country code, retry/timeout limits, approved template mappings, editable messages/placeholders, automation toggles, and Wasender session lifecycle.

When offline or when delivery fails, messages queue locally and retry later. WhatsApp failure must not block ERP transactions.

All files remain local in every mode. The Universal Print Engine generates a PDF once and retains it locally. Wasender document delivery requires a provider-accessible public URL, so Version 1 does not upload that PDF; it uses the configured text/caption fallback. Never enable Supabase Storage to work around this policy.

Troubleshoot in this order: internet connection, provider enablement/priority, credential presence, Wasender session state, recipient country code, queue retry status, then provider response. Never include tokens in screenshots or logs.
