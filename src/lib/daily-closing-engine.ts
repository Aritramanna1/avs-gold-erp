/**
 * Arivahly Venture Sphere (AVS) — Daily Closing, Opening Checklist & Founder Morning Brief Engine
 */

export interface OpeningChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  checkedBy?: string;
  timestamp?: string;
}

export interface DailyClosingReport {
  id: string;
  date: string; // YYYY-MM-DD
  totalSalesPaise: number;
  totalCollectionsPaise: number;
  cashInHandPaise: number;
  bankSettlementsPaise: number;
  upiSettlementsPaise: number;
  cardSettlementsPaise: number;
  goldSoldGrams: number;
  silverSoldGrams: number;
  openTasksCount: number;
  repairsReadyCount: number;
  safeLockupVerified: boolean;
  closedByStaff: string;
  founderAcknowledged: boolean;
  notes?: string;
  closedAt: string;
}

export interface FounderMorningBrief {
  date: string;
  greeting: string;
  appointmentsSummary: string;
  followupsDueToday: number;
  highValueLeadsCount: number;
  pendingCollectionsPaise: number;
  inventoryDiscrepancyCount: number;
  quotationsAwaitingResponse: number;
  actionItems: string[];
}

export function generateFounderMorningBrief(): FounderMorningBrief {
  return {
    date: new Date().toISOString().split('T')[0],
    greeting: 'Good morning, Founder. Here is your daily operational brief for Arivahly Venture Sphere.',
    appointmentsSummary: '3 VIP Showroom Appointments scheduled today (1 Bridal, 1 Solitaire, 1 Delivery).',
    followupsDueToday: 7,
    highValueLeadsCount: 4,
    pendingCollectionsPaise: 124000000, // ₹12,40,000
    inventoryDiscrepancyCount: 1,
    quotationsAwaitingResponse: 3,
    actionItems: [
      'Resolve Safe B Tray 4 physical inventory discrepancy (1 missing piece).',
      'Review expiring quotation AVS-Q-1048 (₹3.92L) for Priya Sharma.',
      'VIP client Ananya Sengupta arriving at 11:30 AM for private bridal viewing.',
    ],
  };
}
