# APPIT Jewel ERP — AI & Automation Audit
**Date:** 2026-08-12  

This document evaluates the AI intelligence panel, predictions, recommendations, and notifications observed in the trial.

---

## 1. AI Intelligence Module (`/ai-intelligence/ai-copilot`)

APPIT features an **AI Intelligence** menu containing:
1. **AI Copilot**: An interactive chatbot panel that answers natural-language queries about business health (e.g. "What is our best-selling jewellery category this month?").
2. **Forecasts**: Predictive models forecasting upcoming gold price trends and sales volumes.
3. **Recommendations**: Auto-generated stock-reordering levels and pricing updates.
4. **Anomaly Center**: System alerts flagging inconsistent data postings (e.g., old gold purchases with unexpected purities).

### Observation & Implementation Verification:
* **LLM Integration**: The AI Copilot uses an API call to a Large Language Model (LLM) configured with the business's database schema, letting it run semantic queries over sales, vault inventory, and worker ledgers.
* **Rules vs AI**: Price predictions and recommendations are calculated using a blend of statistical models and time-series rules rather than generative models. This ensures math calculations remain deterministic.

---

## 2. Dynamic Automation Systems

The platform triggers alerts and follow-ups based on real-time transaction state changes:

### 2.1. Critical Alerts & Push Notifications:
* **Karigar Delay Risk**: Inside the Job Card details drawer, the system calculates a delay risk percentage:
  $$\text{Delay Risk} = f(\text{Karigar historical on-time rate}, \text{Job priority}, \text{Days remaining})$$
* **Purity Anomaly Flag**: Flags old gold intakes where the appraised Karat value deviates by >5% from nominal purity stampings (triggering a supervisor quality inspection request).
* **Metal Outstanding Warning**: Pushes notifications to the dashboard when a Karigar's outstanding balance is >90% of their configured bench limit.

### 2.2. Operations Automation:
* **Low Stock Reorder**: Triggers purchase drafts automatically when finished items of specific categories (e.g. 22K chains) fall below safety vault limits.
* **Auto-reminders**: Automated WhatsApp/email payment reminders sent to retail customers with outstanding custom order balances.
