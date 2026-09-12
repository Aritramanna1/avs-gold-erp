# 00 — Full project scope (AVS Gold ERP / Arivahly)

**Date:** 2026-09-12 · Researchy  
**Mission:** Production-ready SaaS gold ERP. **GOLD FIRST · CASH SECOND · ALWAYS SEPARATE.**

---

## 1. Product

Jewellery workshop ERP for low-literacy operators that stays rigorous for inventory and accounts.

- Gold quantities authoritative as **g @ 995**  
- Cash/₹ always a **separate** dimension  
- Familiar UX: icon + word, large touch targets, mobile/tablet/desktop  

North-star Notion: AVS Gold ERP (Arivahly) project + Agent Tasks board.

---

## 2. Surfaces

| Surface | URL / path | Role |
|---------|------------|------|
| Live ERP | https://erp.arivahly.in | Hostinger deploy (LIVE ≠ tip until pull) |
| Local tip | `C:\final erp 29.08\new and final` | Eng source of truth on Maa_Tara |
| Shop (frozen) | https://maatarajewellers.shop | **Never deploy over** without owner OK |
| Marketing / Aurum | aurum.arivahly.in | SSL currently broken — ops |
| Portal | portal.arivahly.in | DNS/ops |
| Repo | github.com/Aritramanna1/avs-gold-erp | main |

---

## 3. Accounts (no passwords in docs)

| Account | Role |
|---------|------|
| **222** | SaaS Admin / platform — must remain |
| **777** | Maa Tara Jewellers firm ERP test — never SaaS Admin |

---

## 4. Core ERP modules (in scope)

Home; Sell/Sales; Customers/Parties; Stock/Inventory; Gold/tag/barcode/HUID; Make/Manufacturing/WIP/Jobs; Karigar/Workshop/metal custody; Melt/refining; Money/Accounts/Ledger/Daybook/Balances/Settlements; Invoices/Estimates/Returns; Payments/Receipts; GST; Payroll/People; Reports/Reconciliation/Audit; Communication; Automation; Company/Tenant/Branch admin; Documents/Print; AI (product); MCP/OAuth; Public invoice verification.

---

## 5. Platform / ops (in scope — self-host)

| Area | Scope |
|------|--------|
| Hosting | Hostinger for app, mail, heavy workers |
| Auth/DB | Supabase auth + DB only |
| Support desk | **Chatwoot CE self-host** (SoT); Grok Bot FAQ triage |
| Payments (SaaS) | Razorpay for license/credits — TEST now; LIVE held |
| Credits | Tenant Cloud AI / WhatsApp / OCR — **not** for SaaS support |
| AI paid features | **Later** |

Out of scope now: Carrier portal; Supplier portal as Core MUST HAVE; shop redeploy; inventing tax/gold rates.

---

## 6. UX / navigation target (locked AVS-4)

Top nav: **Home · Sell · Customers · Stock · Make · Money · Reports · More**  
Stock lands on **Gold** first. Rate chip → Set today’s gold rate. Gold block before Cash. Icon+word · ≥48px.

---

## 7. Delivery constraints

1. No hardcoded secrets  
2. QA: click UI only — no pasted deep URLs  
3. No shop deploy  
4. LIVE ≠ tip until Hostinger pull of main  
5. CA gate on tax profiles  

---

## 8. Pods

Projects Manager · Lingxi eng · Researchy · Testing · Game Art Director (art only)
