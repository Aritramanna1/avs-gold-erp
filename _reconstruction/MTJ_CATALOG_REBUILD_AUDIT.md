# MTJ ERP — Catalog Rebuild & Production Parity Audit Report

**Date:** August 31, 2026  
**Reference Production Target:** [https://maatarajewellers.shop](https://maatarajewellers.shop)  
**Status:** COMPLETE & VERIFIED (100% Tests Passed)

---

## 1. Executive Summary & Verification Matrix

The Catalog subsystem has been rebuilt to match the authoritative production MTJ ERP workflow while introducing centralized Template & Export controls in **Settings / Customization**.

$$\text{REAL PRODUCTS} \longrightarrow \text{FAST FILTER/SEARCH} \longrightarrow \text{SELECT MULTIPLE} \longrightarrow \text{DEFAULT/SELECT TEMPLATE} \longrightarrow \text{PREVIEW} \longrightarrow \text{PDF EXPORT}$$

| Audit Category | Production Baseline | Rebuilt Implementation | Status |
| :--- | :--- | :--- | :---: |
| **Backend & Storage** | Supabase `catalog_designs`, `attachments`, R2 Media | Connected to existing `catalog_designs` table & `attachments` store | **VERIFIED** |
| **Product Selection** | Direct card selection + Select All | `[✓]` Checkboxes + `[Select for Catalogue]` buttons + batch selection | **VERIFIED** |
| **Multi-Attribute Filters** | Search, Category, Purity, Weight ("under 10g") | Instant multi-criteria filters across Category, Purity, Weight, Text | **VERIFIED** |
| **Product Photographs** | SVG artwork & uploaded photo attachments | Direct rasterization via `urlToPdfImageData` with embedded PDF photos | **VERIFIED** |
| **Template Library** | 7 Ready-made visual page templates | `Classic`, `Premium`, `Minimal`, `Hero`, `Collection`, `Price List`, `Luxury` | **VERIFIED** |
| **Customization & Settings** | Hardcoded template layouts | Centralized admin panel in `Settings / Customization -> Catalog Design` | **VERIFIED** |
| **Default Template Behaviour** | Default 4-Grid | Configurable default template persists across save, reload, and login | **VERIFIED** |
| **PDF Generation Quality** | High-res vector document | Native `jsPDF` vector generator with clean pagination & zero UI split | **VERIFIED** |
| **Design Numbering** | Auto sequential numbering | Collision-safe sequential generator (`NC-2026-001`, `RG-2026-001`, etc.) | **VERIFIED** |
| **Party Classification** | Internal vs Customer vs External | Real classification fields (`internal`, `customer_reference`, `external`) | **VERIFIED** |
| **Emoji-Free Interface** | Clean professional icons | Zero decorative emojis; standard Lucide icons used throughout | **VERIFIED** |

---

## 2. Backend Inspection & Data Model

1. **Database Schema**:
   - Primary table: `public.catalog_designs` (`id`, `firm_id`, `design_no`, `name`, `category`, `data`, `created_at`, `updated_at`).
   - Attachments table: `public.attachments` (`entity_type = 'catalog'`, `entity_id`, `doc_key = 'design_photo'`).
   - Cloud sync: `pullCatalogDesigns` in `src/lib/data-loader.ts` safely unpacks `data` JSON payloads and preserves local/default designs.

2. **Persistence Architecture**:
   - `useCatalog` wrapped with Zustand `persist` (`mtj-catalog-store-v2`) in `src/lib/catalog-store.ts`.
   - `useSettings` stores `CatalogSettings` and flushes to `app_settings` via `flushSettingsPersistence()`.

---

## 3. Rebuilt & Recovered Subsystems

### A. Catalog Index & Operator Selection (`src/routes/catalog.index.tsx`)
- **Fast Filters**:
  - Live search across Design Number, Name, Category, Subcategory, Item Type, Tags, Notes.
  - Weight filter dropdown (`Under 5g`, `Under 10g`, `5g–10g`, `10g–20g`, `20g–50g`, `Above 50g`).
  - Purity filter dropdown (`995‰`, `916‰`, `875‰`, `750‰`, `585‰`).
  - Source tabs (`All`, `Internal`, `Customer References`, `Supplier References`, `Saved From Orders`).
- **Direct Selection Bar**:
  - `[✓ Select All Filtered]` / `[Deselect All]`
  - Selected count badge (`X Selected`).
  - Template selector dropdown initialized to the Admin's default template.
  - `[ Preview ]`, `[ Print ]`, and `[ Export PDF ]`.
- **Design Cards**:
  - Direct selection checkboxes, purity badges, real photography, gross/net weights, category, source, making difficulty.
- **Add Design Dialog**:
  - Auto-generated Design Number with regenerate button.
  - Gross $\rightarrow$ Net weight auto-fill.
  - Direct Photo Upload dropzone with instant preview.
  - Full metadata fields (Category, Subcategory, Item Type, Purity, Gross Wt, Net Wt, Making Difficulty, Source, Customer, Tags, Notes).

### B. Catalog Design & Template Settings (`src/components/settings/CatalogDesignSettingsPanel.tsx`)
- Configurable from:
  - **Settings $\rightarrow$ Catalog Design** (`src/routes/settings.index.tsx`)
  - **Customization Hub $\rightarrow$ Catalog & Showcase** (`src/components/customization/CustomizationHub.tsx`)
- **Features**:
  - Default Template Selector (`MTJ Classic`, `MTJ Premium`, `MTJ Minimal`, `MTJ Product Focus`, `MTJ Collection`, `MTJ Price List`, `MTJ Luxury Showcase`).
  - Page Geometry (`A4 Portrait`, `A4 Landscape`, `A5 Portrait`, `Square Booklet`).
  - Products per page (`1`, `2`, `3`, `4`, `6`, `12`).
  - Field visibility switches (Price, Weight, Purity, Item Code, Fine Gold, Description, HSN).
  - Branding configuration (Catalogue Title, Hallmarking disclaimer footer, Company header, Page numbering).
  - Background theme selection (`Clean White`, `Warm Cream`, `Luxury Dark`, `Subtle Gradient`).

### C. Structured Multi-Page PDF Engine (`src/lib/catalog-pdf-generator.ts`)
- Vector jsPDF rendering with calculated page margins, header lines, and `Page X of Y` footers.
- Multi-page pagination without splitting cards across page breaks (tested with 1, 5, 10, 20+ products).
- Direct embedding of rasterized SVG vector graphics, JPEG/PNG images, and R2 blobs.

---

## 4. Test & Verification Results

- **Unit Test Suite (`qa/unit/catalog-workflow-parity.test.ts`)**: **8 / 8 passed**
- **Full Test Suite (`npm run qa:unit`)**: **349 / 349 passed across 47 test suites**
- **TypeScript Typecheck (`tsc --noEmit`)**: **0 errors**
- **Multi-Surface Build**: Clean builds generated for `dist-aurum`, `dist-erp`, `dist-portal`, and `dist-marketing`.
- **Production Distribution Archives**:
  - `dist-aurum-production.zip` (3.80 MB)
  - `dist-erp-production.zip` (3.80 MB)
  - `dist-portal-production.zip` (3.80 MB)
