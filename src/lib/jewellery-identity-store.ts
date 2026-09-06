/**
 * Arivahly Venture Sphere (AVS) — Jewellery Identity & Authentication Engine
 * 
 * Supports:
 * - Unique Authentication Identifier: `AVS-G-YYYY-XXXXXX` / `AVS-S-YYYY-XXXXXX` / `AVS-D-YYYY-XXXXXX`
 * - Detailed weight & purity breakdown (Gross, Net Gold, Stone Wt, Stone Val, Making Charges, Wastage)
 * - Public vs Private field separation for website authentication verification
 */

export type MetalPurity = '24K (999)' | '22K (916)' | '18K (750)' | '14K (585)' | 'Silver (925)' | 'Silver (999)';
export type JewelleryCategory =
  | 'Rings'
  | 'Earrings'
  | 'Necklaces'
  | 'Chains'
  | 'Bangles'
  | 'Bracelets'
  | 'Mangalsutra'
  | 'Pendants'
  | 'Nose Pins'
  | 'Anklets'
  | 'Men\'s Jewellery'
  | 'Children\'s Jewellery'
  | 'Bridal Jewellery'
  | 'Silver Jewellery'
  | 'Gold Coins / Bars'
  | 'Custom Jewellery';

export type InventoryState =
  | 'Available'
  | 'Reserved'
  | 'Sold'
  | 'In Transit'
  | 'Under Repair'
  | 'Under Inspection'
  | 'Returned'
  | 'Damaged'
  | 'Lost / Missing'
  | 'Archived';

export interface JewelleryPieceMaster {
  id: string;
  authenticationNumber: string; // e.g. AVS-G-2026-000127
  sku: string;
  publicSku?: string;
  serialNumber?: string;
  laserEngravingRef?: string;
  name: string;
  category: JewelleryCategory;
  collection: string; // e.g. Royal Temple, Modern Minimalist, Celestial Diamond
  purity: MetalPurity;
  grossWeightGrams: number;
  netGoldWeightGrams: number;
  stoneWeightCarats: number;
  stoneValuePaise: number;
  stoneType?: string; // e.g. 'VVS/EF Diamond', 'Burmese Ruby', 'Russian Emerald'
  makingChargeType: 'per_gram' | 'flat' | 'percentage';
  makingChargeRate: number; // in paise or percent
  wastagePercent: number;
  currentSellingPricePaise: number;
  costPaise: number;
  marginPercent: number;
  locationId: string;
  locationName: string; // e.g. Showroom Counter 2 / Tray B
  state: InventoryState;
  hsnCode: string;
  images: string[];
  hallmarked: boolean;
  huidNumber?: string; // BIS 6-character alphanumeric HUID
  createdAt: string;
  updatedAt: string;
}

/**
 * Publicly verifiable metadata — strictly strips out supplier info, costs, margins, and customer data.
 */
export interface PublicProductVerificationResult {
  authenticationNumber: string;
  authentic: boolean;
  productName: string;
  category: JewelleryCategory;
  collection: string;
  purity: MetalPurity;
  grossWeightGrams: number;
  netGoldWeightGrams: number;
  hallmarked: boolean;
  huidNumber?: string;
  verifiedAt: string;
}

const STORAGE_KEY = 'avs_jewellery_pieces_v1';

export function getSampleJewelleryPieces(): JewelleryPieceMaster[] {
  return [
    {
      id: 'prod-1',
      authenticationNumber: 'AVS-G-2026-000127',
      sku: 'AVS-NK-22K-084',
      publicSku: 'NK-ROYAL-TEMPLE-01',
      laserEngravingRef: 'AVS-7729',
      name: '22K Royal Temple Antique Necklace',
      category: 'Bridal Jewellery',
      collection: 'Royal Temple Collection',
      purity: '22K (916)',
      grossWeightGrams: 48.65,
      netGoldWeightGrams: 45.10,
      stoneWeightCarats: 17.75,
      stoneValuePaise: 3500000, // ₹35,000
      stoneType: 'Natural Uncut Polki & South Sea Pearls',
      makingChargeType: 'per_gram',
      makingChargeRate: 75000, // ₹750/g
      wastagePercent: 3.5,
      currentSellingPricePaise: 38450000, // ₹3,84,500
      costPaise: 33500000,
      marginPercent: 14.77,
      locationId: 'loc-tray-4',
      locationName: 'Showroom Safe B · Tray 4',
      state: 'Available',
      hsnCode: '71131910',
      images: ['/images/jewellery/royal-temple-necklace.webp'],
      hallmarked: true,
      huidNumber: 'AB94X2',
      createdAt: '2026-08-10T10:00:00Z',
      updatedAt: '2026-09-06T11:00:00Z',
    },
    {
      id: 'prod-2',
      authenticationNumber: 'AVS-D-2026-000214',
      sku: 'AVS-RG-18K-019',
      publicSku: 'RG-SOLITAIRE-1CT',
      laserEngravingRef: 'AVS-9011',
      name: '18K White Gold Solitaire Diamond Ring',
      category: 'Rings',
      collection: 'Celestial Diamond Collection',
      purity: '18K (750)',
      grossWeightGrams: 4.82,
      netGoldWeightGrams: 4.62,
      stoneWeightCarats: 1.01,
      stoneValuePaise: 18500000, // ₹1,85,000
      stoneType: '1.01ct Round Brilliant VVS1/E (IGI Certified)',
      makingChargeType: 'flat',
      makingChargeRate: 850000, // ₹8,500
      wastagePercent: 0,
      currentSellingPricePaise: 22800000, // ₹2,28,000
      costPaise: 19500000,
      marginPercent: 16.92,
      locationId: 'loc-counter-1',
      locationName: 'Showroom Counter 1 · Diamond Display 1',
      state: 'Available',
      hsnCode: '71131920',
      images: ['/images/jewellery/solitaire-ring.webp'],
      hallmarked: true,
      huidNumber: 'D88QZ1',
      createdAt: '2026-08-18T14:30:00Z',
      updatedAt: '2026-09-05T09:00:00Z',
    },
  ];
}

export function getJewelleryPieces(): JewelleryPieceMaster[] {
  if (typeof window === 'undefined') return getSampleJewelleryPieces();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getSampleJewelleryPieces();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return getSampleJewelleryPieces();
  }
}

export function verifyProductAuthentication(authNumber: string): PublicProductVerificationResult | null {
  const pieces = getJewelleryPieces();
  const found = pieces.find(
    (p) => p.authenticationNumber.trim().toUpperCase() === authNumber.trim().toUpperCase(),
  );
  if (!found) return null;

  return {
    authenticationNumber: found.authenticationNumber,
    authentic: true,
    productName: found.name,
    category: found.category,
    collection: found.collection,
    purity: found.purity,
    grossWeightGrams: found.grossWeightGrams,
    netGoldWeightGrams: found.netGoldWeightGrams,
    hallmarked: found.hallmarked,
    huidNumber: found.huidNumber,
    verifiedAt: new Date().toISOString(),
  };
}
