/**
 * Arivahly Venture Sphere (AVS) — Jewellery Service & Repair Engine
 * 
 * Full lifecycle tracking:
 * Received → Inspection → Estimate → Customer Approval → Repair → Quality Check → Ready → Delivered
 */

export type RepairStatus =
  | 'Received'
  | 'Inspection'
  | 'Estimate'
  | 'Customer Approval'
  | 'Repair'
  | 'Quality Check'
  | 'Ready'
  | 'Delivered';

export type RepairType =
  | 'Size Adjustment (Ring / Bangle)'
  | 'Polishing & Rhodium Plating'
  | 'Stone Resetting / Replacement'
  | 'Soldering & Joint Repair'
  | 'Lock / Clasp Replacement'
  | 'Custom Modification'
  | 'Restring Pearls / Beads';

export interface RepairRecord {
  id: string;
  repairCode: string; // e.g. AVS-REP-2026-0034
  customerId: string;
  customerName: string;
  customerPhone: string;
  itemDescription: string;
  authenticationNumber?: string;
  purity: string;
  intakeGrossWeightGrams: number;
  deliveryGrossWeightGrams?: number;
  repairType: RepairType;
  intakeConditionNotes: string;
  intakePhotos: string[];
  estimatedCostPaise: number;
  finalCostPaise?: number;
  promisedDeliveryDate: string;
  assignedTechnician: string;
  status: RepairStatus;
  qualityCheckNotes?: string;
  deliveredAt?: string;
  customerSignatureObtained: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'avs_repairs_v1';

export function getSampleRepairs(): RepairRecord[] {
  return [
    {
      id: 'rep-1',
      repairCode: 'AVS-REP-2026-0034',
      customerId: 'cust-1',
      customerName: 'Ananya Sengupta',
      customerPhone: '+91 98301 22334',
      itemDescription: '22K Polki Kada (Bangle Lock Loose)',
      purity: '22K (916)',
      intakeGrossWeightGrams: 32.40,
      repairType: 'Lock / Clasp Replacement',
      intakeConditionNotes: 'Screw hinge worn out. Minor enamel chipping near screw.',
      intakePhotos: ['/images/repairs/kada-lock.webp'],
      estimatedCostPaise: 250000, // ₹2,500
      promisedDeliveryDate: '2026-09-08',
      assignedTechnician: 'Master Karigar Bimal',
      status: 'Repair',
      customerSignatureObtained: true,
      createdAt: '2026-09-04T11:00:00Z',
      updatedAt: '2026-09-05T16:00:00Z',
    },
    {
      id: 'rep-2',
      repairCode: 'AVS-REP-2026-0035',
      customerId: 'cust-2',
      customerName: 'Sunita Mehra',
      customerPhone: '+91 98200 44556',
      itemDescription: '18K Diamond Solitaire Ring (Ring Sizing 12 to 14)',
      purity: '18K (750)',
      intakeGrossWeightGrams: 3.85,
      repairType: 'Size Adjustment (Ring / Bangle)',
      intakeConditionNotes: 'VVS solitaire intact. Requires gold shank extension.',
      intakePhotos: ['/images/repairs/ring-sizing.webp'],
      estimatedCostPaise: 420000, // ₹4,200
      promisedDeliveryDate: '2026-09-07',
      assignedTechnician: 'Master Karigar Subhash',
      status: 'Ready',
      qualityCheckNotes: 'Sizing seamless. Rhodium dip completed. Diamond prongs laser tight.',
      customerSignatureObtained: true,
      createdAt: '2026-09-03T10:00:00Z',
      updatedAt: '2026-09-06T10:30:00Z',
    },
  ];
}

export function getRepairs(): RepairRecord[] {
  if (typeof window === 'undefined') return getSampleRepairs();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getSampleRepairs();
  } catch {
    return getSampleRepairs();
  }
}
