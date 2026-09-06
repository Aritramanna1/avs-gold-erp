/**
 * Arivahly Venture Sphere (AVS) — Centralized Gold Rate & Historical Pricing Engine
 * 
 * CORE PRINCIPLE:
 * Historical transactions (Quotations, Orders, Invoices) permanently store the exact
 * gold rate snapshot used at execution time. Updating today's gold rate NEVER recalculates
 * or alters historical records.
 */

export interface GoldRateSnapshot {
  id: string;
  effectiveDate: string; // YYYY-MM-DD
  effectiveTime: string; // HH:mm:ss
  rate24KPerGramPaise: number;
  rate22KPerGramPaise: number;
  rate18KPerGramPaise: number;
  rate14KPerGramPaise: number;
  rateSilver925PerGramPaise: number;
  rateSilver999PerGramPaise: number;
  source: 'MCX' | 'IBJA' | 'Local Association' | 'Manual Override';
  enteredBy: string;
  approvedBy: string;
  notes?: string;
}

export interface TransactionRateSnapshot {
  rateId: string;
  rate24KPaise: number;
  rate22KPaise: number;
  rate18KPaise: number;
  rateSilverPaise: number;
  lockedTimestamp: string;
}

const STORAGE_KEY = 'avs_gold_rate_history_v1';

export function getDefaultGoldRateHistory(): GoldRateSnapshot[] {
  return [
    {
      id: 'GR-2026-09-06-01',
      effectiveDate: '2026-09-06',
      effectiveTime: '09:30:00',
      rate24KPerGramPaise: 745000, // ₹7,450/g
      rate22KPerGramPaise: 685000, // ₹6,850/g
      rate18KPerGramPaise: 560000, // ₹5,600/g
      rate14KPerGramPaise: 435000, // ₹4,350/g
      rateSilver925PerGramPaise: 8800, // ₹88.00/g
      rateSilver999PerGramPaise: 9400, // ₹94.00/g
      source: 'IBJA',
      enteredBy: 'Sanjay Verma (Manager)',
      approvedBy: 'Founder / Admin',
      notes: 'Morning showroom opening rate',
    },
    {
      id: 'GR-2026-09-05-01',
      effectiveDate: '2026-09-05',
      effectiveTime: '09:30:00',
      rate24KPerGramPaise: 742000,
      rate22KPerGramPaise: 682000,
      rate18KPerGramPaise: 558000,
      rate14KPerGramPaise: 433000,
      rateSilver925PerGramPaise: 8750,
      rateSilver999PerGramPaise: 9350,
      source: 'IBJA',
      enteredBy: 'Sanjay Verma (Manager)',
      approvedBy: 'Founder / Admin',
    },
  ];
}

export function getGoldRateHistory(): GoldRateSnapshot[] {
  if (typeof window === 'undefined') return getDefaultGoldRateHistory();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultGoldRateHistory();
  } catch {
    return getDefaultGoldRateHistory();
  }
}

export function getCurrentGoldRate(): GoldRateSnapshot {
  const history = getGoldRateHistory();
  return history[0] || getDefaultGoldRateHistory()[0];
}

export function createTransactionRateSnapshot(): TransactionRateSnapshot {
  const current = getCurrentGoldRate();
  return {
    rateId: current.id,
    rate24KPaise: current.rate24KPerGramPaise,
    rate22KPaise: current.rate22KPerGramPaise,
    rate18KPaise: current.rate18KPerGramPaise,
    rateSilverPaise: current.rateSilver925PerGramPaise,
    lockedTimestamp: new Date().toISOString(),
  };
}
