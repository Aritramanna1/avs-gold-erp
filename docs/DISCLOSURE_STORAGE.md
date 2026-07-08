# Technical Disclosure: Local Attachment Preview & Physical File Register System

This formal technical disclosure details the architecture, storage mechanisms, current operational constraints, and cloud migration blueprint for the **Local Attachment Preview** and **Physical File Register** frameworks in the **Areva Venture Studios ERP System**.

---

## 1. Executive Summary

In its current pilot release (MTJ ERP v1.0), the application operates as an **offline-first/client-heavy web platform**.

- **Media Attachment Storage**: Image previews (job card blueprints, catalog entries, customer ID proofs) are stored in local client-side storage pools (**IndexedDB** and **localStorage**), serialised as Base64 strings.
- **Metadata Registration**: The **Physical File Register** indexes physical binders, shelves, and cabinets inside the physical vault where actual gold materials or receipt logs are kept.
- **Integrity Warning**: Since all media files are saved locally on the user's specific web browser, **data is not shared across devices** and is **vulnerable to browser cache clearing, partition resizing, or browser resets**.

---

## 2. Current Architecture & Limitations

### 2.1 File Storage Engine (Local Attachment Preview)

The file upload interface handles images (`JPG`, `PNG`) and documents (`PDF`) by:

1. Converting the binary stream to a **Base64** or **Local Object URL** string wrapper within standard react state.
2. Persisting the state inside browser sandboxes via **Zustand `persist` middleware**, backing up to `localStorage` or `IndexedDB`.

### 2.2 Critical Storage Risks & Limits

- **No Cross-Device Sync**: If an operator at the Counter desk uploads a job card blueprint image, that file is **not available** to the workshop supervisor logging in on another container terminal unless they are accessing the exact same device and browser profile.
- **Storage Cap**: Browsers impose strict limits (typically 5 MB for `localStorage` and 10%–50% of available disk space for local `IndexedDB`). Large catalog photo attachments will quickly cause write overflow exceptions (`QuotaExceededError`).
- **Cache Expiry risk**: Automated disk cleaners, antivirus scans, browser updates, or accidental "Clear browsing history" operations will **permanently delete** all gold blueprints and ID proof images.

---

## 3. The Physical Binder Register (Failsafe)

Because client-side storage is inherently transient, the system enforces a strict **Physical File Register** protocol. Every digital order, job card, and billing record includes standard ledger fields pointing to a physical vault directory:

```
Physical File Code: [ CABINET_2 / BINDER_C / SLOT_45 ]
```

### Protocol Guidelines:

- **Blueprints**: All customer-supplied custom gold designs must be printed and slipped into the physical sleeve matching the Job Card ID.
- **Physical Signature**: The printed document copy signed by the customer must be placed in Binder A of the secure vault.
- **Digital Reference**: The ledger code MUST be inputted digitally into the system settings so that should browser storage clear, physical binders can be retrieved within under 120 seconds.

---

## 4. Multi-Tenant Cloud Storage Roadmap (Supabase Transition)

Areva Venture Studios has prepared a multi-stage migration blueprint to transition the pilot into a secure, commercial-grade, multi-tenant cloud application. This transition resolves storage limits and guarantees persistent global access.

### Step 1: Storage Bucket Provisioning (Supabase Storage)

Create standard public/private secure buckets inside Supabase:

- `catalog-images/`: Public assets for order sheets.
- `customer-proofs/`: Encrypted, private attachments accessible only via authenticated staff API tokens.
- `job-card-blueprints/`: Workshop-only access buckets.

### Step 2: Database Type Updates

Update the schema from storing long Base64 string blobs to simple secure URL links pointing to Supabase Cloud, transforming the metadata structure:

```typescript
// Legacy:
interface OrderAttachment {
  id: string;
  base64Blob: string; // Consumes ~1MB to 5MB local client state
}

// Target Cloud Schema:
interface OrderAttachment {
  id: string;
  url: string; // Consumes ~100 bytes of cloud reference URL
  expiresAt?: string; // Pre-signed CDN expiry header for privacy
}
```

### Step 3: Streamed Media Sync Flow

1. Operator drops file into the file upload container.
2. The UI invokes Supabase JavaScript Client `supabase.storage.from('blueprints').upload(...)`.
3. Storage bucket returns public unique CDN asset link (`https://xxxx.supabase.co/storage/v1/object/public/...`).
4. Link is saved directly into the database. Since files are stored on Supabase, the client only downloads the image when rendering, preserving CPU and disk resources.

### Step 4: Multi-Tenant Tenant Isolation Policies (RLS)

Apply strict Row-Level Security Rules on cloud storage objects so different clients cannot download each other's custom jewelry blueprints:

```sql
-- Enforce tenant-level isolation on storage buckets
CREATE POLICY "Tenants can only download their own blueprints"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'job-card-blueprints' AND (storage.foldername(name))[1] = auth.jwt() ->> 'tenant_id' );
```

This cloud storage roadmap secures client corporate assets and prepares MTJ ERP for commercial white-label franchising.
