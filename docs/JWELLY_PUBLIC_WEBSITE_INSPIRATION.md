# Jwelly Public Website — Inspiration Research

**Purpose:** Document the **public marketing website** at [jwelly.com](https://www.jwelly.com/) for information-architecture and conversion ideas only.  
**Scope:** Homepage, version/solution pages, features, tutorials, FAQs, contact/demo CTAs, legal pages, and public SEO surfaces.  
**Explicitly out of scope:** Jwelly ERP application UI, login screens, dashboards, or any in-product workflows.

**Disclaimer:** This document is **inspiration only**. Ornexa must not copy Jwelly branding, copy, pricing, AMC rules, screenshots, or software design. Use this to identify public-site patterns we may have overlooked.

**Research date:** August 2026  
**Pages successfully reviewed:** Homepage, `/features`, `/retail`, `/manufacturing`, `/wholesale`, `/tutorial`, `/faqs`  
**Pages not found (404 at time of research):** `/about-us`, `/contact-us`, `/manufacturing-erp`, `/wholesale-erp`

---

## 1. Executive Summary

Jwelly’s public site is a **single-product jewellery ERP marketing funnel** built around:

- A broad “all-in-one” homepage hero
- **Version-based segmentation** (Retail, Wholesale, Manufacturing, Girvi/Money Lending)
- A long **feature catalogue** page
- **Solution landing pages** with numbered USPs and screenshot carousels
- Strong **demo-led conversion** (“Get Free Demo”, “Watch Demo”, phone/WhatsApp)
- **Trust stacking** (28+ years, 1 lakh+ users, awards, testimonials)
- A companion **free mobile app** (Jewel Konnect) as a top-of-funnel lead magnet
- Footer-heavy **legal/compliance** and contact routing

For Ornexa, the useful takeaway is not feature parity but **how they structure discovery → trust → segment → demo**. Our implementation should be cleaner, more modern, mobile-first, and aligned to Ornexa’s actual manufacturing-first positioning and SaaS trial model.

---

## 2. Information Architecture (Public Site Map)

```
jwelly.com (public)
├── Home (/)
├── Versions / Solutions
│   ├── Retail (/retail)
│   ├── Wholesale (/wholesale)
│   ├── Manufacturing (/manufacturing)
│   └── Girvi / Money Lending (linked from footer & homepage)
├── Features (/features) — long-form capability grid
├── Tutorial (/tutorial) — searchable tutorial index (48 items)
├── Blog (linked in nav; not deeply reviewed)
├── What's New (linked in nav)
├── FAQs (/faqs)
├── Associates / partner network (homepage section + footer)
├── Download (nav item — app/store distribution)
├── Legal
│   ├── Privacy Policy
│   ├── Terms & Conditions
│   └── Refund & Cancellation
└── Contact / Demo (CTA throughout; dedicated URL returned 404)
```

### Navigation pattern

| Nav item | Role |
|----------|------|
| Home | Primary entry, SEO anchor |
| Versions | Segment by business type |
| Download | App distribution / mobile funnel |
| Features | SEO + depth for long-tail queries |
| Tutorial | Support SEO + pre-sales education |
| Blog | Content marketing |
| What's New | Release marketing / retention signal |
| Contact Us | Sales/support (broken URL; CTAs still everywhere) |
| Get Free Demo | Persistent primary CTA in header |

**Observation:** Navigation is **product-centric** (versions + features) rather than **buyer-journey-centric** (pricing, trial, compare plans). Ornexa can improve clarity with explicit **Pricing**, **14-Day Trial**, and **Login** paths.

---

## 3. Homepage Structure & Content Blocks

### 3.1 Hero

- **Headline:** “All-in-One for Your Entire Jewellery Business”
- **Subhead:** AI-driven, omnichannel, purchase/inventory/sales in one dashboard
- **Primary CTAs:** “Try Jwelly ERP” + “Watch Demo”
- **Visual:** Dashboard lifestyle image

### 3.2 Value pillars (feature cards)

Six rotating benefit cards with icon, title, 3 bullet points, and product screenshot:

1. Inventory Management  
2. Customer Management  
3. Smart Catalog (AI background removal, watermarking)  
4. Smart Alerts (WhatsApp/SMS)  
5. Data Analytics  
6. Financial Reports (GST, Tally mention)

### 3.3 Trust bar (marquee)

Repeated credibility chips:

- 28+ Years of Expertise  
- 1 Lakh+ Happy Users  
- AI For Jewellery Business  
- Pan India Support  
- Multiple Award Winner  

### 3.4 Module grid

Icon grid of ~14 modules: Accounting, GST, Inventory, Sales & CRM, Order & Repairs, Karigar, Bullion, Kitty, Website, Mobile App, Cataloging, Digital Gold, RFID, Reports.

### 3.5 Version cards

Four solution tiles with “Learn More”:

- Wholesale  
- Retail Version  
- Manufacturing  
- Girvi Money Lending  

### 3.6 Enterprise positioning

“SECURE. SCALABLE. CUSTOMIZABLE.” with three pillars:

- Role-based permissions  
- Cloud & Desktop (hybrid deployment choice)  
- Custom workflows  

### 3.7 Companion app funnel (Jewel Konnect)

Two-tier app story:

| Tier | Audience | Value |
|------|----------|-------|
| Open for all jewellers | Free app users | Live metal rates, rate alerts, city networking, demo requests |
| Exclusive for ERP customers | Paying clients | AMC renewal, support tickets, referral rewards, escalation |

**Strategic note:** This is a **lead-gen + retention** layer separate from the ERP login — useful pattern for Ornexa’s public `/` vs `/login` split.

### 3.8 Social proof

Long testimonial carousel with jeweller names and firms.

### 3.9 About snippet

“Since 1997…” company story with “Know More” (target 404 at research time).

### 3.10 FAQ accordion (homepage)

Five questions visible on homepage (full list on `/faqs`):

- Different from generic ERPs?  
- Offline support?  
- Data security?  
- Hardware requirements?  
- Migration from old software?  
- On-site training?  

### 3.11 Footer CTA band

- App Store / Play Store badges  
- “Get Started Today — No setup cost. No installation.”  
- Phone + WhatsApp  
- Version links, company links, contact block  

---

## 4. Solution Landing Pages (Versions)

Each version page follows a **repeatable template**:

| Section | Manufacturing | Wholesale | Retail |
|---------|---------------|-----------|--------|
| Hero | Production control for CZ/chain/diamond/kundan/plain gold/silver | Speed & accuracy for bulk trade | HUID, insurance, retail billing |
| Sub-segment chips | Manufacturing type pills (SEO long-tail) | — | — |
| USP list | 10 numbered USPs | 7 numbered USPs | 13 numbered USPs |
| Screenshot carousel | 9 slides | 5 slides | 11 slides |
| Closing CTA | Transform operations | Wholesale excellence | Retail empowerment |
| Footer | Same global footer | Same | Same |

### Manufacturing page themes (public messaging)

- Job/department creation, design catalogue, manufacturing orders  
- Wax tracking, karigar hisab, loss reporting  
- Department-wise auto stock transfer, weight trial I/O, BOM-linked design master  

### Wholesale page themes

- Single-screen feeding (sale, return, purchase, metal receipt, bhav fix)  
- Mobile billing, online/offline  
- WhatsApp bill sharing, customer-wise profit  
- Auto wastage/labour, poly & box stock  

### Retail page themes

- Festival-wise sales, fast/slow/dead stock  
- HUID tag history, tag split/merge, preset labour/polish  
- OTP approvals, owner mobile alerts  
- Order/repair tracking, insurance in billing, GST  

**SEO technique:** Heavy use of **industry keywords** in headings and USP copy (e.g. “Jewellery Store Management Software”, “HUID”, “GST Billing Software”).

---

## 5. Features Page (`/features`)

Long scroll of **~30 feature cards**, each with title + paragraph. Grouped thematically but not formally categorized:

| Theme cluster | Examples on page |
|---------------|------------------|
| Lending & schemes | Girvi, Kitty, Online Scheme, Digital Gold |
| Operations | Branch management, Order/repair, Job-wise tracking, Cataloging |
| Compliance & finance | GST, Sale Point POS, Financial reports |
| Workforce | Karigar, Salary + biometric, CRM |
| Hardware & integrations | RFID, weighing scale, QuickSell, WhatsApp |
| Analytics | Festival stock, dead stock, periodic sales, supplier-wise stock |
| Security | User restrictions, audit trail, critical alerts |

**Presentation style:** Dense feature list — good for SEO, weaker for **decision-stage buyers** who need plan/tier clarity.

---

## 6. Training, Support & Education

### Tutorial hub (`/tutorial`)

- “48 tutorials found” with paginated index  
- Implies a **searchable knowledge base** separate from the ERP  
- Linked from main nav (good pre-sales signal)

### FAQs (`/faqs`)

Accordion covering (~17 topics at titles level):

- What is Jwelly / who can use / small business fit  
- GST, multi-branch, repairs, karigar, mobile  
- Security, support, integrations, getting started  
- Trial availability, update frequency  
- Girvi / gold loan, AMC, customization  

**Gap observed:** FAQ answers not exposed in fetch output (likely accordion JS) — structure still useful for Ornexa FAQ IA.

---

## 7. Demo, Contact & Conversion Funnel

### Primary conversion paths

```
Visitor → Homepage hero CTA ("Try" / "Watch Demo")
       → Header "Get Free Demo"
       → Phone call (sales line, IVR hints: Press 5 sales, Press 1 support)
       → WhatsApp click-to-chat
       → App store download (Jewel Konnect)
       → Footer "Get Started Today"
```

### Secondary paths

- Version “Learn More” → solution page → implicit demo intent  
- Associates/partner network (“View Our Associates”)  
- Tutorial/blog for organic traffic  

### Trust & friction reducers

- “No setup cost. No installation. Just results.”  
- Razorpay badge in header (payment trust)  
- Live chat widget (“Chat now”)  
- Extensive testimonials  

### Weak points (opportunities for Ornexa)

- Dedicated contact URL 404 — reliance on scattered CTAs  
- No clear **self-serve trial signup** on homepage (demo-led, sales-led)  
- Homepage mixes retail POS, girvi lending, digital gold — **positioning dilution** for manufacturing-first buyers  
- Heavy animated/loading shell (“Jwelly ERP Loading…”) may hurt perceived performance and SEO crawl clarity  

---

## 8. SEO Strategy (Observed)

| Technique | Jwelly approach | Ornexa opportunity |
|-----------|-----------------|-------------------|
| Keyword-rich H1/H2 | “Jewellery Manufacturing Software”, “Wholesale Version”, “Smart ERP for Retail Jewellers” | Use Ornexa terms: manufacturing ERP, gold traceability, karigar custody |
| Solution silos | Separate URLs per vertical | `/solutions/manufacturing`, `/solutions/wholesale`, `/solutions/retail` |
| Feature long-tail | `/features` as index page | `/features` + anchor sections + structured data |
| FAQ page | `/faqs` for commercial questions | `/faq` synced to real Ornexa policies |
| Social proof | Testimonials, user counts | Pilot customers, compliance badges, AVS heritage |
| Content hub | Tutorial + blog | `/help` public preview + Training Centre entry |
| Legal pages | Privacy, terms, refund | Required for trial signup consent |
| Local trust | Mathura corporate address, India phone | Ornexa / AVS real contact & support model |

### Meta/technical notes (inferred)

- Client-rendered “Loading…” states suggest SPA — Ornexa public site should prefer **static/SSR marketing pages** for SEO  
- Repeated marquee trust text may be accessibility/SEO noise — Ornexa should use single semantic lists  

---

## 9. Trust Elements Inventory

| Element | Location | Ornexa relevance |
|---------|----------|------------------|
| Years in business (28+) | Homepage marquee | AVS/Ornexa heritage — only if accurate |
| User count (1 lakh+) | Homepage | Use only verified metrics |
| Awards | Homepage | If applicable |
| Testimonials | Homepage carousel | Real pilot quotes when available |
| Partner/associate network | Homepage + footer | Dealer/partner program if planned |
| GST/compliance mentions | Features, retail page | Core Ornexa strength |
| HUID/traceability | Retail/manufacturing | Align with Ornexa TAGGING master |
| Security FAQ | FAQs | Link to Ornexa security model doc |
| AMC FAQ | FAQs | **Do not copy Jwelly AMC rules** — use Ornexa Platform Care model |
| Payment partner (Razorpay) | Header | Ornexa already uses Razorpay for billing |
| App store presence | Footer + Jewel Konnect | Ornexa mobile when entitled |

---

## 10. Content Structure Patterns Worth Studying

### Pattern A — “Numbered USP ladder”

Each solution page: 7–13 numbered benefits with bold titles + explanatory paragraph.  
**Why it works:** Scannable for jeweller owners; good for mobile reading.

### Pattern B — “Screenshot proof carousel”

Full-screen modal gallery per feature area.  
**Why it works:** Reduces abstract ERP fear; must use **Ornexa** screenshots only.

### Pattern C — “Module icon grid”

Quick breadth signal on homepage.  
**Ornexa adaptation:** Map to **Gold Vault, Job Cards, Portals, Print Engine, Assistant** — fewer, stronger icons.

### Pattern D — “Free companion app”

Top-of-funnel without ERP purchase.  
**Ornexa adaptation:** Public metal-rate/tools page or documentation — not a fake ERP login.

### Pattern E — “Footer as sitemap + compliance”

Versions, company, legal, multi-channel contact.  
**Required for Ornexa trial consent flows.**

---

## 11. What Jwelly Does *Not* Emphasize (Ornexa Differentiators)

These are **not prominent** on Jwelly’s public site but are core Ornexa strengths:

- Unified **Gold Vault / fine gold custody** as accounting source of truth  
- **Entitlement-based** plan ladder (Basic → Max) with explicit device surfaces  
- **14-day self-serve SaaS trial** with Supabase provisioning  
- **Customer / Karigar / Supplier portals** as licensed products  
- **Universal Customization** (transactions, formulas, workflows) at Scale/Max  
- **Platform Owner** commercial control plane  
- **Multi-workspace auth** (one login, role-based workspace switch)  
- **Training Centre** inside product + public help entry  
- **AI Assistant** with credit-gated tools (not generic “AI catalog” marketing)  

---

## 12. Research Limitations

- Did not access Jwelly ERP login or authenticated UI  
- Some nav targets returned 404; contact may live on another slug or modal  
- FAQ answer text not fully extracted (accordion)  
- Blog and What’s New not deeply crawled  
- Pricing not published on public site (demo/sales led)  

---

## 13. Source URLs (public only)

| Page | URL |
|------|-----|
| Homepage | https://www.jwelly.com/ |
| Features | https://www.jwelly.com/features |
| Manufacturing | https://www.jwelly.com/manufacturing |
| Wholesale | https://www.jwelly.com/wholesale |
| Retail | https://www.jwelly.com/retail |
| Tutorials | https://www.jwelly.com/tutorial |
| FAQs | https://www.jwelly.com/faqs |

---

*End of inspiration document. For Ornexa authoritative public-site specification, see `docs/ORNEXA_PUBLIC_WEBSITE_MASTER.md`.*
