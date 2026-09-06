/**
 * Arivahly Venture Sphere (AVS) — Quotation Engine & Discount Approval Matrix
 * 
 * Features:
 * - Versioned Revisions (Rev 1, Rev 2, Rev 3...)
 * - Frozen Gold Rate Snapshot per Quotation
 * - Configurable Discount Approval Thresholds:
 *   - Sales Staff Limit: <= 2% discount (Auto approved)
 *   - Manager Limit: 2.1% - 5% discount (Manager signoff)
 *   - Founder Limit: > 5% discount (Mandatory Founder approval)
 */

import { TransactionRateSnapshot } from './gold-rate-master-store';

export type QuotationStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Sent'
  | 'Viewed'
  | 'Negotiation'
  | 'Accepted'
  | 'Expired'
  | 'Rejected'
  | 'Converted';

export interface QuotationItem {
  id: string;
  pieceId?: string;
  authenticationNumber?: string;
  name: string;
  purity: string;
  grossWeightGrams: number;
  netGoldWeightGrams: number;
  goldRateAppliedPaise: number;
  metalValuePaise: number;
  makingChargePaise: number;
  stoneValuePaise: number;
  wastagePaise: number;
  itemTotalPaise: number;
}

export interface QuotationRevision {
  revisionNumber: number;
  timestamp: string;
  items: QuotationItem[];
  subtotalPaise: number;
  discountPercent: number;
  discountPaise: number;
  taxPaise: number; // 3% GST on jewellery
  finalTotalPaise: number;
  notes?: string;
  modifiedBy: string;
}

export interface QuotationRecord {
  id: string;
  quotationNumber: string; // e.g. AVS-Q-2026-1048
  customerId: string;
  customerName: string;
  customerPhone: string;
  date: string;
  validUntil: string;
  salesperson: string;
  status: QuotationStatus;
  currentRevisionNumber: number;
  revisions: QuotationRevision[];
  rateSnapshot: TransactionRateSnapshot;
  approvalRequired: boolean;
  approvalReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

const STORAGE_KEY = 'avs_quotations_v1';

export function getSampleQuotations(): QuotationRecord[] {
  return [
    {
      id: 'q-1048',
      quotationNumber: 'AVS-Q-2026-1048',
      customerId: 'cust-1',
      customerName: 'Priya Sharma',
      customerPhone: '+91 98450 11223',
      date: '2026-09-05',
      validUntil: '2026-09-08',
      salesperson: 'Rohan Mehta',
      status: 'Sent',
      currentRevisionNumber: 1,
      rateSnapshot: {
        rateId: 'GR-2026-09-05-01',
        rate24KPaise: 742000,
        rate22KPaise: 682000,
        rate18KPaise: 558000,
        rateSilverPaise: 8750,
        lockedTimestamp: '2026-09-05T10:00:00Z',
      },
      approvalRequired: false,
      revisions: [
        {
          revisionNumber: 1,
          timestamp: '2026-09-05T10:00:00Z',
          items: [
            {
              id: 'qi-1',
              authenticationNumber: 'AVS-G-2026-000127',
              name: '22K Royal Temple Antique Necklace',
              purity: '22K (916)',
              grossWeightGrams: 48.65,
              netGoldWeightGrams: 45.10,
              goldRateAppliedPaise: 682000,
              metalValuePaise: 30758200,
              makingChargePaise: 3382500,
              stoneValuePaise: 3500000,
              wastagePaise: 1076537,
              itemTotalPaise: 38717237,
            },
          ],
          subtotalPaise: 38717237,
          discountPercent: 1.5,
          discountPaise: 580758,
          taxPaise: 1144094,
          finalTotalPaise: 39280573,
          modifiedBy: 'Rohan Mehta',
        },
      ],
      createdAt: '2026-09-05T10:00:00Z',
    },
  ];
}

export function getQuotations(): QuotationRecord[] {
  if (typeof window === 'undefined') return getSampleQuotations();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getSampleQuotations();
  } catch {
    return getSampleQuotations();
  }
}

export function evaluateDiscountApproval(discountPercent: number, userRole: string): { requiresApproval: boolean; approverRole?: string } {
  if (discountPercent <= 2) {
    return { requiresApproval: false };
  }
  if (discountPercent <= 5) {
    return {
      requiresApproval: userRole !== 'store_manager' && userRole !== 'admin' && userRole !== 'founder',
      approverRole: 'Store Manager',
    };
  }
  return {
    requiresApproval: userRole !== 'founder' && userRole !== 'admin',
    approverRole: 'Founder / Super Admin',
  };
}
