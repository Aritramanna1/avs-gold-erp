# ORNEXA — CENTRALIZED EMAIL SERVICE MASTER
**Specification for Central Email Service, Template Engine, Queueing & Provider Abstraction**
*Version: 4.0.0*

---

## 1. Operating Architecture

```mermaid
graph TD
    Trigger["ERP Event (Invite / Invoice / Reset / Security)"] --> Service["Central Email Service"]
    
    Service --> Template["Email Template Engine (Standard HTML / Safe Variables)"]
    Template --> Queue["Async Non-Blocking Email Queue"]
    
    Queue --> Dispatcher["Provider Adapter (Resend / SendGrid / Supabase)"]
    Dispatcher --> Result["Delivery Status (Queued -> Sending -> Sent / Retrying / Failed)"]
```

## 2. Invariants

- **Non-Blocking Execution:** Email dispatch never blocks or delays database commits or user transactions.
- **Delivery Accuracy:** "Sent" indicates SMTP dispatch; "Delivered" is shown only when provider webhook confirms delivery.
- **Configurable Templates:** Supports tenant branding, logos, localized text, and secure action URLs.
