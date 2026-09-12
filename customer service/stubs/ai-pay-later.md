# P2-2: Paid AI Support Add-ons & Cloud AI Deferral (Parked Plan)

## Goal
Park and document the deferred implementation plan for paid AI support tools (such as Chatwoot "Captain", Crisp "Hugo", tawk "AI Assist", or external high-cost LLM query routing). Re-affirm the locked owner policy: **The core platform is self-hosted Hostinger-first; all customer support and basic platform assistance must function with zero mandatory AI recurring fees.** Paid AI add-ons will only be evaluated after the self-hosted infrastructure and core ERP modules are mature and stable in production.

## Current tip evidence (paths)
- **Self-Hosted Platform Policy**: [`customer service/self-hosted-platform.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/self-hosted-platform.md)
  - Section 1 & 2: "AI can be paid later — keep local/fallback AI; Cloud AI / paid widgets optional after platform is solid."
- **Customer Care Specification**: [`customer service/customer service.md`](file:///c:/final%20erp%2029.08/new%20and%20final/customer%20service/customer%20service.md#L49)
  - Documents $0 Chatwoot CE as authoritative desk; parks third-party paid AI bots.
- **Product AI Center (Tenant Metered)**: [`src/routes/ai-center.tsx`](file:///c:/final%20erp%2029.08/new%20and%20final/src/routes/ai-center.tsx)
  - Existing in-product generative features for tenant marketing and catalog descriptions (isolated from platform support).

## Changes (files / migrations / Hostinger)
1. **Platform Boundary Lock**:
   - Do not integrate recurring paid third-party AI support subscriptions into the SaaS control plane.
   - Retain lightweight rule-based and FAQ allowlist triage (via Grok Bot desks) operating at **$0 platform fee and 0 tenant credit burn**.
2. **Future Architecture Roadmap (When Unparked)**:
   - Self-hosted Ollama / small parameter models (e.g. Llama 3 / Mistral) deployable on dedicated Hostinger VPS compute.
   - Direct API key pass-through allowing tenants to supply their own OpenAI / Anthropic / Google AI credentials if desired.
   - Paid Chatwoot Captain add-on evaluation only if ticket volumes exceed human agent bandwidth.

## Acceptance
- Core customer care and ERP support desk operate continuously with zero dependency on active AI paid subscriptions.
- SaaS platform recurring infrastructure expenses remain strictly within Hostinger VPS hosting costs.
- No automated charges or credit debits occur for customer support interactions.

## Out of scope
- Enrolling in proprietary third-party customer support AI contracts during current phase.
- Disabling existing tenant product AI features (e.g. marketing copy generator) which are already gated by tenant credit packs.

## Status: Parked (Deferred until post-launch platform stability review)
