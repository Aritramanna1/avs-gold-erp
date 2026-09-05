# GitHub to Hostinger Auto-Deployment Configuration Guide

**Target Subdomain**: [`https://erp.arivahly.in`](https://erp.arivahly.in)  
**Primary Repository**: `https://github.com/Aritramanna1/avs-gold-erp.git`  
**Deployment Repository**: `https://github.com/Aritramanna1/avs-erp-hostinger-live.git`  

---

## 1. Local Dual-Push (Already Configured)

Your local repository is now configured with **multi-push remote URLs**. Whenever you run:
```bash
git push origin feature/production-v1.1.2
```
Git automatically pushes simultaneously to **BOTH**:
1. `https://github.com/Aritramanna1/avs-gold-erp.git` (Source of truth)
2. `https://github.com/Aritramanna1/avs-erp-hostinger-live.git` (Hostinger deployment remote)

You do **not** need to push to multiple remotes separately.

---

## 2. Hostinger hPanel Git Auto-Deployment Setup (1-Click)

To have Hostinger pull and deploy automatically on every Git push without logging in:

1. **Open Hostinger hPanel**:
   - Go to **Websites** → Select `arivahly.in` (or subdomain `erp.arivahly.in`).
   - In the sidebar search, type **Git** and click **Git**.

2. **Connect Repository**:
   - **Repository**: `https://github.com/Aritramanna1/avs-erp-hostinger-live.git`
   - **Branch**: `feature/production-v1.1.2` (or `main`)
   - **Install Path**: Leave empty or set to document root for `erp.arivahly.in`.
   - Click **Create**.

3. **Enable Auto-Deployment Webhook**:
   - After creation, click **Auto-Deployment** in Hostinger Git section.
   - Hostinger will provide a unique **Webhook URL** (e.g. `https://api.hostinger.com/v1/git/deploy/...` or similar).
   - Copy this URL.

4. **Add Webhook to GitHub**:
   - Go to GitHub: `https://github.com/Aritramanna1/avs-erp-hostinger-live/settings/hooks` (or `avs-gold-erp/settings/hooks`).
   - Click **Add webhook**.
   - **Payload URL**: Paste the Hostinger Webhook URL.
   - **Content type**: `application/json`.
   - **Which events**: "Just the push event".
   - Click **Add webhook**.

From this moment on, every time code is pushed, Hostinger immediately and automatically pulls and deploys the latest version!

---

## 3. GitHub Actions Automated CI/CD (Optional Cloud Build)

A production workflow is now configured at [`.github/workflows/production-deploy.yml`](file:///c:/final%20erp%2029.08/new%20and%20final/.github/workflows/production-deploy.yml).

If you want GitHub Actions to build and deploy via FTP or Webhook:
1. In GitHub Repository → **Settings** → **Secrets and variables** → **Actions**.
2. Add secrets:
   - `HOSTINGER_DEPLOY_WEBHOOK_URL`: (The webhook from Hostinger hPanel)
   - *Or* FTP credentials:
     - `HOSTINGER_FTP_SERVER` (e.g. `ftp.arivahly.in`)
     - `HOSTINGER_FTP_USERNAME`
     - `HOSTINGER_FTP_PASSWORD`
