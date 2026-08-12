# 03. Ornexa Architectural, Infrastructure & Budget Strategy
**Date:** 2026-08-12  

This document addresses feasibility, self-development, budget requirements, and architectural recommendations for the Ornexa (AVS Gold ERP) project.

---

## 1. Project Feasibility: Is This Possible?

**Verdict**: **YES, ABSOLUTELY.**
*   **Reasoning**: The Ornexa codebase is already highly complete. All core accounting logic (dual-currency ledgers, freeze dates, tax engines, audit trails) and page routing structures (billing, workshop books, customer/karigar portals, settings, reports) are fully mapped and implemented in TypeScript. 
*   We are not starting from scratch; we are completing, stabilizing, and refining an already solid foundation.

---

## 2. Self-Development vs. Hiring Team

*   **Can you build it by yourself?**: 
    - If you are a technical founder with React/Vite/TypeScript and Supabase experience, you can manage the remaining gaps (wiring APIs, tuning SQL policies) on your own.
    - If you are non-technical or focusing on business scaling, doing this entirely alone is not recommended due to the complexity of jewelry double-entry accounting. 
*   **Team Requirement**: You only need **one full-stack React + Supabase developer** for 20-30 days to finish implementation and conduct production deployment. You do not need a large team.

---

## 3. Projected Budget Breakdown

To take Ornexa live and operate it for the first 12 months, budget for the following items:

| Expense Category | Item Details | Est. Cost (First 12 Months) |
|---|---|---|
| **Development** | 1 Full-Stack Developer (20–30 days contract) | ₹1,50,000 – ₹2,50,000 |
| **Backend & Sync**| Supabase Pro Tier ($25/mo + database usage) | ₹25,000 |
| **Hosting & Domain**| Hostinger Cloud/VPS Hosting (for SPA Web App) | ₹10,000 |
| **Communications**| Twilio / Meta WhatsApp API (OTP SMS & Invoice shares) | ₹30,000 (Usage-dependent) |
| **AI API Costs** | OpenAI / Anthropic API (for Assistant Brain queries) | ₹15,000 (Usage-dependent) |
| **Buffer Margin** | Security auditing, miscellaneous | ₹50,000 |
| **Total Estimated**| **Console to Release Lifecycle** | **₹2,80,000 – ₹3,80,000** |

---

## 4. Architectural & Infrastructure Decisions

### 4.1. Should You Restart the Project?
*   **Recommendation**: **NO. DO NOT RESTART.**
*   The current codebase is clean, compile-ready, and follows modern React and TypeScript conventions. Restarting would waste months of development effort without adding functional value.

### 4.2. Should You Change the Infrastructure?
*   **Recommendation**: **NO. KEEP THE EXISTING STACK.**
*   **Vite/React + Supabase + TailwindCSS + TanStack Router** is an excellent, lightweight stack.
*   **Offline-First Sync**: Keeping the local SQLite synchronization ensures that workshops can still record gold movements even if the internet goes down, syncing back to Supabase automatically when online. This is a major advantage over APPIT's online-only architecture.
*   **Deployment**: Deploy the React SPA on your **Hostinger Cloud account** and connect it directly to your production **Supabase instance**. There is no need for expensive AWS or Vercel configurations for the pilot launch.
