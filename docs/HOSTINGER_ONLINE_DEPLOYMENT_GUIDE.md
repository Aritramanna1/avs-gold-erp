# MTJ / AVS ERP — Hostinger Online / Managed Deployment Guide

This guide provides the complete, authoritative procedure for deploying the **Online / Managed** version of **MTJ / AVS Gold & Diamond Jewellery ERP** to **Hostinger Business Shared Hosting**, with **Supabase PostgreSQL, Auth, and RLS** as the authoritative cloud database and security layer.

---

## 1. System Architecture

```
                             AVS ERP ONLINE
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
       HOSTINGER BUSINESS HOSTING            SUPABASE CLOUD
       • Frontend SPA (React + Vite)         • PostgreSQL Database
       • PHP Backend API (/api/)             • Supabase Auth
       • File Storage (/uploads/)            • Row Level Security (RLS)
       • Webhooks (/api/webhooks/)           • Database Functions / RPC
       • Cron Jobs (/api/cron/)              • Realtime Gateway
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                               ONE COMPANY
                    (MTJ / AVS Gold & Diamond Jewellers)
                                    │
                            MULTIPLE BRANCHES
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
        Main Showroom         Branch 2 / Retail     Karigar / Workshop Unit
        (Gorakhpur)           (Outlet Counter)      (Manufacturing Hub)
```

---

## 2. Directory Structure on Hostinger (`public_html`)

When deployed to Hostinger, your `public_html/` folder will be structured as follows:

```
public_html/
├── .htaccess                   # Apache SPA routing & security rules
├── index.html                  # Compiled ERP entry point
├── assets/                     # Compiled JS, CSS, and font chunks
│   ├── index-*.js
│   └── index-*.css
├── api/                        # Hostinger PHP Backend & Webhooks
│   ├── config.php              # Environment & Supabase REST client
│   ├── health.php              # Diagnostics & reachability check
│   ├── hostinger-upload.php    # Canonical authenticated upload endpoint
│   ├── webhooks/
│   │   ├── razorpay.php        # Razorpay payment verification webhook
│   │   └── whatsapp.php        # Meta WhatsApp Cloud API webhook
│   └── cron/
│       └── scheduled-jobs.php  # Scheduled jobs & queue sweep runner
└── uploads/                    # Secure persistent file uploads
    └── .htaccess               # (Script execution denied)
```

---

## 3. Step-by-Step Deployment Procedure

### Step 1: Build the Production Bundle
On your local machine, run the production build:
```bash
npm run build
```
The compiled production assets will be generated in `dist/`, including all `api/` scripts and `.htaccess`.

### Step 2: Upload Files to Hostinger
1. Log in to **Hostinger hPanel** → **File Manager** (or connect via SFTP).
2. Navigate to `public_html/` for your domain (e.g. `maatarajewellers.shop`).
3. Upload all contents of the local `dist/` directory into `public_html/`.

### Step 3: Configure Environment Variables
Create a file named `.env` in the root of your hosting account (one level above `public_html` or directly inside `public_html/`):

```ini
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# Meta WhatsApp Cloud API
WHATSAPP_VERIFY_TOKEN=mtj_avs_whatsapp_secure_2026
WHATSAPP_ACCESS_TOKEN=your_meta_system_user_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

# Scheduled Cron Security
CRON_SECRET=your_custom_secure_cron_token_2026
```

### Step 4: Verify Backend Health
Open the health check URL in your browser:
```
https://yourdomain.com/api/health.php
```
**Expected Response:**
```json
{
  "status": "healthy",
  "environment": {
    "php_version": "8.2.x",
    "missing_extensions": []
  },
  "supabase": {
    "reachable": true,
    "latency_ms": 45.2
  }
}
```

---

## 4. Webhook Configurations

### A. Razorpay Webhook
- **Webhook URL**: `https://yourdomain.com/api/webhooks/razorpay.php`
- **Secret**: Set the same secret as in `RAZORPAY_WEBHOOK_SECRET`.
- **Events to Subscribe**:
  - `payment.captured`
  - `payment.failed`
  - `order.paid`

### B. Meta WhatsApp Cloud API Webhook
- **Callback URL**: `https://yourdomain.com/api/webhooks/whatsapp.php`
- **Verify Token**: Must match `WHATSAPP_VERIFY_TOKEN`.
- **Webhook Fields**: `messages`.

---

## 5. Hostinger Cron Setup (Scheduled Jobs)

In **Hostinger hPanel** → **Advanced** → **Cron Jobs**:
- **Type**: Custom
- **Command**:
  ```bash
  php /home/uXXXXX/public_html/api/cron/scheduled-jobs.php
  ```
- **Interval**: Every 15 minutes (`*/15 * * * *`)

---

## 6. Multi-Branch Security & Operations

1. **Company & Branch Model**: All transactions, gold balances, and ledgers are associated with the active branch.
2. **Branch Isolation**: User permissions are enforced on Supabase PostgreSQL via RLS and client-side via `useBranch()`.
3. **Setup Route Disabled**: Public route `/setup` is disabled; all users log in securely via `/login`.
