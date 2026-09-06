/**
 * Arivahly Venture Sphere (AVS) — Lead Pipeline & Enquiry Engine
 * 
 * Stages:
 * New → Contacted → Qualified → Product Discussion → Appointment → Quotation → Negotiation → Won → Lost → Nurture
 */

export type LeadStage =
  | 'New'
  | 'Contacted'
  | 'Qualified'
  | 'Product Discussion'
  | 'Appointment'
  | 'Quotation'
  | 'Negotiation'
  | 'Won'
  | 'Lost'
  | 'Nurture';

export type LeadTemperature = 'HOT' | 'WARM' | 'COLD';

export interface LeadRecord {
  id: string;
  leadCode: string; // e.g. AVS-LEAD-2026-0042
  customerName: string;
  phone: string;
  email?: string;
  source: 'Showroom Walk-in' | 'WhatsApp' | 'Instagram' | 'Website' | 'Referral' | 'Exhibition' | 'Phone';
  categoryRequested: string;
  budgetPaise: number;
  expectedPurchaseDate?: string;
  temperature: LeadTemperature;
  stage: LeadStage;
  probabilityPercent: number;
  assignedStaff: string;
  nextFollowupDate: string;
  nextAction: string;
  lossReason?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'avs_lead_pipeline_v1';

export function getSampleLeads(): LeadRecord[] {
  return [
    {
      id: 'lead-1',
      leadCode: 'AVS-LEAD-2026-0081',
      customerName: 'Priya Sharma',
      phone: '+91 98450 11223',
      source: 'Showroom Walk-in',
      categoryRequested: '22K Bridal Jewellery Set',
      budgetPaise: 50000000, // ₹5,00,000
      expectedPurchaseDate: '2026-10-15',
      temperature: 'HOT',
      stage: 'Quotation',
      probabilityPercent: 85,
      assignedStaff: 'Rohan Mehta',
      nextFollowupDate: '2026-09-07T10:00:00Z',
      nextAction: 'Confirm quotation terms with bride & family',
      notes: 'Interested in Royal Temple choker with matching earrings. Quotation AVS-Q-1048 shared.',
      createdAt: '2026-09-02T14:30:00Z',
      updatedAt: '2026-09-06T11:00:00Z',
    },
    {
      id: 'lead-2',
      leadCode: 'AVS-LEAD-2026-0082',
      customerName: 'Amitava Roy',
      phone: '+91 98310 99887',
      source: 'WhatsApp',
      categoryRequested: '18K Diamond Solitaire Ring',
      budgetPaise: 15000000, // ₹1,50,000
      expectedPurchaseDate: '2026-09-20',
      temperature: 'WARM',
      stage: 'Product Discussion',
      probabilityPercent: 60,
      assignedStaff: 'Pooja Sen',
      nextFollowupDate: '2026-09-08T15:00:00Z',
      nextAction: 'Send video of 1 carat VVS round cut solitaires',
      notes: 'Anniversary gift for spouse. Looking for certified IGI/GIA diamond.',
      createdAt: '2026-09-04T09:15:00Z',
      updatedAt: '2026-09-05T17:00:00Z',
    },
    {
      id: 'lead-3',
      leadCode: 'AVS-LEAD-2026-0083',
      customerName: 'Meera Iyer',
      phone: '+91 97412 33445',
      source: 'Instagram',
      categoryRequested: 'Lightweight Daily Wear Bangles',
      budgetPaise: 8000000, // ₹80,000
      expectedPurchaseDate: '2026-09-30',
      temperature: 'COLD',
      stage: 'New',
      probabilityPercent: 30,
      assignedStaff: 'Rohan Mehta',
      nextFollowupDate: '2026-09-07T11:00:00Z',
      nextAction: 'Initial welcome call & catalogue dispatch',
      notes: 'Enquired on Instagram reel for featherlight CNC bangles.',
      createdAt: '2026-09-06T08:00:00Z',
      updatedAt: '2026-09-06T08:00:00Z',
    },
  ];
}

export function getLeadPipeline(): LeadRecord[] {
  if (typeof window === 'undefined') return getSampleLeads();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getSampleLeads();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return getSampleLeads();
  }
}

export function saveLeadPipeline(leads: LeadRecord[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
}
