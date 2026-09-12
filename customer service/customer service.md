# AVS Gold ERP — Customer Service Plan

**Prepared:** 2026-09-12 (Researchy)  
**Project:** AVS Gold ERP (Arivahly)  
**Local tip:** `C:\final erp 29.08\new and final`  
**Live app:** https://erp.arivahly.in  

This file consolidates customer-care research for AVS tenants and SaaS support.  
**Yes — Grok Bot (and your other Grok Bot desks) are part of the stack.** They draft and triage; they do not burn tenant Ornexa credits and they do not auto-write gold/ledger/GST.

---

## 1. Goal

Real customer support for jewellery ERP operators (often low-literacy):

1. Free / buildable chat where people can ask for help  
2. Grok Bot (or sibling bots) for ticket intake → triage → safe auto-reply vs escalate  
3. Hostinger-first email desk (not Supabase mail)  
4. Zero tenant credit burn for SaaS support  

---

## 2. What already exists in the product

| Surface | What it does today | Gap |
|--------|---------------------|-----|
| `/help` Training Centre + Help Agent | Local knowledge search → ticket draft | Not live chat; not Grok; no email desk |
| `ConsumerSupportDesk` | Category triage + FAQ stubs + ticket create/reply/resolve | FAQ stubs only; no widget; no auto-agent |
| `/settings/support` | Staff tickets via Supabase RPCs | In-app ticketing works; no Hostinger email intake |
| `/assistant` + credit wallet | Tenant **product** AI (Cloud AI / WhatsApp / OCR) | Not the SaaS support desk |
| WhatsApp / Meta | Metered product messaging | Credits apply — **not** free SaaS support |
| Live chat widget | None on live marketing/portal until env IDs set | Need public channel |

**Hard rule (AVS-49 / AVS-62):**  
SaaS support (Grok Bot, Chatwoot, tawk, Hostinger `support@`, STF tickets, Help Agent FAQ) = **0** `deduct_tenant_credits`.  
Tenant credits are only for product Cloud AI, WhatsApp Business messages, and premium OCR.

---

## 3. Options compared (live sources checked 2026-09-12)

| Option | Cost model (official) | Self-host on Hostinger? | Email inbox | Widget | Fit for AVS |
|--------|------------------------|--------------------------|-------------|--------|-------------|
| **tawk.to** | Core software free; unlimited agents/chats/sites; optional paid add-ons (branding remove, AI Assist, hired agents) | No (hosted; Google Cloud) | Ticketing/KB in free product | Yes, copy-paste | Fastest **$0** public widget for aurum/portal |
| **Crisp Free** | Free forever: **2 seats**, **100** customer profiles, **$0** AI credits; Mini **$45**/workspace | No | Shared email from Mini (paid) | Yes | OK for tiny team; free tier too tight to grow |
| **Chatwoot Cloud Hacker** | Free cloud: ≤2 agents, 1 website chat; no WhatsApp/Email/API on free | N/A | Not on free cloud | Website chat only | Weak vs Hostinger-email goal |
| **Chatwoot CE (self-host)** | Community Edition **$0/agent/month**; Premium Support from **$19/agent/mo** (optional) | **Yes** (Docker; Postgres + Redis + SMTP) | IMAP/SMTP email channel | Website + more | **Best Hostinger-first** long-term desk |
| **Extend AVS native** | Build on Help Agent + support RPCs | Already on tip + Supabase DB | Hostinger SMTP outbound; inbound worker off Supabase | Custom UI | Best **in-ERP** low-literacy path |

### Source links (fetched / official)

- tawk.to FAQ: https://www.tawk.to/faqs/  
- tawk.to add-ons: https://www.tawk.to/add-ons/  
- Crisp pricing: https://crisp.chat/en/pricing/  
- Chatwoot self-hosted plans: https://www.chatwoot.com/pricing/self-hosted-plans  
- Chatwoot self-hosted install: https://www.chatwoot.com/docs/self-hosted  
- Chatwoot email channel: https://www.chatwoot.com/hc/user-guide/articles/1677843043-how-to-setup-an-email-channel  
- Hostinger IMAP/SMTP: https://www.hostinger.com/support/1575756-how-to-get-email-account-configuration-details-for-hostinger-email/  

**Do not invent add-on prices at purchase time** — re-check the vendor page when you buy.

---

## 4. Recommended stack (Hostinger-first)

**Do not put support mail or chat workers on Supabase free.**

### A. In-product (firm operators / 777)

Keep and deepen:

- `/help` Help Agent  
- `ConsumerSupportDesk`  
- `/settings/support` tickets (Supabase = auth/DB only)  

Auto-resolve = FAQ / SOP / print / login help from knowledge only.  
**Never** auto-post gold, ledger, GST, or RBAC changes.

### B. Public / marketing / portal widget (fast + free)

Embed **tawk.to** on `aurum.arivahly.in` / portal for human chat.  

Status on board: **AVS-52** IMPL tawk widget — code merged (PR #27); **owner still sets env / hPanel property IDs**.

Optional later: pay to remove branding — only if you choose.

### C. Ops desk (P1 — long-term)

Self-host **Chatwoot CE** on a Hostinger VPS:

- IMAP: `imap.hostinger.com:993` SSL  
- SMTP: `smtp.hostinger.com:465` SSL (or `587` STARTTLS)  
- Mailbox: support@ (or your chosen Hostinger mailbox)  
- Attachments → Cloudflare R2 / allowed object storage — **not** Supabase storage hammering  

Board: **AVS-53** — Not started (queued after RATE / EM-01 / AUTH-MAIL).

### D. Grok Bot / Grok Bot desks (yes — use them)

| Role | What they do in customer care |
|------|--------------------------------|
| **Researchy** | Keep SAFE/ESCALATE allowlist + this doc current |
| **Projects Manager** | Board tickets that need eng/ops |
| **Testing** | Observe live help/support UI when asked (click-path only) |
| **Lingxi / eng** | Ship Chatwoot, widgets, mail cutover |
| **Grok Bot support path** | Draft FAQ replies; escalate gold/finance/security |

**Safe auto:** FAQ, "how do I print", login/route help, link to Training Centre, canned resolve.  
**Escalate (never auto):** payments, gold weights/purity/wastage, GST/IRN, RBAC/security, data deletion, anything needing firm DB write or PR.

---

## 5. Ticket automation pattern

```text
Email (Hostinger mailbox)
  → Chatwoot CE IMAP (Hostinger VPS)
  → Tag: faq | print | billing | security
  → If faq/print: Grok Bot drafts from Training Centre / FAQ allowlist
       → auto-send only if allowlisted + high confidence
       → else human confirms
  → If eng: Notion Agent Task → eng desk
  → Reply via Chatwoot SMTP (Hostinger) — never Supabase mail

In-app ticket (/settings/support or ConsumerSupportDesk)
  → Same triage via Grok Bot watching new STF-* tickets
  → 0 tenant credits
```

---

## 6. SAFE vs ESCALATE allowlist (P0 — owner YES GO)

### SAFE — auto-answer / auto-close (cite FAQ)

| Category | Allowed topics (examples from ConsumerSupportDesk) |
|----------|-----------------------------------------------------|
| Orders | Edit active order → Sell & Customers → Orders → Edit specs; mark Ready for pickup |
| Billing (path only) | Why CGST+SGST (intra-state split FAQ); credit note **path** (not executing for them) |
| Karigar (nav only) | Where Artisan Settlements live under Workshop |
| Hardware | Printer WebUSB/RawPrint power + USB permission; scanner focus before scan |
| System (nav only) | Invite staff / change roles under Settings → Users & Roles |
| Help / print diag | Which doc, preview vs physical, client, printer profile, error text → link `/help` |
| Login UX | Session timeout "sign in again" copy — **no** password-reset automation |

### ESCALATE — never auto-resolve

- Gold weight / purity / wastage / melt / 995 conversion **disputes** (formula explain OK; custody settle = escalate)  
- GST beyond canned FAQ, IRN, e-invoice, tax filing  
- Payments, refunds, settlements, credit-note **execution**  
- RBAC / PIN / lockouts / branch leaks / SaaS admin (222)  
- Data deletion, tenant isolation, security incidents  
- WhatsApp Meta / credit wallet / AI billing disputes  
- Hostinger SMTP / live deploy blockers → eng board  
- Anything needing DB write, RPC, or PR  

### Grok Bot safe reply template

1. One-line answer from allowlist  
2. Exact click-path (icon + word UI terms)  
3. "Still stuck? I'll keep your support ticket for a human."  
4. If FAQ fully matched → recommend resolve; else escalate with category tag  

---

## 7. Phased plan

| Phase | Work | Owner hint | Exit criteria |
|-------|------|------------|---------------|
| **P0 (now)** | FAQ allowlist live (done in Notion AVS-49); Grok Bot drafts from allowlist; finish tawk property IDs on marketing/portal | Owner + Researchy + PM | Dry-run ticket auto-drafted; widget live where sites are up |
| **P1** | Chatwoot CE on Hostinger VPS + support@ IMAP/SMTP; website inbox on portal; Cloudflare for media | Eng / Lingxi + owner VPS | Email → Chatwoot round-trip without Supabase mail |
| **P2** | Chatwoot → Notion Agent Tasks webhook; auto-close FAQ; metrics % auto vs escalate; WhatsApp stays product+credits only | Eng + PM | No gold-advice auto replies; no support credit burn |

---

## 8. Board status (Notion, 2026-09-12)

| Task | ID | Status |
|------|----|--------|
| RESEARCH — Free customer support chat + GrokBot ticket auto-resolve | AVS-49 | **Done** |
| RESEARCH — WhatsApp + AI credit UX (no SaaS support burn) | AVS-62 | **Done** |
| IMPL — tawk.to widget on marketing/portal | AVS-52 | **Done** (code); env/hPanel IDs still owner |
| OPS — Chatwoot CE on Hostinger + support IMAP/SMTP | AVS-53 | **Not started** |
| IMPL — Credits jargon + guard SaaS support zero credit burn | (boarded) | Eng |

Notion project: [AVS Gold ERP (Arivahly)](https://app.notion.com/p/3d8944cab0778120a505fe883c233550)

---

## 9. Risks

- **PII / tenant leakage:** public widgets see visitor data — prefer Chatwoot CE on your VPS for SaaS transcripts long-term  
- **Gold/finance hallucination:** Grok Bot never auto-executes ERP writes  
- **Credit confusion:** UX must say credits are for WhatsApp + AI help — **not** support tickets  
- **Vendor free limits:** re-verify Crisp seats/profiles and Chatwoot cloud free limits at signup  
- **Infra cost:** Chatwoot CE software is $0; VPS + Postgres + Redis + backup is Hostinger infra (plan-dependent; not priced here)  
- **Site blockers:** `aurum.arivahly.in` SSL and portal DNS must be fixed before public widgets matter there  

---

## 10. Owner checklist (human)

1. Set tawk property IDs in env / hPanel (after PR #27)  
2. Rotate Hostinger mailbox password if previously exposed; keep SMTP in untracked `.env` only  
3. Provision Hostinger VPS for Chatwoot CE when ready for P1  
4. Confirm support@ (or chosen) mailbox IMAP/SMTP  
5. Optional: create a Grok Bot routine that drafts replies for new STF / Notion "support" tags using the SAFE allowlist  

---

## 11. Decision in one line

**Use Grok Bot for smart FAQ triage + Notion handoff; use tawk.to for free public chat now; self-host Chatwoot CE on Hostinger for the real email desk; keep native Help/tickets for in-ERP operators; never burn tenant credits for SaaS support.**

---

*Research desk: Researchy · Live vendor pages + Notion AVS-49 / AVS-62 / AVS-52 / AVS-53 · Grok CLI not installed on this machine at write time; live web fetch used instead.*

