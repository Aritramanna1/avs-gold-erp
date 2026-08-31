# MTJ ERP — Design Catalog Template Variables & Creation Specification

This document provides the standard reference for creating custom HTML/CSS/SVG templates for the MTJ ERP **Design Catalog Engine**.

Any template conforming to this specification can be imported directly via:  
**Settings $\rightarrow$ Customization $\rightarrow$ Catalog Design $\rightarrow$ Import HTML Template**.

---

## 1. Template Package Structure

A complete template package consists of:

```
template.json        # Template manifest metadata
index.html           # Semantic HTML with mustache-style data bindings
styles.css           # Print & screen stylesheet
assets/              # Reusable SVG vector ornaments & frames (optional)
```

### Manifest Schema (`template.json`)
```json
{
  "id": "mtj-luxury-gold",
  "name": "MTJ Luxury Gold (Hero & Brochure)",
  "version": "1.0",
  "description": "Brochure layout with large hero spotlight, 4-grid supporting collection, gold borders & ornaments.",
  "pageSize": "A4",
  "orientation": "portrait",
  "productsPerPage": 5,
  "supportsHero": true,
  "supportsMultipleProducts": true,
  "fields": [
    "logo",
    "companyName",
    "address",
    "phone",
    "website",
    "gstin",
    "heroImage",
    "heroName",
    "heroCode",
    "heroGrossWeight",
    "heroNetWeight",
    "heroPurity",
    "productImage",
    "productName",
    "designNumber",
    "grossWeight",
    "netWeight",
    "purity",
    "price"
  ]
}
```

---

## 2. Supported Template Data Bindings

### A. Company & Firm Information (`company.*`)
| Variable | Description | Example Output |
| :--- | :--- | :--- |
| `{{company.name}}` | Trade/Firm Name | `Maa Tara Jewellers` |
| `{{company.logo}}` | Firm Logo URL / Base64 | `data:image/png;base64,...` |
| `{{company.address}}` | Branch / Shop Address | `12/A Gold Plaza, Bowbazar, Kolkata` |
| `{{company.phone}}` | Contact Phone Number | `+91 98765 43210` |
| `{{company.website}}` | Website URL | `www.maatarajewellers.com` |
| `{{company.gstin}}` | GSTIN with Prefix | `GSTIN: 19ABCDE1234F1Z5` |
| `{{company.social}}` | Social Media Handle | `@maatarajewellers` |
| `{{company.qr}}` | Digital Verification / Catalog QR | `data:image/png;base64,...` |

*Conditional logo block:*
```html
{{#company.logo}}
  <img src="{{company.logo}}" class="company-logo" alt="{{company.name}}">
{{/company.logo}}
```

---

### B. Hero Spotlight Product (`hero.*`)
When a user designates one product as the **Hero Product**, its full high-resolution details are bound to `hero.*`.

| Variable | Description | Example Output |
| :--- | :--- | :--- |
| `{{hero.name}}` | Product Title | `Royal Antique Choker Necklace` |
| `{{hero.designNumber}}`| Unique Design Code | `NC-2026-001` |
| `{{hero.category}}` | Category Name | `Necklace` |
| `{{hero.image}}` | High-Resolution Image URL / Base64 | `data:image/jpeg;base64,...` |
| `{{hero.grossWeight}}` | Gross Weight in Grams | `48.500` |
| `{{hero.netWeight}}` | Net Weight in Grams | `46.200` |
| `{{hero.purity}}` | Gold Purity Grade | `916‰ (22K)` |
| `{{hero.description}}` | Detailed description / craft notes | `Handcrafted bridal choker with kundan stones` |
| `{{hero.price}}` | Optional Estimated Price | `3,45,000` |

*Conditional hero section block:*
```html
{{#hero}}
<section class="hero-section">
  <img src="{{hero.image}}" class="hero-image" alt="{{hero.name}}">
  <div class="hero-details">
    <span class="collection-tag">{{collection.name}}</span>
    <h2>{{hero.name}}</h2>
    <p>{{hero.designNumber}} • {{hero.purity}} • {{hero.netWeight}}g</p>
    {{#hero.price}}
      <div class="price">&#8377; {{hero.price}}</div>
    {{/hero.price}}
  </div>
</section>
{{/hero}}
```

---

### C. Supporting Collection Products (`{{#products}}...{{/products}}`)
The loop `{{#products}}` iterates over all selected products (or supporting products on page 1).

| Variable | Description | Example Output |
| :--- | :--- | :--- |
| `{{id}}` | Unique Record UUID | `d_1788189000_abc` |
| `{{name}}` | Product Name | `Floral Filigree Ring` |
| `{{designNumber}}` | Design / Tag Number | `RG-2026-042` |
| `{{category}}` | Category | `Ring` |
| `{{image}}` | Product Photograph URL | `data:image/jpeg;base64,...` |
| `{{grossWeight}}` | Gross Weight in Grams | `6.250` |
| `{{netWeight}}` | Net Gold Weight in Grams | `6.200` |
| `{{purity}}` | Purity | `916‰ (22K)` |
| `{{description}}` | Notes or Tags | `Rose gold accent, handcrafted` |
| `{{price}}` | Optional price / estimate | `46,500` |

*Loop block example:*
```html
<section class="products-grid">
  {{#products}}
  <article class="product-card">
    <img src="{{image}}" class="product-image" alt="{{name}}">
    <h4>{{name}}</h4>
    <div class="meta">
      <span>{{designNumber}}</span>
      <span>{{netWeight}}g</span>
      <span>{{purity}}</span>
    </div>
    {{#price}}
      <div class="price">&#8377; {{price}}</div>
    {{/price}}
  </article>
  {{/products}}
</section>
```

---

### D. Catalogue & Pagination Metadata
| Variable | Description | Example Output |
| :--- | :--- | :--- |
| `{{collection.name}}` | Collection Title | `BRIDAL COUTURE 2026` |
| `{{catalog.title}}` | Catalogue Document Title | `EXQUISITE JEWELLERY CATALOGUE` |
| `{{catalog.date}}` | Date of Catalogue Issue | `31 Aug 2026` |
| `{{page.number}}` | Current Page Index (1-indexed) | `1` |
| `{{page.total}}` | Total Calculated Document Pages | `4` |

---

## 3. Recommended CSS Print Guidelines

To ensure pixel-perfect export to vector PDF:
- Use standard document page box dimensions:
  - **A4 Portrait**: `width: 210mm; min-height: 297mm; box-sizing: border-box;`
  - **A4 Landscape**: `width: 297mm; min-height: 210mm; box-sizing: border-box;`
  - **A5 Portrait**: `width: 148mm; min-height: 210mm; box-sizing: border-box;`
- Avoid `overflow: hidden` on root containers that could clip text.
- Use `aspect-ratio: 1 / 1` and `object-fit: contain` for jewellery photography frames.
- Use vector SVG ornaments (e.g. gold corners, filigree lines, hallmark badges) for high-definition print sharpness.
