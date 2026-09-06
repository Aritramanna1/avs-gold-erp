/**
 * Arivahly Venture Sphere (AVS) — Founder Command Center & Action Engine
 * 
 * Provides an authoritative daily cockpit for the jewellery showroom founder:
 * - Sales, Customer, Lead, Appointment, Inventory, Financial, and Operational telemetry
 * - "ACTION REQUIRED" matrix sorted by Critical, High, Medium, Low severity
 */

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ActionRequiredItem {
  id: string;
  severity: SeverityLevel;
  category: 'inventory' | 'quotation' | 'customer' | 'payment' | 'appointment' | 'repair' | 'approval';
  title: string;
  description: string;
  timestamp: string;
  actionUrl: string;
  actionLabel: string;
  metadata?: Record<string, unknown>;
}

export interface FounderDashboardMetrics {
  sales: {
    todayPaise: number;
    yesterdayPaise: number;
    monthToDatePaise: number;
    previousMonthPaise: number;
    yearToDatePaise: number;
    targetPaise: number;
    averageTransactionValuePaise: number;
    transactionCount: number;
  };
  customers: {
    newToday: number;
    newThisMonth: number;
    activeCount: number;
    vipCount: number;
    upcomingBirthdaysCount: number;
    upcomingAnniversariesCount: number;
  };
  leads: {
    newEnquiriesCount: number;
    hotLeadsCount: number;
    warmLeadsCount: number;
    coldLeadsCount: number;
    followupsDueTodayCount: number;
    overdueFollowupsCount: number;
    conversionRatePercent: number;
    pipelineValuePaise: number;
  };
  appointments: {
    todayCount: number;
    upcomingCount: number;
    missedCount: number;
    completedTodayCount: number;
    highValueCount: number;
  };
  inventory: {
    totalPieces: number;
    availablePieces: number;
    reservedPieces: number;
    soldTodayPieces: number;
    repairPieces: number;
    stockValuationPaise: number;
    discrepanciesCount: number;
    lowStockCategories: string[];
  };
  finance: {
    outstandingCustomerPaise: number;
    todayCollectionsPaise: number;
    paymentMismatchesCount: number;
    pendingSupplierPaymentsPaise: number;
  };
  actionRequired: ActionRequiredItem[];
}

export function getFounderMetrics(): FounderDashboardMetrics {
  return {
    sales: {
      todayPaise: 48500000, // ₹4,85,000
      yesterdayPaise: 32000000, // ₹3,20,000
      monthToDatePaise: 845000000, // ₹84,50,000
      previousMonthPaise: 1120000000, // ₹1,12,00,000
      yearToDatePaise: 9450000000, // ₹9,45,00,000
      targetPaise: 1000000000, // ₹1,00,00,000
      averageTransactionValuePaise: 12125000, // ₹1,21,250
      transactionCount: 4,
    },
    customers: {
      newToday: 2,
      newThisMonth: 38,
      activeCount: 412,
      vipCount: 48,
      upcomingBirthdaysCount: 3,
      upcomingAnniversariesCount: 2,
    },
    leads: {
      newEnquiriesCount: 5,
      hotLeadsCount: 4,
      warmLeadsCount: 11,
      coldLeadsCount: 8,
      followupsDueTodayCount: 7,
      overdueFollowupsCount: 2,
      conversionRatePercent: 32.4,
      pipelineValuePaise: 420000000, // ₹42,00,000
    },
    appointments: {
      todayCount: 3,
      upcomingCount: 8,
      missedCount: 0,
      completedTodayCount: 1,
      highValueCount: 2,
    },
    inventory: {
      totalPieces: 1420,
      availablePieces: 1290,
      reservedPieces: 45,
      soldTodayPieces: 4,
      repairPieces: 12,
      stockValuationPaise: 18450000000, // ₹18.45 Cr
      discrepanciesCount: 1,
      lowStockCategories: ['22K Bridal Necklaces', '18K Diamond Solitaires'],
    },
    finance: {
      outstandingCustomerPaise: 124000000, // ₹12,40,000
      todayCollectionsPaise: 45000000, // ₹4,50,000
      paymentMismatchesCount: 1,
      pendingSupplierPaymentsPaise: 380000000, // ₹38,00,000
    },
    actionRequired: [
      {
        id: 'ACT-001',
        severity: 'CRITICAL',
        category: 'inventory',
        title: 'Physical Inventory Discrepancy Detected',
        description: 'Tray 4 (Showroom Safe B) shows 1 missing piece compared to ERP ledger (SKU: AVS-G-2026-000412).',
        timestamp: new Date().toISOString(),
        actionUrl: '/stock/verification',
        actionLabel: 'Inspect Discrepancy',
      },
      {
        id: 'ACT-002',
        severity: 'HIGH',
        category: 'quotation',
        title: 'High-Value Bridal Quotation Expires Tomorrow',
        description: 'Quotation AVS-Q-1048 for ₹4,85,000 (Priya Sharma) expires in 24 hours at 22K rate ₹6,850/g.',
        timestamp: new Date().toISOString(),
        actionUrl: '/billing/estimates',
        actionLabel: 'Review Quotation',
      },
      {
        id: 'ACT-003',
        severity: 'HIGH',
        category: 'payment',
        title: 'Payment Gateway Settlement Mismatch',
        description: 'UPI transaction ref #AXIS-99214 for ₹1,25,000 received with no matched bill reference.',
        timestamp: new Date().toISOString(),
        actionUrl: '/treasury/bank-reconciliation',
        actionLabel: 'Reconcile Payment',
      },
      {
        id: 'ACT-004',
        severity: 'MEDIUM',
        category: 'appointment',
        title: 'Bridal Consultation Appointment in 45 Mins',
        description: 'Customer Ananya Sengupta (VIP Tier) arriving for 22K Antique Set consultation.',
        timestamp: new Date().toISOString(),
        actionUrl: '/crm/appointments',
        actionLabel: 'Open Appointment Card',
      },
      {
        id: 'ACT-005',
        severity: 'LOW',
        category: 'customer',
        title: 'VIP Client Anniversary Approaching',
        description: 'Rajesh & Suman Gupta anniversary in 3 days. Past purchase: Diamond Tennis Bracelet ₹3.2L.',
        timestamp: new Date().toISOString(),
        actionUrl: '/people',
        actionLabel: 'Send Personalized Greetings',
      },
    ],
  };
}
