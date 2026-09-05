import{t as e}from"./react-yId0ar3t.js";import{t}from"./middleware-Pd0e8Igk.js";var n={collectionTitle:{id:`collectionTitle`,label:`Collection Title`,type:`text`,content:`DIWALI 2026 COLLECTION`,defaultValue:`DIWALI 2026 COLLECTION`,editable:!0},catalogBadge:{id:`catalogBadge`,label:`Catalog Badge / Header Tag`,type:`text`,content:`EXCLUSIVE HIGH JEWELLERY`,defaultValue:`EXCLUSIVE HIGH JEWELLERY`,editable:!0},sectionTitle:{id:`sectionTitle`,label:`Section Title`,type:`text`,content:`CURATED COLLECTION SHOWCASE`,defaultValue:`CURATED COLLECTION SHOWCASE`,editable:!0},aboutCollection:{id:`aboutCollection`,label:`About Collection Description`,type:`textarea`,content:`A magnificent celebration of artisanal heritage, impeccable craftsmanship, and 916 hallmarked pure gold.`,defaultValue:`A magnificent celebration of artisanal heritage, impeccable craftsmanship, and 916 hallmarked pure gold.`,editable:!0},specialOffer:{id:`specialOffer`,label:`Special Offer / Marketing Badge`,type:`text`,content:`Special 0% Wastage on Pre-Booking • Limited Time Festive Showcase`,defaultValue:`Special 0% Wastage on Pre-Booking • Limited Time Festive Showcase`,editable:!0},footerNotice:{id:`footerNotice`,label:`Footer Notice / Hallmark Disclaimer`,type:`textarea`,content:`Certified 100% BIS Hallmarked Pure Gold • All weights approximate & subject to daily bullion market rates.`,defaultValue:`Certified 100% BIS Hallmarked Pure Gold • All weights approximate & subject to daily bullion market rates.`,editable:!0},contactText:{id:`contactText`,label:`Contact & Ordering Note`,type:`text`,content:`For bespoke orders & custom designs, visit our showroom or WhatsApp us.`,defaultValue:`For bespoke orders & custom designs, visit our showroom or WhatsApp us.`,editable:!0},terms:{id:`terms`,label:`Terms & Conditions`,type:`text`,content:`Govt. Hallmarked jewellery. Gold purity guaranteed as per Bureau of Indian Standards.`,defaultValue:`Govt. Hallmarked jewellery. Gold purity guaranteed as per Bureau of Indian Standards.`,editable:!0}},r=`
<div class="catalog-page page-luxury-gold">
  <header class="catalog-header">
    <div class="header-brand">
      {{#company.logo}}
      <img src="{{company.logo}}" class="company-logo" alt="{{company.name}}">
      {{/company.logo}}
      <div class="brand-text">
        <h1 class="company-name">{{company.name}}</h1>
        <p class="company-address">{{company.address}}</p>
      </div>
    </div>
    <div class="header-meta">
      <div class="catalog-badge">{{text.catalogBadge}}</div>
      <div class="catalog-date">{{catalog.date}}</div>
    </div>
  </header>

  <div class="gold-divider-wrap">
    \${SVG_ORNAMENTS.goldDivider}
  </div>

  {{#text.specialOffer}}
  <div class="special-offer-banner">
    <span>{{text.specialOffer}}</span>
  </div>
  {{/text.specialOffer}}

  {{#hero}}
  <section class="hero-section">
    <div class="hero-visual">
      <img src="{{hero.image}}" class="hero-image" alt="{{hero.name}}">
      <div class="hero-corner-tl">\${SVG_ORNAMENTS.goldCorner}</div>
    </div>
    <div class="hero-info">
      <span class="collection-pill">{{text.collectionTitle}}</span>
      <h2 class="hero-title">{{hero.name}}</h2>
      <div class="hero-code">{{hero.designNumber}}</div>
      <p class="hero-desc">{{hero.description}}</p>
      <div class="specs-grid">
        <div class="spec-cell">
          <span class="spec-lbl">Purity</span>
          <span class="spec-val font-gold">{{hero.purity}}</span>
        </div>
        <div class="spec-cell">
          <span class="spec-lbl">Gross Wt</span>
          <span class="spec-val">{{hero.grossWeight}}g</span>
        </div>
        <div class="spec-cell">
          <span class="spec-lbl">Net Gold</span>
          <span class="spec-val font-gold">{{hero.netWeight}}g</span>
        </div>
        {{#hero.price}}
        <div class="spec-cell">
          <span class="spec-lbl">Estimate</span>
          <span class="spec-val font-gold">&#8377; {{hero.price}}</span>
        </div>
        {{/hero.price}}
      </div>
    </div>
  </section>
  {{/hero}}

  <section class="products-section">
    <h3 class="section-title"><span>{{text.sectionTitle}}</span></h3>
    <div class="products-grid">
      {{#products}}
      <article class="product-card">
        <div class="card-img-wrap">
          <img src="{{image}}" class="product-img" alt="{{name}}">
          <span class="card-purity">{{purity}}</span>
        </div>
        <div class="card-body">
          <h4 class="card-title">{{name}}</h4>
          <div class="card-code">{{designNumber}}</div>
          <div class="card-weights">
            <span>GW: <strong>{{grossWeight}}g</strong></span>
            <span>NW: <strong class="font-gold">{{netWeight}}g</strong></span>
          </div>
          {{#price}}
          <div class="card-price">&#8377; {{price}}</div>
          {{/price}}
        </div>
      </article>
      {{/products}}
    </div>
  </section>

  <footer class="catalog-footer">
    <div class="footer-left">
      <span>{{company.phone}}</span>
      <span>{{company.website}}</span>
      <span>{{company.gstin}}</span>
      {{#text.contactText}}
      <span class="footer-contact-note">{{text.contactText}}</span>
      {{/text.contactText}}
    </div>
    <div class="footer-center">
      <span class="hallmark-note">{{text.footerNotice}}</span>
    </div>
    <div class="footer-right">
      <span class="page-count">Page {{page.number}} of {{page.total}}</span>
    </div>
  </footer>
</div>
`,i=`
.page-luxury-gold {
  --gold-pri: #b88a24;
  --gold-accent: #d4af37;
  --bg-dark: #121212;
  --bg-card: #1c1c1e;
  --text-main: #f5f5f7;
  --text-muted: #a1a1aa;
  
  width: 210mm;
  min-height: 297mm;
  background: var(--bg-dark);
  color: var(--text-main);
  font-family: 'Playfair Display', Georgia, serif;
  box-sizing: border-box;
  padding: 12mm 14mm 10mm;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.page-luxury-gold .font-gold { color: var(--gold-accent); }
.page-luxury-gold .catalog-header { display: flex; justify-content: space-between; align-items: center; }
.page-luxury-gold .header-brand { display: flex; align-items: center; gap: 10px; }
.page-luxury-gold .company-logo { height: 38px; width: auto; object-fit: contain; }
.page-luxury-gold .company-name { font-size: 16pt; font-weight: 700; margin: 0; color: var(--gold-accent); letter-spacing: 0.5px; }
.page-luxury-gold .company-address { font-size: 7.5pt; font-family: sans-serif; color: var(--text-muted); margin: 2px 0 0; }
.page-luxury-gold .catalog-badge { font-size: 7pt; font-family: sans-serif; background: rgba(212,175,55,0.15); border: 1px solid var(--gold-accent); color: var(--gold-accent); padding: 3px 8px; border-radius: 3px; font-weight: 600; text-align: right; }
.page-luxury-gold .catalog-date { font-size: 7pt; font-family: sans-serif; color: var(--text-muted); text-align: right; margin-top: 2px; }

.page-luxury-gold .gold-divider-wrap { margin: 6px 0; text-align: center; }
.page-luxury-gold .ornament-divider { height: 12px; width: 60%; }
.page-luxury-gold .special-offer-banner { background: rgba(212,175,55,0.12); border: 1px dashed var(--gold-accent); color: var(--gold-accent); font-size: 7.5pt; font-family: sans-serif; padding: 4px 10px; border-radius: 3px; text-align: center; font-weight: 600; margin-bottom: 8px; }

.page-luxury-gold .hero-section { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 14px; background: var(--bg-card); border: 1px solid rgba(212,175,55,0.25); border-radius: 6px; padding: 12px; margin-bottom: 12px; }
.page-luxury-gold .hero-visual { position: relative; aspect-ratio: 4/3; background: #000; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.page-luxury-gold .hero-image { width: 100%; height: 100%; object-fit: contain; }
.page-luxury-gold .hero-corner-tl { position: absolute; top: 4px; left: 4px; width: 24px; height: 24px; }
.page-luxury-gold .collection-pill { font-size: 7pt; font-family: sans-serif; text-transform: uppercase; background: var(--gold-pri); color: #000; padding: 2px 6px; border-radius: 2px; font-weight: 700; }
.page-luxury-gold .hero-title { font-size: 14pt; font-weight: bold; margin: 6px 0 2px; color: #fff; }
.page-luxury-gold .hero-code { font-family: monospace; font-size: 8pt; color: var(--gold-accent); }
.page-luxury-gold .hero-desc { font-size: 8pt; font-family: sans-serif; color: var(--text-muted); margin: 6px 0 10px; line-height: 1.3; }
.page-luxury-gold .specs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.page-luxury-gold .spec-cell { background: rgba(255,255,255,0.03); border-left: 2px solid var(--gold-accent); padding: 4px 6px; font-family: sans-serif; }
.page-luxury-gold .spec-lbl { font-size: 6.5pt; text-transform: uppercase; color: var(--text-muted); display: block; }
.page-luxury-gold .spec-val { font-size: 9pt; font-weight: 600; }

.page-luxury-gold .section-title { font-size: 10pt; text-align: center; text-transform: uppercase; letter-spacing: 1px; color: var(--gold-accent); margin: 0 0 8px; }
.page-luxury-gold .products-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; flex: 1; }
.page-luxury-gold .product-card { background: var(--bg-card); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; }
.page-luxury-gold .card-img-wrap { position: relative; aspect-ratio: 1/1; background: #000; padding: 4px; display: flex; align-items: center; justify-content: center; }
.page-luxury-gold .product-img { width: 100%; height: 100%; object-fit: contain; }
.page-luxury-gold .card-purity { position: absolute; top: 3px; right: 3px; font-size: 6pt; font-family: monospace; background: rgba(0,0,0,0.8); color: var(--gold-accent); border: 1px solid var(--gold-accent); padding: 1px 3px; border-radius: 2px; }
.page-luxury-gold .card-body { padding: 6px; font-family: sans-serif; flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
.page-luxury-gold .card-title { font-size: 7.5pt; font-weight: 600; margin: 0; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.page-luxury-gold .card-code { font-size: 6.5pt; font-family: monospace; color: var(--gold-accent); }
.page-luxury-gold .card-weights { font-size: 6.5pt; color: var(--text-muted); display: flex; justify-content: space-between; margin-top: 3px; }
.page-luxury-gold .card-price { font-size: 7.5pt; font-weight: bold; color: var(--gold-accent); margin-top: 2px; }

.page-luxury-gold .catalog-footer { border-top: 1px solid rgba(212,175,55,0.3); padding-top: 6px; margin-top: 8px; display: flex; justify-content: space-between; font-size: 7pt; font-family: sans-serif; color: var(--text-muted); }
.page-luxury-gold .footer-left { display: flex; gap: 10px; }
.page-luxury-gold .hallmark-note { color: var(--gold-accent); font-weight: 500; }
`,a=`
<div class="catalog-page page-premium-ivory">
  <header class="catalog-header">
    <div class="header-inner">
      <h1 class="firm-title">{{company.name}}</h1>
      <p class="firm-subtitle">{{text.catalogBadge}} • {{text.collectionTitle}}</p>
    </div>
  </header>

  <div class="ivory-divider"></div>

  {{#text.specialOffer}}
  <div class="ivory-offer-banner">
    <span>{{text.specialOffer}}</span>
  </div>
  {{/text.specialOffer}}

  <main class="ivory-grid">
    {{#products}}
    <article class="ivory-card">
      <div class="ivory-img-frame">
        <img src="{{image}}" class="ivory-img" alt="{{name}}">
        <span class="ivory-tag">{{purity}}</span>
      </div>
      <div class="ivory-details">
        <div class="ivory-name">{{name}}</div>
        <div class="ivory-code">{{designNumber}} • {{category}}</div>
        <div class="ivory-specs">
          <div>GW: <strong>{{grossWeight}}g</strong></div>
          <div>NW: <strong>{{netWeight}}g</strong></div>
        </div>
      </div>
    </article>
    {{/products}}
  </main>

  <footer class="ivory-footer">
    <div class="footer-contacts">{{company.phone}} | {{company.address}} | {{company.website}}</div>
    <div class="footer-note">{{text.footerNotice}}</div>
    <div class="footer-page">Page {{page.number}} / {{page.total}}</div>
  </footer>
</div>
`,o=`
.page-premium-ivory {
  width: 210mm;
  min-height: 297mm;
  background: #fcfbf7;
  color: #2b261f;
  font-family: 'Cinzel', Georgia, serif;
  box-sizing: border-box;
  padding: 14mm 16mm 10mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.page-premium-ivory .catalog-header { text-align: center; }
.page-premium-ivory .firm-title { font-size: 18pt; font-weight: 700; margin: 0; color: #8b6b23; letter-spacing: 2px; }
.page-premium-ivory .firm-subtitle { font-size: 7.5pt; font-family: sans-serif; letter-spacing: 3px; color: #8c8273; margin: 4px 0 0; }
.page-premium-ivory .ivory-divider { height: 1px; background: linear-gradient(90deg, transparent, #8b6b23, transparent); margin: 10px 0 14px; }
.page-premium-ivory .ivory-offer-banner { background: rgba(139,107,35,0.08); border: 1px solid #8b6b23; color: #8b6b23; font-size: 7.5pt; font-family: sans-serif; padding: 4px 10px; border-radius: 2px; text-align: center; font-weight: 600; margin-bottom: 10px; }
.page-premium-ivory .ivory-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; flex: 1; }
.page-premium-ivory .ivory-card { background: #ffffff; border: 1px solid #e8e2d5; border-radius: 2px; padding: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.03); display: flex; flex-direction: column; }
.page-premium-ivory .ivory-img-frame { position: relative; aspect-ratio: 1/1; background: #faf8f5; display: flex; align-items: center; justify-content: center; padding: 4px; }
.page-premium-ivory .ivory-img { width: 100%; height: 100%; object-fit: contain; }
.page-premium-ivory .ivory-tag { position: absolute; top: 4px; right: 4px; font-size: 6.5pt; font-family: sans-serif; background: #8b6b23; color: #fff; padding: 1px 4px; }
.page-premium-ivory .ivory-details { padding: 6px 0 0; font-family: sans-serif; }
.page-premium-ivory .ivory-name { font-size: 8.5pt; font-weight: 700; font-family: serif; color: #2b261f; margin-top: 4px; }
.page-premium-ivory .ivory-code { font-size: 7pt; color: #8b6b23; font-family: monospace; }
.page-premium-ivory .ivory-specs { display: flex; justify-content: space-between; font-size: 7pt; color: #665f55; margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e8e2d5; }
.page-premium-ivory .ivory-footer { border-top: 1px solid #e8e2d5; padding-top: 6px; display: flex; justify-content: space-between; font-size: 7pt; font-family: sans-serif; color: #8c8273; }
`,s=`
<div class="catalog-page page-minimal-editorial">
  <header class="editorial-header">
    <div class="editorial-brand">{{company.name}}</div>
    <div class="editorial-sub">{{text.collectionTitle}} — {{catalog.date}}</div>
  </header>

  {{#text.specialOffer}}
  <div class="editorial-offer">
    <span>{{text.specialOffer}}</span>
  </div>
  {{/text.specialOffer}}

  <div class="editorial-grid">
    {{#products}}
    <div class="editorial-item">
      <div class="editorial-img-box">
        <img src="{{image}}" class="editorial-img" alt="{{name}}">
      </div>
      <div class="editorial-meta">
        <span class="num">{{designNumber}}</span>
        <span class="title">{{name}}</span>
        <span class="wt">{{netWeight}}g • {{purity}}</span>
      </div>
    </div>
    {{/products}}
  </div>

  <footer class="editorial-footer">
    <span>{{company.phone}} • {{company.website}} • {{text.footerNotice}}</span>
    <span>{{page.number}} / {{page.total}}</span>
  </footer>
</div>
`,c=`
.page-minimal-editorial {
  width: 210mm;
  min-height: 297mm;
  background: #ffffff;
  color: #111111;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
  padding: 12mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.page-minimal-editorial .editorial-header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 12px; }
.page-minimal-editorial .editorial-brand { font-size: 14pt; font-weight: 800; letter-spacing: -0.5px; }
.page-minimal-editorial .editorial-sub { font-size: 8pt; color: #666; }
.page-minimal-editorial .editorial-offer { border-left: 3px solid #b88a24; padding-left: 8px; font-size: 7.5pt; font-weight: 600; color: #b88a24; margin-bottom: 8px; }
.page-minimal-editorial .editorial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10mm 6mm; flex: 1; }
.page-minimal-editorial .editorial-item { display: flex; flex-direction: column; }
.page-minimal-editorial .editorial-img-box { aspect-ratio: 1/1; background: #f8f8f8; display: flex; align-items: center; justify-content: center; padding: 6px; border: 1px solid #eee; }
.page-minimal-editorial .editorial-img { width: 100%; height: 100%; object-fit: contain; }
.page-minimal-editorial .editorial-meta { margin-top: 4px; display: flex; flex-direction: column; font-size: 7.5pt; }
.page-minimal-editorial .editorial-meta .num { font-family: monospace; font-weight: bold; color: #b88a24; }
.page-minimal-editorial .editorial-meta .title { font-weight: 600; color: #111; margin: 1px 0; }
.page-minimal-editorial .editorial-meta .wt { color: #666; font-size: 7pt; }
.page-minimal-editorial .editorial-footer { border-top: 1px solid #eee; padding-top: 6px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #888; }
`,l=Date.now(),u=[{id:`mtj-luxury-gold`,name:`MTJ Luxury Gold (Hero & Brochure)`,version:`1.0`,description:`Brochure-style layout with large hero spotlight, 4-grid supporting collection, gold borders & ornaments.`,pageSize:`A4`,orientation:`portrait`,productsPerPage:5,supportsHero:!0,supportsMultipleProducts:!0,fields:[`logo`,`companyName`,`address`,`phone`,`website`,`gstin`,`heroImage`,`heroName`,`heroCode`,`heroGrossWeight`,`heroNetWeight`,`heroPurity`,`productImage`,`productName`,`designNumber`,`grossWeight`,`netWeight`,`purity`,`price`],html:r,css:i,createdAt:l,updatedAt:l,isBuiltIn:!0,isActive:!0},{id:`mtj-premium-ivory`,name:`MTJ Premium Ivory (6-Product Editorial)`,version:`1.0`,description:`Warm ivory jewellery collection spread with gold typography and clean 6-item showcase.`,pageSize:`A4`,orientation:`portrait`,productsPerPage:6,supportsHero:!1,supportsMultipleProducts:!0,fields:[`companyName`,`address`,`phone`,`website`,`productImage`,`productName`,`designNumber`,`category`,`grossWeight`,`netWeight`,`purity`],html:a,css:o,createdAt:l,updatedAt:l,isBuiltIn:!0,isActive:!0},{id:`mtj-minimal-editorial`,name:`MTJ Minimalist Editorial`,version:`1.0`,description:`Modern, high-contrast monochrome design with gold badges for clean wholesale showcases.`,pageSize:`A4`,orientation:`portrait`,productsPerPage:6,supportsHero:!1,supportsMultipleProducts:!0,fields:[`companyName`,`phone`,`website`,`productImage`,`productName`,`designNumber`,`grossWeight`,`netWeight`,`purity`],html:s,css:c,createdAt:l,updatedAt:l,isBuiltIn:!0,isActive:!0}],d=e()(t((e,t)=>({templates:u,defaultTemplateId:`mtj-luxury-gold`,textBlocks:n,setDefaultTemplate:t=>{e({defaultTemplateId:t})},updateTextBlock:(n,r)=>{let i=t().textBlocks[n]||{id:n,label:n,type:`text`,content:r,defaultValue:r,editable:!0};e({textBlocks:{...t().textBlocks,[n]:{...i,content:r}}})},resetTextBlocks:()=>{e({textBlocks:n})},importTemplate:n=>{if(!n.name?.trim())return{ok:!1,error:`Template name is required.`};if(!n.html?.trim())return{ok:!1,error:`Template HTML is required.`};if(!n.css?.trim())return{ok:!1,error:`Template CSS is required.`};let r=`custom-tpl-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,i=Date.now(),a={id:r,name:n.name.trim(),version:`1.0`,description:n.description||`Imported custom catalogue layout`,pageSize:n.pageSize||`A4`,orientation:n.orientation||`portrait`,productsPerPage:n.productsPerPage||6,supportsHero:n.supportsHero??!0,supportsMultipleProducts:!0,fields:[`companyName`,`productImage`,`productName`,`designNumber`,`grossWeight`,`netWeight`,`purity`],html:n.html,css:n.css,createdAt:i,updatedAt:i,isBuiltIn:!1,isActive:!0};return e({templates:[a,...t().templates]}),{ok:!0,template:a}},toggleTemplateActive:n=>{e({templates:t().templates.map(e=>e.id===n?{...e,isActive:!e.isActive,updatedAt:Date.now()}:e)})},duplicateTemplate:n=>{let r=t().templates.find(e=>e.id===n);if(!r)return null;let i=Date.now(),a={...r,id:`tpl-copy-${i}`,name:`${r.name} (Copy)`,isBuiltIn:!1,createdAt:i,updatedAt:i};return e({templates:[a,...t().templates]}),a},deleteTemplate:n=>{let r=t().templates.find(e=>e.id===n);return!r||r.isBuiltIn?!1:(e({templates:t().templates.filter(e=>e.id!==n)}),!0)},resetToBuiltInTemplates:()=>{e({templates:u,defaultTemplateId:`mtj-luxury-gold`,textBlocks:n})}}),{name:`mtj-designer-catalog-store-v1`}));export{n,d as t};