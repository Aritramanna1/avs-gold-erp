/**
 * Arivahly Venture Sphere (AVS) — Customer 360 CRM Store
 * 
 * Provides unified customer data, identity, preferences, family structure,
 * lifetime value, consent management, and unified interaction timeline.
 */

export type CustomerTier = 'Standard' | 'Preferred' | 'Premium' | 'VIP';

export interface CustomerFamilyMember {
  id: string;
  name: string;
  relation: 'spouse' | 'child' | 'parent' | 'sibling' | 'other';
  linkedCustomerId?: string;
  birthday?: string;
  anniversary?: string;
}

export interface CustomerPreferences {
  goldPurity: ('24K' | '22K' | '18K' | '14K')[];
  silverPreferred: boolean;
  categories: string[];
  stylePreference: 'Traditional' | 'Contemporary' | 'Antique' | 'Lightweight' | 'Bridal' | 'Minimalist';
  ringSize?: string;
  bangleSize?: string;
  budgetRangeMinPaise?: number;
  budgetRangeMaxPaise?: number;
}

export interface CustomerConsentRecord {
  transactionalWhatsapp: boolean;
  marketingWhatsapp: boolean;
  emailNewsletter: boolean;
  smsPromotions: boolean;
  optOut: boolean;
  consentTimestamp: string;
  consentSource: 'Showroom Sign-up' | 'Invoice Acceptance' | 'Website' | 'WhatsApp Opt-in';
}

export interface CustomerTimelineEvent {
  id: string;
  timestamp: string;
  type: 'enquiry' | 'appointment' | 'quotation' | 'reservation' | 'order' | 'purchase' | 'payment' | 'repair' | 'exchange' | 'communication' | 'task' | 'note';
  title: string;
  description: string;
  referenceId?: string;
  amountPaise?: number;
  staffName?: string;
}

export interface Customer360Profile {
  id: string;
  customerCode: string; // e.g. AVS-C-001024
  fullName: string;
  phone: string;
  whatsappPhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  tier: CustomerTier;
  relationshipOwner?: string;
  dateOfBirth?: string;
  anniversaryDate?: string;
  firstInteractionDate: string;
  lastInteractionDate: string;
  lastPurchaseDate?: string;
  lifetimeValuePaise: number;
  totalPurchasesCount: number;
  preferences: CustomerPreferences;
  familyMembers: CustomerFamilyMember[];
  consent: CustomerConsentRecord;
  timeline: CustomerTimelineEvent[];
}

const STORAGE_KEY = 'avs_crm_360_customers_v1';

export function getSampleCustomer360(): Customer360Profile[] {
  return [
    {
      id: 'cust-1',
      customerCode: 'AVS-C-2026-000102',
      fullName: 'Ananya Sengupta',
      phone: '+91 98301 22334',
      whatsappPhone: '+91 98301 22334',
      email: 'ananya.sengupta@example.com',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700019',
      tier: 'VIP',
      relationshipOwner: 'Sanjay Verma (Showroom Manager)',
      dateOfBirth: '1988-11-14',
      anniversaryDate: '2015-02-18',
      firstInteractionDate: '2024-01-15',
      lastInteractionDate: '2026-09-06',
      lastPurchaseDate: '2026-08-12',
      lifetimeValuePaise: 184500000, // ₹18,45,000
      totalPurchasesCount: 7,
      preferences: {
        goldPurity: ['22K', '18K'],
        silverPreferred: false,
        categories: ['Bridal Necklaces', 'Antique Bangles', 'Solitaire Rings'],
        stylePreference: 'Antique',
        ringSize: '14',
        bangleSize: '2.4',
        budgetRangeMinPaise: 20000000,
        budgetRangeMaxPaise: 80000000,
      },
      familyMembers: [
        {
          id: 'fam-1',
          name: 'Vikram Sengupta',
          relation: 'spouse',
          birthday: '1985-06-22',
          anniversary: '2015-02-18',
        },
      ],
      consent: {
        transactionalWhatsapp: true,
        marketingWhatsapp: true,
        emailNewsletter: true,
        smsPromotions: false,
        optOut: false,
        consentTimestamp: '2024-01-15T11:00:00Z',
        consentSource: 'Showroom Sign-up',
      },
      timeline: [
        {
          id: 't-1',
          timestamp: '2026-09-06T11:30:00Z',
          type: 'appointment',
          title: 'Bridal Set Consultation Scheduled',
          description: 'Consultation with relationship owner Sanjay Verma.',
          staffName: 'Sanjay Verma',
        },
        {
          id: 't-2',
          timestamp: '2026-08-12T16:20:00Z',
          type: 'purchase',
          title: 'Purchased 22K Royal Temple Jhumka',
          description: 'Invoice #AVS-INV-2026-0881 · Gross Wt: 34.20g.',
          amountPaise: 24500000,
          referenceId: 'AVS-INV-2026-0881',
          staffName: 'Sanjay Verma',
        },
        {
          id: 't-3',
          timestamp: '2026-08-12T16:30:00Z',
          type: 'payment',
          title: 'Payment Received (UPI + Card)',
          description: '₹2,45,000 settled via Razorpay POS.',
          amountPaise: 24500000,
          referenceId: 'PAY-9921',
          staffName: 'Cashier Desk 1',
        },
      ],
    },
  ];
}

export function getCustomer360Profiles(): Customer360Profile[] {
  if (typeof window === 'undefined') return getSampleCustomer360();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getSampleCustomer360();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return getSampleCustomer360();
  }
}
