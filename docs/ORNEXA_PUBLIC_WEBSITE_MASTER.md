# Ornexa Public Website — Master Specification

**Product:** Ornexa / AVS Gold ERP — Jewellery Manufacturing ERP (with Wholesale & Retail capabilities)  
**Status:** Authoritative public-site architecture for V1 launch  
**Version:** 1.0.0 — August 2026  
**Related docs:** `BUSINESS_PRODUCT_AND_ENTITLEMENT_MASTER.md`, `SAAS_ENTITLEMENT_AND_BILLING.md`, `PLAN_BUILDER_MASTER.md`, `ONBOARDING_MASTER.md`, `TRAINING_CENTRE_MASTER.md`, `AUTH_AND_INVITATION_MASTER.md`, `GOOGLE_OAUTH_STAGING.md`, `JWELLY_PUBLIC_WEBSITE_INSPIRATION.md`

---

## 1. Purpose & Principles

### 1.1 What the public website is

The Ornexa public website is the **commercial front door** for:

- SEO and discoverability (jewellery manufacturing ERP, gold traceability, karigar management)
- Product education (features, solutions, plans)
- Trust and compliance (legal, security, support)
- Conversion (**14-day free trial**, demo request, login)

It is **not** the ERP application. Logged-in users who visit `/` still see the marketing site — with **“Open Ornexa”** instead of **“Login”** when a session exists.

### 1.2 Core routing architecture (V1 — approved)

```
PUBLIC (no auth required)
  /                    → Marketing homepage (always public, even if session exists)
  /solutions/*         → Manufacturing, Wholesale, Retail positioning pages
  /features            → Capability overview (SEO + comparison depth)
  /pricing             → Plan ladder (dynamic from commercial_plans — no hardcoded ₹)
  /trial/start         → 14-day free trial signup + tenant provisioning
  /login               → Single authentication page
  /help                → Public Training Centre entry / knowledge preview
  /faq                 → Commercial & product FAQs
  /contact             → Demo / sales / support funnel
  /privacy, /terms     → Legal (required for trial consent)

AUTHENTICATED (auth gate resolves workspace — never on /)
  /platform/*          → Platform Owner
  /app/* or dashboard  → ERP staff (role-based)
  /customer/*          → Customer portal workspace
  /supplier/*          → Supplier portal workspace
  /karigar/*           → Karigar portal workspace
  /onboarding          → Post-trial / post-purchase assisted setup wizard
```

### 1.3 Authentication rules (explicit)

| Rule | Implementation |
|------|----------------|
| **`/` never auto-redirects to dashboard** | Public marketing shell; session-aware nav only |
| **Single login page** | `/login` — email/password + Google OAuth + OTP (where tenant-enabled) |
| **Google OAuth is retained** | Additional signup/login method — **not** a replacement for email/password |
| **Staging first** | Configure Google provider in Supabase for staging callback URLs before production |
| **Post-login routing** | Unified auth gate → `get_authorization_context()` → default workspace route |
| **Multi-role users** | Default workspace + **Switch Role** (Workspace Switcher) without re-login |

### 1.4 Post-authentication redirect matrix

| Resolved context | Default landing |
|------------------|-----------------|
| Platform Owner | `/platform` |
| ERP staff (owner, admin, manager, accountant, etc.) | `/app` or role-appropriate dashboard |
| Customer portal user | Customer workspace |
| Supplier portal user | Supplier workspace |
| Karigar portal user | Karigar workspace |
| Multi-role identity | Highest-precedence default + switcher for alternates |

Reference: `AUTH_AND_INVITATION_MASTER.md`, unified authorization migration `20260816110000_unified_authorization_context.sql`.

### 1.5 Design principles

- **Cleaner and more modern** than legacy competitor marketing sites
- **Mobile-first**, fast static/SSR pages for SEO (avoid “Loading…” shells on marketing routes)
- **No AI slop** — specific jewellery manufacturing language, real module names
- **No hardcoded prices** — plan comparison pulls from `commercial_plans` (Plan Builder)
- **Manufacturing-first positioning** — wholesale/retail as licensed capabilities, not undifferentiated “all-in-one” noise
- **Honest scope** — Coming Soon modules labeled; no fake screenshots

---

## 2. Information Architecture

### 2.1 Primary navigation (desktop)

```
[Ornexa Logo]   Solutions ▾   Features   Pricing   Training   FAQ   Contact
                                                      [Login]  [Start 14-Day Free Trial]
```

When `session.exists`:
```
                                                      [Open Ornexa ▾]  [Start 14-Day Free Trial]
```
`Open Ornexa` opens workspace switcher or last-used workspace — **does not replace `/login` for signed-out users**.

### 2.2 Solutions submenu

| Page | Path | Audience |
|------|------|----------|
| Manufacturing | `/solutions/manufacturing` | Factories, workshops, karigar operations |
| Wholesale | `/solutions/wholesale` | B2B distributors, bullion traders |
| Retail | `/solutions/retail` | Showrooms (licensed capability; not primary V1 hero) |
| Hybrid / Enterprise | `/solutions/enterprise` | Factory + warehouse + showroom networks |

### 2.3 Footer sitemap

```
Product          Solutions           Resources           Company
────────         ─────────           ─────────           ───────
Features         Manufacturing       Help / Training     About AVS / Ornexa
Pricing          Wholesale           FAQ                 Contact
Start Trial      Retail              Documentation       Privacy
Login            Enterprise          API (future)        Terms
                 Portals overview    Security            Refund policy
```

---

## 3. Page Specifications

### 3.1 Homepage (`/`)

**Goal:** Explain what Ornexa is in 10 seconds; route manufacturers to trial or demo.

#### Hero

- **Headline:** Jewellery manufacturing ERP with gold custody you can audit.
- **Subhead:** Job cards, karigar issue/return, vault balances, GST documents, and customer portals — one Supabase-backed system for web, desktop, and mobile.
- **CTAs:**
  - Primary: **Start 14-Day Free Trial** → `/trial/start`
  - Secondary: **Book a Demo** → `/contact?intent=demo`
  - Tertiary (text): **View Pricing** → `/pricing`

#### Problem → solution (3 columns)

| Pillar | Copy angle |
|--------|------------|
| **Gold you can trace** | Integer milligram accounting, vault-led balances, job-level custody |
| **Factory operations** | Melting, bench WIP, outside work, QC, hallmark, scrap recovery |
| **Business on one platform** | Parties, billing, print/export, WhatsApp/email, optional portals |

#### Capability highlights (6 cards — not 30)

1. Gold Vault & fine metal ledger  
2. Job cards & karigar custody  
3. Universal Print & Export Engine  
4. Party 360 (customer, karigar, supplier)  
5. External portals (Customer, Karigar, Supplier)  
6. AI Assistant & Communication Centre  

#### Plan teaser

- “Plans from **Basic** to **Max** — pick your surfaces and business modes.”
- Dynamic starting-from badge from `commercial_plans` (if published)
- CTA → `/pricing`

#### Trust band

Use **verified** claims only:

- Supabase + RLS tenant isolation  
- Gold stored as integer milligrams (no float accounting)  
- Razorpay-backed subscription billing  
- Assisted 12-stage onboarding  
- AVS / Ornexa product constitution compliance  

#### Social proof (when available)

- Pilot customer quotes (name, city, business type)  
- Avoid unverified “1 lakh users” style metrics  

#### FAQ snippet (3–5 questions)

Link to full `/faq`.

#### SEO targets

- jewellery manufacturing ERP India  
- karigar management software  
- gold inventory ERP  
- jewellery ERP with GST  

---

### 3.2 Manufacturing solution (`/solutions/manufacturing`)

**Hero:** Built for jewellery factories — not generic retail POS.

**Sections:**

1. **Production lifecycle** — Design → Melt → Bench → Outside (mina/polish) → QC → Hallmark → Finished stock  
2. **Karigar custody** — Issue/return, worker gold books, loss & wastage formulas  
3. **Gold Vault** — Authoritative balances; no shadow ledgers  
4. **Documents** — Job cards, issue slips, receive slips, manufacturing bills (Universal Print Engine)  
5. **Traceability** — Tags, lineage, hallmark/HUID workflows (per `TAGGING_AND_TRACEABILITY_MASTER.md`)  
6. **Screenshots** — Real Ornexa UI only  
7. **CTA** — Start trial (pre-select `product=manufacturing` on `/trial/start`)

---

### 3.3 Wholesale solution (`/solutions/wholesale`)

**Positioning:** B2B dealer operations — licensed add-on or hybrid plan.

**Sections:**

- Dealer accounts & price lists  
- Bulk orders, dispatch challans, courier tracking  
- Customer-specific rates, wastage/labour rules  
- Dealer B2B portal (Growth+ / plan-dependent)  
- WhatsApp invoice sharing  

**Honesty note:** Wholesale module depth per release readiness matrix — mark partial features as “Available in Professional+” if not V1-complete.

---

### 3.4 Retail solution (`/solutions/retail`)

**Positioning:** Showroom capability for vertically integrated jewellers — **not** Ornexa’s primary identity (we are not a retail POS clone).

**Sections:**

- Ready stock, barcode tags, estimates, sales invoices  
- Old gold exchange, repair orders  
- Customer CRM & portal  
- Clear note: “Retail is a licensed capability; manufacturing remains the core.”

---

### 3.5 Features (`/features`)

Organized by **buyer-understandable** categories (not internal module dump):

| Category | Ornexa capabilities |
|----------|---------------------|
| **Gold & metal** | Vault, fine gold, bhav rate book, purity grades, melting, assaying |
| **Manufacturing** | Job cards, WIP, outside work, QC, hallmark, scrap recovery |
| **Inventory** | Stock, tags, trays, locations, lineage, physical audit |
| **Parties** | Party 360, opening balances, karigar/customer/supplier profiles |
| **Finance** | Double-entry, GST, settlements, Tally XML export (add-on) |
| **Documents** | Universal Print Engine, print profiles, real stamp/signature assets |
| **Communication** | Email, WhatsApp (Meta WABA add-on), campaigns, inbox |
| **Portals** | Customer, Karigar, Supplier — tenant-isolated |
| **Intelligence** | AI Assistant (credit-gated), contextual help |
| **Customization** | Terminology, custom transactions/formulas/workflows (Scale/Max) |
| **Platform** | Multi-branch, RBAC, audit trail, backup (.ornexa.enc) |
| **Billing** | Razorpay checkout, plans, AMC renewal, credits |

Each feature links to `/help` anchor or tutorial where available.

---

### 3.6 Pricing (`/pricing`)

**Source of truth:** `commercial_plans` table via Plan Builder — **never hardcoded HTML prices**.

#### Plan ladder (authoritative names)

| Tier | Device surfaces | Branches | Portals / AI (summary) |
|------|-----------------|----------|------------------------|
| **Ornexa Basic** | Choose 1: Web **or** Desktop (no mobile) | 1 | Core ERP; no portals, no AI |
| **Ornexa Growth** | Choose 1: Web, Desktop, **or** Mobile | 1 | + expanded inventory; 1 portal |
| **Ornexa Professional** | Choose **2** of Web, Desktop, Mobile | 1 | Advanced manufacturing, CEO portal, 2 portals |
| **Ornexa Scale** | Choose **2** of Web, Desktop, Mobile | 1 | Universal customization, workflow designer, context AI |
| **Ornexa Max** | **All 3** surfaces | 1 (+ add-on branches) | Full hybrid, all portals, uncapped fair-use users |

#### Business products (attach to plan)

- Ornexa Manufacturing  
- Ornexa Wholesale  
- Ornexa Retail  
- Ornexa Hybrid / Enterprise  

#### Add-ons (public summary)

| Add-on | Purpose |
|--------|---------|
| Extra branch license | Additional physical location |
| User seat pack | Expand seat cap (non-Max plans) |
| WhatsApp WABA | Meta partner messaging quota |
| Cloud AI pack | Metered LLM credits |
| Tally export | XML pipeline |
| Storage pack | Additional GB |

#### AMC / Platform Care (Ornexa model — not competitor rules)

- Configurable in Platform Owner Plan Builder  
- Models: fixed ₹, % of license, tier schedule, bespoke enterprise  
- Lifecycle: renewal reminders (30/14/3 days) → 7-day grace → read-only (zero data deletion)  
- **Do not publish Jwelly AMC percentages or rules**

#### Pricing page CTAs

- **Start 14-Day Free Trial** (default plan: Growth or Professional — PO-configured)  
- **Contact sales** for Max / hybrid / multi-branch quotes  

---

### 3.7 14-Day Free Trial (`/trial/start`)

**Frozen V1 scope** per `V1_PRODUCT_FREEZE.md`.

#### Flow

```
/trial/start (public)
  → Collect: name, email, password, firm name, phone, product interest, consent checkboxes
  → Auth: Supabase signUp + email verification OR Google OAuth (when enabled)
  → Edge: public-trial-provision → tenant + trial subscription
  → Redirect: /onboarding (assisted setup wizard)
  → After onboarding: auth gate → ERP workspace
```

#### Auth methods on trial page

| Method | Status |
|--------|--------|
| Email + password | Required baseline |
| Google OAuth | **Enabled on staging**; production when Supabase provider configured |
| OTP | Optional per policy — not blocking V1 |

#### Consent (required)

- Terms of Service  
- Privacy Policy  
- Optional marketing opt-in  

#### Trial commercial rules

- 14-day trial period (`trial_end` on `tenant_subscriptions`)  
- Trial lifecycle sweep (`trial-lifecycle-sweep` edge)  
- Platform Owner visibility in `/platform/trials`  
- Lead capture in `platform_commercial_leads`  

#### Product pre-selection

Query param: `/trial/start?product=manufacturing|wholesale|retail` — sets wizard defaults, not entitlements (entitlements follow trial plan config).

---

### 3.8 Login (`/login`)

**Single authentication page** for all identities.

#### Methods

1. Email / password (primary)  
2. Google OAuth (staging + production when configured)  
3. OTP (where enabled — secondary)  

#### Removed patterns (do not restore)

- Separate `/customer-login`, `/karigar-login`, `/supplier-login` as primary entry  
- Portal picker on login screen  
- URL/email inference for workspace  

#### Post-login

- `auth.callback` → `/` is **not** used for dashboard redirect  
- Auth gate loads `get_authorization_context()` → `resolve_default_workspace_route()`  
- Multi-role: Workspace Switcher in shell  

#### Session-aware marketing nav

- Signed out: **Login**  
- Signed in: **Open Ornexa** (goes to resolved workspace, not marketing home)  

---

### 3.9 Training & help (`/help`)

Public-facing entry to Training Centre curriculum (see `TRAINING_CENTRE_MASTER.md`):

- Getting started, manufacturing, gold & bullion, Party 360, inventory & tags  
- Accounting, reports, print, portals, assistant, security  

**Public vs authenticated:**

- Public: overview, selected articles, trial onboarding guides  
- Full interactive walkthroughs: after login (progress in `user_tutorial_progress`)  

---

### 3.10 FAQ (`/faq`)

| Topic | Example questions |
|-------|-------------------|
| Product | Is Ornexa retail POS or manufacturing ERP? |
| Trial | How does the 14-day trial work? |
| Plans | What’s included in Basic vs Professional? |
| Gold | How does gold accounting work? |
| Portals | Can my customers log in separately? |
| Security | Where is data stored? RLS? |
| Migration | Can I import opening balances? |
| Billing | Razorpay, AMC renewal, downgrade behavior |
| Google login | Is Google required? (No — optional additional method) |
| Support | Training, onboarding, contact channels |

---

### 3.11 Contact / demo (`/contact`)

**Intents:** `?intent=demo|sales|support`

| Field | Purpose |
|-------|---------|
| Name, firm, city | Qualification |
| Business type | Manufacturing / Wholesale / Retail / Hybrid |
| Staff count, branches | Sizing |
| Phone, email | Callback |
| Message | Free text |
| Consent | Privacy + contact permission |

**Routing:** Creates `platform_commercial_leads` + optional Platform Owner task.

**Channels to display:** Sales email, support email, WhatsApp (if published), response SLA (business hours).

---

### 3.12 Legal pages

Required for trial signup and SEO:

- `/privacy` — exists; align with consent capture  
- `/terms` — subscription, trial, acceptable use  
- `/refund` — Razorpay refund policy per commercial rules  

---

## 4. SEO & Technical Requirements

### 4.1 Per-page SEO checklist

| Requirement | Detail |
|-------------|--------|
| Unique `<title>` and meta description | Per route |
| Canonical URLs | `https://<production-domain>/...` |
| Open Graph + Twitter cards | Homepage, solutions, pricing |
| Structured data | `Organization`, `SoftwareApplication`, `FAQPage` on `/faq` |
| `sitemap.xml` | All public routes |
| `robots.txt` | Allow `/`, disallow `/app`, `/platform`, portals |
| Performance | LCP < 2.5s on mobile; no auth gate on `/` |
| i18n (future) | English first; Hindi UI in product, not required on marketing V1 |

### 4.2 Routes that must **not** be indexed

```
/app/*
/platform/*
/onboarding (authenticated)
/customer/*
/karigar/*
/supplier/*
/auth/*
```

### 4.3 Content tone

- Specific: “karigar issue slip”, “fine gold in milligrams”, “BIS hallmark workflow”  
- Avoid: “revolutionary AI-powered synergy platform”  
- Lead with outcomes: custody, compliance, throughput, fewer reconciliation nights  

---

## 5. Conversion Funnel

```
                    ┌─────────────────┐
   Organic/Ads ───► │  /  Homepage    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
  /solutions/*           /pricing            /features
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
              ┌──────────────────────────┐
              │   /trial/start (primary)  │
              │   or /contact?intent=demo │
              └────────────┬─────────────┘
                           ▼
              ┌──────────────────────────┐
              │  Supabase Auth + provision│
              └────────────┬─────────────┘
                           ▼
              ┌──────────────────────────┐
              │  /onboarding wizard       │
              └────────────┬─────────────┘
                           ▼
              ┌──────────────────────────┐
              │  Auth gate → workspace    │
              └──────────────────────────┘

Returning users: /login → auth gate → workspace (never forced through marketing /)
```

---

## 6. Commercial Rules (authoritative summary)

| Topic | Ornexa rule |
|-------|-------------|
| **Pricing** | Dynamic from Plan Builder; effective-dated plan versions |
| **Trial** | 14 days public; `provision_public_trial` |
| **Payment** | Razorpay → webhook → subscription state → entitlements |
| **AMC** | Platform Care; configurable %, fixed, or bespoke — not hardcoded |
| **Downgrade/expiry** | Read-only history; zero data deletion |
| **Device surfaces** | Entitlement-gated: web, desktop, mobile per plan |
| **Business modes** | Manufacturing, wholesale, retail licensed separately |
| **Add-ons** | Branch, users, WABA, AI, Tally, storage |
| **Google OAuth** | Additional auth method; configure Supabase provider per environment |

---

## 7. Google OAuth — Staging & Production Checklist

**Do not remove Google OAuth.** Complete on staging before QA.

1. Supabase Dashboard → Auth → Google → enable + Client ID/Secret  
2. Redirect URLs:
   - Staging: `https://avs-erp-preview-20260806.hostingersite.com/auth/callback`
   - Production: `https://<production-domain>/auth/callback`
3. Site URL matches environment base  
4. Build flag: `VITE_GOOGLE_OAUTH_ENABLED=true` on staging (or `VITE_APP_ENV=staging`)  
5. Verify: `/login`, `/trial/start`, `/invite/accept`  
6. Detail: `docs/GOOGLE_OAUTH_STAGING.md`

**Blocker if skipped:** Google button visible but provider error on click.

---

## 8. Implementation Notes (engineering)

| Item | Current state | Public site action |
|------|---------------|-------------------|
| `/trial/start` | Exists (`trial.start.tsx`) | Wire marketing CTAs |
| `/login` | Needs dedicated public route (or `/` split) | Separate from ERP shell |
| `/` | Currently may mount app shell | **Split:** marketing layout vs `auth-gate` app |
| `__root.tsx` public routes | Includes `/trial/start`, `/privacy` | Extend list for marketing pages |
| Plan comparison API | `commercial_plans` | Server/edge read for `/pricing` |
| Session nav | — | “Open Ornexa” when `supabase.auth.getSession()` |

---

## 9. Comparison — Jwelly Public Idea → Ornexa Decision

| # | Jwelly public-site idea | Decision | Ornexa implementation |
|---|-------------------------|----------|----------------------|
| 1 | Homepage “all-in-one” hero for entire jewellery trade | **Improve** | Manufacturing-first hero; wholesale/retail as licensed capabilities |
| 2 | Version nav: Retail, Wholesale, Manufacturing, Girvi | **Improve** | Solutions: Manufacturing, Wholesale, Retail, Enterprise — **no Girvi lending** unless PO adds product |
| 3 | 30+ feature cards on one page | **Improve** | ~12 categorized features with deep links to `/help` |
| 4 | Numbered USP lists on solution pages | **Keep** | Use on `/solutions/*` with Ornexa-specific USPs (Gold Vault, custody, portals) |
| 5 | Screenshot carousels per solution | **Keep** | Real Ornexa screenshots only; lazy-load |
| 6 | “Get Free Demo” as primary CTA | **Improve** | **Start 14-Day Free Trial** primary; demo secondary on `/contact` |
| 7 | Phone + WhatsApp everywhere | **Keep** | Contact section + optional click-to-chat; no spam popups |
| 8 | Testimonial carousel | **Keep** | Pilot quotes when verified; avoid fake density |
| 9 | Trust marquee (28 years, 1L users) | **Improve** | Verified AVS/Ornexa facts only; no inflated user counts |
| 10 | Jewel Konnect free app funnel | **Reject** (V1) | No separate app store funnel until product exists; use `/help` + trial |
| 11 | Tutorial index (48 tutorials) | **Keep** | `/help` + Training Centre; public preview articles |
| 12 | FAQ page for commercial questions | **Keep** | `/faq` with trial, AMC, plans, security |
| 13 | Blog + What’s New | **Improve** | `/changelog` or `/whats-new` when release cadence stable |
| 14 | Associates/partner network page | **Reject** (V1) | Revisit for dealer channel program |
| 15 | Download nav (desktop/mobile) | **Improve** | Link to entitled client downloads post-login; marketing mentions surfaces per plan |
| 16 | Razorpay badge in header | **Keep** | Payment trust on pricing/trial pages |
| 17 | Live chat widget | **Improve** | Business-hours chat or WhatsApp — not intrusive auto-popup |
| 18 | “No setup cost / no installation” | **Improve** | “14-day cloud trial — assisted onboarding included” |
| 19 | Offline-first marketing claim | **Reject** | Ornexa is Supabase-online authoritative; honest cloud positioning |
| 20 | AI catalog / background removal hype | **Improve** | Market **Assistant** + operational AI (credit-gated), not photo gimmicks |
| 21 | Digital Gold / Kitty / Girvi on homepage | **Reject** (V1) | Out of scope unless PO adds; avoids positioning dilution |
| 22 | Retail POS as equal hero | **Reject** | Retail is capability page; manufacturing is lead story |
| 23 | Demo-only signup (no self-serve) | **Reject** | `/trial/start` self-serve provisioning is core GTM |
| 24 | Single login mixing app + marketing on `/` | **Reject** | `/` public; `/login` auth; no dashboard redirect from home |
| 25 | Footer legal cluster (privacy, terms, refund) | **Keep** | Required for trial consent + SEO |
| 26 | GST/HUID/compliance keywords for SEO | **Keep** | Use in manufacturing/retail solution copy where accurate |
| 27 | Module icon grid on homepage | **Improve** | 6 high-signal pillars instead of 14 generic modules |
| 28 | Watch Demo video CTA | **Keep** | Short product walkthrough on homepage (when recorded) |
| 29 | Multi-branch marketing | **Keep** | “1 branch included; add-on branches” — honest entitlement language |
| 30 | AMC FAQ | **Improve** | Explain Ornexa Platform Care model from Plan Builder — not competitor % |

---

## 10. V1 Launch Checklist (public website)

- [ ] `/` serves marketing layout without auth-gate redirect  
- [ ] `/login` single page with email + Google OAuth  
- [ ] `/trial/start` linked from all primary CTAs  
- [ ] `/pricing` reads live `commercial_plans`  
- [ ] `/solutions/manufacturing` page live  
- [ ] `/faq`, `/contact`, `/privacy`, `/terms` live  
- [ ] `robots.txt` + `sitemap.xml`  
- [ ] Google OAuth staging configured and E2E tested  
- [ ] “Open Ornexa” nav when session exists on public pages  
- [ ] Auth gate workspace resolution verified for all role types  
- [ ] No hardcoded competitor pricing or AMC rules  
- [ ] Lighthouse SEO ≥ 90 on homepage (mobile)  

---

## 11. Explicit instruction for implementers

> **Do not remove Google OAuth.** Configure and complete it on **STAGING** using Supabase Auth with correct Google provider credentials, staging redirect/callback URLs, unified role-based auth gate, and the public 14-day trial signup flow. Keep email/password as well; Google OAuth is an **additional** login/signup method, not a replacement.

> **Do not clone Jwelly.** Use `JWELLY_PUBLIC_WEBSITE_INSPIRATION.md` only to find gaps in our public-site IA. All product claims, prices, AMC rules, and screenshots must come from Ornexa canonical docs and the actual codebase.

---

*Document owner: Product / Platform. Updates require alignment with `ORNEXA_PRODUCT_CONSTITUTION` and commercial masters when routing, trial, or entitlement behavior changes.*
