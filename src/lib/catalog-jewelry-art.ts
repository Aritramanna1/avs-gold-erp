/**
 * Authentic Luxury Jewellery SVG Vector Assets for MTJ ERP Catalog & Design Library.
 * Embeddable Data-URLs with rich gold gradients, gemstones, and hallmarking accents.
 */

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const JEWELLERY_SVG_ASSETS = {
  antique_choker_necklace: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <defs>
        <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFF3B0"/>
          <stop offset="50%" stop-color="#D4AF37"/>
          <stop offset="85%" stop-color="#996515"/>
          <stop offset="100%" stop-color="#4A3508"/>
        </radialGradient>
        <linearGradient id="goldLinear" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFEAA7"/>
          <stop offset="30%" stop-color="#D4AF37"/>
          <stop offset="70%" stop-color="#AA771C"/>
          <stop offset="100%" stop-color="#5B3A05"/>
        </linearGradient>
        <radialGradient id="rubyGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#FF7675"/>
          <stop offset="40%" stop-color="#D63031"/>
          <stop offset="100%" stop-color="#74121D"/>
        </radialGradient>
        <radialGradient id="emeraldGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#55EFC4"/>
          <stop offset="40%" stop-color="#00B894"/>
          <stop offset="100%" stop-color="#004D40"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="#0C0A09" rx="16"/>
      <circle cx="200" cy="200" r="180" fill="none" stroke="url(#goldLinear)" stroke-width="1" stroke-dasharray="4 6" opacity="0.4"/>
      <!-- Main Collar Arch -->
      <path d="M 100 140 Q 200 240 300 140 Q 200 290 100 140 Z" fill="url(#goldLinear)" stroke="#FEEAA7" stroke-width="2"/>
      <!-- Inner filigree layer -->
      <path d="M 120 155 Q 200 230 280 155" fill="none" stroke="#FFF" stroke-width="1.5" stroke-dasharray="3 4" opacity="0.7"/>
      <!-- Central Royal Pendant -->
      <g transform="translate(200, 240)">
        <polygon points="0,-10 24,20 0,55 -24,20" fill="url(#goldGlow)" stroke="#FFEAA7" stroke-width="1.5"/>
        <circle cx="0" cy="22" r="12" fill="url(#rubyGrad)" stroke="#FFF" stroke-width="1"/>
        <circle cx="0" cy="65" r="7" fill="url(#emeraldGrad)" stroke="#FFF" stroke-width="1"/>
      </g>
      <!-- Surrounding Danglers -->
      <circle cx="160" cy="225" r="8" fill="url(#goldGlow)" stroke="#FFF" stroke-width="0.8"/>
      <circle cx="160" cy="225" r="4" fill="url(#emeraldGrad)"/>
      <circle cx="240" cy="225" r="8" fill="url(#goldGlow)" stroke="#FFF" stroke-width="0.8"/>
      <circle cx="240" cy="225" r="4" fill="url(#emeraldGrad)"/>
      <!-- Hanging Pearl Drops -->
      <g fill="#FFFDE7" opacity="0.95">
        <circle cx="130" cy="200" r="5"/>
        <circle cx="160" cy="245" r="5"/>
        <circle cx="200" cy="325" r="6"/>
        <circle cx="240" cy="245" r="5"/>
        <circle cx="270" cy="200" r="5"/>
      </g>
      <text x="200" y="375" text-anchor="middle" fill="#D4AF37" font-family="serif" font-size="12" letter-spacing="3">22K 916 • BRIDAL HERITAGE</text>
    </svg>
  `),

  solitaire_diamond_ring: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <defs>
        <linearGradient id="bandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="30%" stop-color="#E0E0E0"/>
          <stop offset="70%" stop-color="#9E9E9E"/>
          <stop offset="100%" stop-color="#616161"/>
        </linearGradient>
        <linearGradient id="diamondSpark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="30%" stop-color="#DFF9FB"/>
          <stop offset="70%" stop-color="#7ED6DF"/>
          <stop offset="100%" stop-color="#22A6B3"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="#0F172A" rx="16"/>
      <!-- Ring Band -->
      <ellipse cx="200" cy="240" rx="90" ry="70" fill="none" stroke="url(#bandGrad)" stroke-width="18"/>
      <ellipse cx="200" cy="240" rx="90" ry="70" fill="none" stroke="#FFF" stroke-width="2" opacity="0.6"/>
      <!-- Prong Setting -->
      <path d="M 180 180 L 192 120 L 208 120 L 220 180 Z" fill="url(#bandGrad)" stroke="#FFFFFF" stroke-width="1"/>
      <!-- Solitaire Brilliant Cut Diamond -->
      <g transform="translate(200, 115)">
        <polygon points="0,-40 38,-15 28,25 -28,25 -38,-15" fill="url(#diamondSpark)" stroke="#FFFFFF" stroke-width="1.5"/>
        <polygon points="0,-40 18,-15 -18,-15" fill="#FFFFFF" opacity="0.8"/>
        <polygon points="0,-40 38,-15 18,-15" fill="#C7ECEE" opacity="0.7"/>
        <polygon points="0,-40 -38,-15 -18,-15" fill="#95AFC0" opacity="0.7"/>
        <polygon points="0,25 28,25 18,-15 0,-15" fill="#7ED6DF" opacity="0.9"/>
        <polygon points="0,25 -28,25 -18,-15 0,-15" fill="#22A6B3" opacity="0.9"/>
        <!-- Diamond Sparkle Stars -->
        <circle cx="-15" cy="-25" r="2" fill="#FFF"/>
        <path d="M -15 -35 L -15 -15 M -25 -25 L -5 -25" stroke="#FFF" stroke-width="1" opacity="0.8"/>
      </g>
      <text x="200" y="375" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-weight="600" font-size="11" letter-spacing="3">18K 750 • 1.25 CT VVS1 SOLITAIRE</text>
    </svg>
  `),

  traditional_kadda_bangle: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <defs>
        <linearGradient id="goldBangle" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FFF3B0"/>
          <stop offset="25%" stop-color="#D4AF37"/>
          <stop offset="50%" stop-color="#F5CD79"/>
          <stop offset="75%" stop-color="#AA771C"/>
          <stop offset="100%" stop-color="#5B3A05"/>
        </linearGradient>
        <radialGradient id="rubyGem" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#FF7675"/>
          <stop offset="60%" stop-color="#D63031"/>
          <stop offset="100%" stop-color="#570000"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="#18181B" rx="16"/>
      <!-- Outer Bangle Ring -->
      <circle cx="200" cy="190" r="110" fill="none" stroke="url(#goldBangle)" stroke-width="26"/>
      <!-- Inner Filigree & Rava Bead detailing -->
      <circle cx="200" cy="190" r="122" fill="none" stroke="#FFF" stroke-width="1.5" stroke-dasharray="3 4" opacity="0.8"/>
      <circle cx="200" cy="190" r="98" fill="none" stroke="#FFF" stroke-width="1.5" stroke-dasharray="3 4" opacity="0.8"/>
      <!-- Carved Floral Crest / Makara Head -->
      <g transform="translate(200, 80)">
        <circle cx="0" cy="0" r="16" fill="url(#goldBangle)" stroke="#FFEAA7" stroke-width="2"/>
        <circle cx="0" cy="0" r="9" fill="url(#rubyGem)" stroke="#FFF" stroke-width="1"/>
        <circle cx="-24" cy="4" r="7" fill="url(#rubyGem)"/>
        <circle cx="24" cy="4" r="7" fill="url(#rubyGem)"/>
      </g>
      <text x="200" y="375" text-anchor="middle" fill="#D4AF37" font-family="serif" font-size="12" letter-spacing="3">22K 916 • HANDCRAFTED KADA</text>
    </svg>
  `),

  royal_jhumka_earrings: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <defs>
        <radialGradient id="goldGlow2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#FFF3B0"/>
          <stop offset="50%" stop-color="#D4AF37"/>
          <stop offset="100%" stop-color="#7B3F00"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="#1C1917" rx="16"/>
      <!-- Left Earring -->
      <g transform="translate(140, 100)">
        <circle cx="0" cy="0" r="18" fill="url(#goldGlow2)" stroke="#FFF" stroke-width="1.5"/>
        <circle cx="0" cy="0" r="7" fill="#D63031"/>
        <line x1="0" y1="18" x2="0" y2="40" stroke="#D4AF37" stroke-width="3"/>
        <!-- Bell Dome -->
        <path d="M -30 75 Q 0 35 30 75 Z" fill="url(#goldGlow2)" stroke="#FFEAA7" stroke-width="2"/>
        <line x1="-30" y1="75" x2="30" y2="75" stroke="#FFEAA7" stroke-width="3"/>
        <!-- Hanging Pearl Latkans -->
        <circle cx="-24" cy="90" r="4" fill="#FFF"/>
        <circle cx="-12" cy="94" r="4" fill="#FFF"/>
        <circle cx="0" cy="96" r="5" fill="#FFF"/>
        <circle cx="12" cy="94" r="4" fill="#FFF"/>
        <circle cx="24" cy="90" r="4" fill="#FFF"/>
      </g>
      <!-- Right Earring -->
      <g transform="translate(260, 100)">
        <circle cx="0" cy="0" r="18" fill="url(#goldGlow2)" stroke="#FFF" stroke-width="1.5"/>
        <circle cx="0" cy="0" r="7" fill="#D63031"/>
        <line x1="0" y1="18" x2="0" y2="40" stroke="#D4AF37" stroke-width="3"/>
        <!-- Bell Dome -->
        <path d="M -30 75 Q 0 35 30 75 Z" fill="url(#goldGlow2)" stroke="#FFEAA7" stroke-width="2"/>
        <line x1="-30" y1="75" x2="30" y2="75" stroke="#FFEAA7" stroke-width="3"/>
        <!-- Hanging Pearl Latkans -->
        <circle cx="-24" cy="90" r="4" fill="#FFF"/>
        <circle cx="-12" cy="94" r="4" fill="#FFF"/>
        <circle cx="0" cy="96" r="5" fill="#FFF"/>
        <circle cx="12" cy="94" r="4" fill="#FFF"/>
        <circle cx="24" cy="90" r="4" fill="#FFF"/>
      </g>
      <text x="200" y="375" text-anchor="middle" fill="#D4AF37" font-family="serif" font-size="12" letter-spacing="3">22K 916 • ROYAL JHUMKA PAIR</text>
    </svg>
  `),

  lakshmi_gold_coin_pendant: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <defs>
        <radialGradient id="coinGrad" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#FFFBEB"/>
          <stop offset="40%" stop-color="#F59E0B"/>
          <stop offset="80%" stop-color="#B45309"/>
          <stop offset="100%" stop-color="#78350F"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="#0A0A0A" rx="16"/>
      <!-- Bail / Loop -->
      <path d="M 185 70 C 185 45 215 45 215 70 Z" fill="none" stroke="url(#coinGrad)" stroke-width="8"/>
      <!-- Coin Rim -->
      <circle cx="200" cy="200" r="110" fill="url(#coinGrad)" stroke="#FEF08A" stroke-width="4"/>
      <circle cx="200" cy="200" r="95" fill="none" stroke="#FEF08A" stroke-width="2" stroke-dasharray="4 4"/>
      <!-- Lakshmi Lotus Emblem -->
      <g transform="translate(200, 190)">
        <ellipse cx="0" cy="30" rx="35" ry="12" fill="#D97706" stroke="#FEF08A" stroke-width="1.5"/>
        <path d="M 0 -30 Q 25 5 0 20 Q -25 5 0 -30 Z" fill="#FDE68A" stroke="#B45309" stroke-width="1.5"/>
        <path d="M -15 -15 Q 10 10 -25 20 Z" fill="#FDE68A" stroke="#B45309" stroke-width="1"/>
        <path d="M 15 -15 Q -10 10 25 20 Z" fill="#FDE68A" stroke="#B45309" stroke-width="1"/>
        <circle cx="0" cy="-40" r="5" fill="#FEF08A"/>
      </g>
      <text x="200" y="325" text-anchor="middle" fill="#FEF08A" font-family="serif" font-weight="bold" font-size="14" letter-spacing="4">SHREE • 995</text>
      <text x="200" y="375" text-anchor="middle" fill="#F59E0B" font-family="serif" font-size="11" letter-spacing="3">24K 995 • TEMPLE GOLD COIN</text>
    </svg>
  `),

  mens_sovereign_gold_chain: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
      <defs>
        <linearGradient id="chainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FEF08A"/>
          <stop offset="35%" stop-color="#EAB308"/>
          <stop offset="70%" stop-color="#CA8A04"/>
          <stop offset="100%" stop-color="#713F12"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="#18181B" rx="16"/>
      <!-- Interlocking Curb Links -->
      <g stroke="url(#chainGrad)" stroke-width="14" fill="none">
        <ellipse cx="200" cy="180" rx="100" ry="90"/>
        <ellipse cx="200" cy="200" rx="80" ry="70"/>
      </g>
      <g stroke="#FFF" stroke-width="1" fill="none" opacity="0.6">
        <ellipse cx="200" cy="180" rx="100" ry="90"/>
        <ellipse cx="200" cy="200" rx="80" ry="70"/>
      </g>
      <text x="200" y="375" text-anchor="middle" fill="#EAB308" font-family="sans-serif" font-weight="bold" font-size="11" letter-spacing="3">22K 916 • ITALIAN CURB SOLID CHAIN</text>
    </svg>
  `),
};

export const DEFAULT_CATALOG_DESIGNS = [
  {
    id: "des_choker_001",
    designNumber: "NC-2026-001",
    designName: "Antique Heritage Bridal Choker",
    category: "Necklace",
    subcategory: "Bridal Choker",
    itemType: "Gold Necklace",
    purity: 916,
    approxGrossMg: 42500,
    approxNetMg: 41800,
    difficulty: "hard" as const,
    tags: ["Bridal", "22K", "Antique", "Choker", "Heritage"],
    source: "internal" as const,
    notes: "Handcrafted 22K 916 Heritage bridal choker with emerald and ruby cabochons.",
    photoDataUrl: JEWELLERY_SVG_ASSETS.antique_choker_necklace,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now(),
  },
  {
    id: "des_ring_002",
    designNumber: "RG-2026-002",
    designName: "1.25ct Solitaire Diamond Engagement Ring",
    category: "Ring",
    subcategory: "Solitaire Ring",
    itemType: "Diamond Ring",
    purity: 750,
    approxGrossMg: 4800,
    approxNetMg: 4550,
    difficulty: "medium" as const,
    tags: ["Diamond", "18K", "Solitaire", "Engagement", "VVS1"],
    source: "internal" as const,
    notes: "18K White Gold classic 6-prong solitaire ring with certified VVS1 diamond.",
    photoDataUrl: JEWELLERY_SVG_ASSETS.solitaire_diamond_ring,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now(),
  },
  {
    id: "des_kada_003",
    designNumber: "BG-2026-003",
    designName: "Traditional Filigree Kadda Bangle",
    category: "Bangle",
    subcategory: "Kada",
    itemType: "Gold Bangle",
    purity: 916,
    approxGrossMg: 38400,
    approxNetMg: 38400,
    difficulty: "medium" as const,
    tags: ["Bangle", "22K", "Traditional", "Filigree", "Solid"],
    source: "internal" as const,
    notes: "Solid 22K 916 Kada featuring antique rava beading and floral crest work.",
    photoDataUrl: JEWELLERY_SVG_ASSETS.traditional_kadda_bangle,
    createdAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now(),
  },
  {
    id: "des_jhumka_004",
    designNumber: "ER-2026-004",
    designName: "Royal Heritage Jhumka Earrings Pair",
    category: "Earring",
    subcategory: "Jhumka",
    itemType: "Gold Earrings",
    purity: 916,
    approxGrossMg: 18600,
    approxNetMg: 18200,
    difficulty: "hard" as const,
    tags: ["Earrings", "22K", "Jhumka", "Bridal", "Pearls"],
    source: "internal" as const,
    notes: "22K Royal bell jhumkas with hanging south sea pearls and enamel accents.",
    photoDataUrl: JEWELLERY_SVG_ASSETS.royal_jhumka_earrings,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now(),
  },
  {
    id: "des_coin_005",
    designNumber: "PD-2026-005",
    designName: "Temple Lakshmi Gold Coin Pendant",
    category: "Pendant",
    subcategory: "Temple Coin",
    itemType: "Gold Pendant",
    purity: 995,
    approxGrossMg: 10000,
    approxNetMg: 10000,
    difficulty: "easy" as const,
    tags: ["Pendant", "24K", "995", "Lakshmi", "Temple"],
    source: "internal" as const,
    notes: "24K 995 Fine Gold auspicious Lakshmi lotus coin medallion.",
    photoDataUrl: JEWELLERY_SVG_ASSETS.lakshmi_gold_coin_pendant,
    createdAt: Date.now() - 86400000 * 6,
    updatedAt: Date.now(),
  },
  {
    id: "des_chain_006",
    designNumber: "CH-2026-006",
    designName: "Men's Italian Curb Solid Gold Chain",
    category: "Chain",
    subcategory: "Curb Chain",
    itemType: "Gold Chain",
    purity: 916,
    approxGrossMg: 24500,
    approxNetMg: 24500,
    difficulty: "medium" as const,
    tags: ["Chain", "22K", "Men", "Italian", "Solid"],
    source: "internal" as const,
    notes: "High polish 22K 916 interlocking Italian curb chain with lobster lock.",
    photoDataUrl: JEWELLERY_SVG_ASSETS.mens_sovereign_gold_chain,
    createdAt: Date.now() - 86400000 * 1,
    updatedAt: Date.now(),
  },
];
