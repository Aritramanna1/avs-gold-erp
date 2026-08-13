# Settings

`/settings` is the single operator-facing configuration hub. Completed modules must read runtime configuration from the established stores instead of adding module-local constants or parallel settings pages.

## Brand settings

Settings → Branding controls:

- application name, short name, tagline, description, and publisher;
- support email, support phone, and website;
- primary and gold-accent colors, applied to the running UI;
- firm logo and print-header override;
- optional developer/reseller identity and printed credit.

Configured identity is consumed by login, first-run setup, desktop chrome, sidebar/mobile labels, About, email styling, Universal Print Engine headers, and PDF generation. Firm-specific legal/contact data remains under Settings → Firm; branch overrides remain under Branches.

## WhatsApp settings

Settings → WhatsApp contains three subsections:

1. **Providers & Automation** — branch provider, Meta/BSP connection fields, template-name mappings, country code, rate limits, retries, timeouts, and per-event automation.
2. **WasenderAPI** — enablement, base URL, default session, encrypted Personal Access Token/session API key, connection test, QR, and session lifecycle.
3. **Message Templates** — editable message bodies, recipients, placeholders, activation, preview, reset, and custom templates.

Old `/settings/whatsapp`, `/settings/integrations/whatsapp`, and `/settings/whatsapp-templates` URLs redirect to the matching subsection for bookmark compatibility.

## Persistence

- Main settings and branding: `app_settings[id="firm"]` through `settings-store.ts`.
- Provider registry: `app_settings[id="comm_configs"]` through Supabase-backed settings services.
- Branch WhatsApp configuration/automation: `branch_settings`.
- Message templates: `wa-templates-store.ts` with Supabase-backed template persistence.
- WasenderAPI secrets: approved secret storage/server-side configuration; never expose service or provider secrets in public browser bundles.

Stored branding is merged with current defaults during hydration, so older installations gain new fields without losing their existing values.

## License settings

Settings → License & Activation shows the central license status, edition, expiry, enabled features, maximum devices, customer status, last verification, and masked key. Customers may enter a replacement License Key only. The Arivahly Licensing API URL, signature public key, grace policy, and support destination are build-time controls and are not editable. Version 1 has no payment workflow.

## Rules

- Reuse an existing setting before introducing a new one.
- A configurable value must be consumed by the runtime path it claims to control.
- Defaults may provide safe first-run behavior; customer identity, credentials, endpoints, phone numbers, legal text, and operational policy must remain editable.
- Do not create a top-level Branding or WhatsApp Settings navigation item.
- Document every new setting, its owner, persistence location, default, and consumers.
