# 03. Ornexa Architectural, Infrastructure & Budget Strategy (AI-Driven Model)

**Date:** 2026-08-12

This document addresses feasibility, self-development, budget requirements, and architectural recommendations for the Ornexa (AVS Gold ERP) project, optimized for a self-implemented model using AI tools under a strict **₹10,000 – ₹15,000** budget constraint.

---

## 1. Project Feasibility: Is This Possible?

**Verdict**: **YES, ABSOLUTELY.**

- **Reasoning**: The Ornexa codebase is already highly complete. All core accounting logic (dual-currency ledgers, freeze dates, tax engines, audit trails) and page routing structures (billing, workshop books, customer/karigar portals, settings, reports) are fully mapped and implemented in TypeScript.
- Because the codebase compiles clean with zero errors, you can use AI coding tools (such as Claude, ChatGPT, or cursor-based agents) to write the remaining integration connectors step-by-step.

---

## 2. Self-Development Model Using AI

- **Can you build it by yourself?**: **Yes, with AI guidance.**
  - Since you are implementing this through AI, you do not need to hire an external developer. You can act as the product manager/operator, copy-pasting the codebase into context windows, running command line tests, and letting the AI debug code.
- **Methodology**:
  - Use the daily sprint plan ([`02_twenty_day_sprint_plan.md`](file:///c:/avs-test-install/emergent-mtj-V1/Implementation%20Specs/02_twenty_day_sprint_plan.md)) as a prompt guide for your AI workspace.
  - Feed individual routes or components to the AI to write the missing event calculators.

---

## 3. Optimized Budget Breakdown (₹10,000 – ₹15,000 Max)

To take Ornexa live under a strict budget constraint, we eliminate all developer salaries and utilize free-tier and shared hosting services:

| Cost Category   | Service Provider             | Plan Type                                 | Monthly Cost | Annual Total (INR)                  |
| --------------- | ---------------------------- | ----------------------------------------- | ------------ | ----------------------------------- |
| **Development** | AI Coding Tools / APIs       | Free tier / Pay-per-use keys              | ₹0 – ₹500    | **₹5,000** (API key pool)           |
| **Backend DB**  | Supabase                     | Free Tier (500MB DB, plenty for pilot)    | $0           | **₹0**                              |
| **Web Hosting** | Hostinger                    | Shared Hosting (Use your _existing_ host) | ₹0           | **₹0** (No extra cost)              |
| **SMS / OTP**   | Cheap Gateway / WhatsApp Web | Baileys/WPPConnect node automation        | ₹0           | **₹3,000** (Sim-card based gateway) |
| **Domain Name** | Hostinger / Namecheap        | `.in` or `.com` registration              | N/A          | **₹1,000**                          |
| **Token Costs** | OpenAI / Anthropic           | Pay-as-you-go API keys for AI Brain       | Variable     | **₹3,000** (High-intensity period)  |
| **Total Cost**  | **Ornexa Launch Spec**       |                                           |              | **₹12,000** (Within ₹15k limit)     |

---

## 4. Architectural & Infrastructure Decisions

### 4.1. Should You Restart the Project?

- **Recommendation**: **NO. DO NOT RESTART.**
- Restarting would break the existing compiling routes and waste the pre-built ledger models. Keep the current code.

### 4.2. Should You Change the Infrastructure?

- **Recommendation**: **NO. KEEP THE EXISTING STACK.**
- **Vite/React + Supabase + TailwindCSS + TanStack Router** is lightweight, fits perfectly on the Supabase Free Tier, and can be compiled into a static site (`dist` folder) that uploads directly to your **existing Hostinger web server** via FTP or Git hooks in seconds.
- **Offline-First Sync**: Keeping the local SQLite synchronization ensures that workshops can still record gold movements even if the internet goes down, syncing back to Supabase automatically when online.
