/**
 * MTJ ERP — Customer Gold Deposit (V1.1 Phase 4)
 *
 * A customer can deposit gold with no order behind it yet. Ownership is
 * tracked for the deposit's entire lifecycle: deposit -> sits as customer
 * credit -> drawn down against a future order/manufacturing bill -> delivery.
 * Gold Vault stays the single source of truth (reuses the existing
 * "customer_gold_received" movement type — the same one billing-store.ts's
 * gold-payment path already posts) — this store only tracks the
 * per-customer running balance and deposit history on top of it.
 */
import { create } from "zustand";
import { createRepository } from "./repositories/base-repository";
import { useLedger } from "./ledger-store";
import { useMaterialVault } from "./material-vault-store";
import { fetchCustomerGoldDeposits } from "./custody-flow-query";

export interface CustomerGoldDeposit {
  id: string;
  createdAt: number;
  customerId: string;
  customerName: string;
  /** Configurable precious metal; legacy deposits default to Gold. */
  metal?: string;
  grossMg: number;
  purity: number;
  fineMg: number;
  notes?: string;
  ledgerRef: string;
  /** Fine mg of this specific deposit already drawn against orders — never exceeds fineMg. */
  utilizedFineMg: number;
}

interface CustomerGoldDepositState {
  deposits: CustomerGoldDeposit[];
  refresh: () => Promise<void>;
  deposit: (input: {
    customerId: string;
    customerName: string;
    grossMg: number;
    purity: number;
    fineMg: number;
    metal?: string;
    notes?: string;
  }) => Promise<CustomerGoldDeposit>;
  /** Draws down a customer's deposited-gold balance against an order/manufacturing bill. */
  utilize: (customerId: string, fineMg: number, reference: string) => Promise<void>;
  /** Sum of undrawn fine gold this customer still has on deposit. */
  balanceFor: (customerId: string, metal?: string) => number;
}

const depositRepository = createRepository<CustomerGoldDeposit>("customer_gold_deposits");

function makeId(): string {
  return `cgd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useCustomerGoldDeposit = create<CustomerGoldDepositState>()((set, get) => ({
  deposits: [],
  refresh: async () => {
    set({ deposits: await fetchCustomerGoldDeposits() });
  },
  deposit: async (input) => {
    const id = makeId();
    const metal = input.metal ?? "Gold";
    const entry =
      metal === "Gold"
        ? await useLedger.getState().append({
            type: "customer_gold_received",
            netFineMg: input.fineMg,
            deltas: { vault: input.fineMg },
            grossMg: input.grossMg,
            purity: input.purity as any,
            fineMg: input.fineMg,
            reference: id,
            notes: `Gold deposit from ${input.customerName}${input.notes ? `: ${input.notes}` : ""}`,
          })
        : await useMaterialVault.getState().append({
            category: "raw_gold",
            metal,
            ownership: "customer",
            type: "purchase",
            deltaMg: input.grossMg,
            grossMg: input.grossMg,
            purity: input.purity,
            reference: id,
            remarks: `Customer ${metal} deposit from ${input.customerName}${input.notes ? `: ${input.notes}` : ""}`,
            actorId: null,
            actorEmail: null,
          });
    const record: CustomerGoldDeposit = {
      id,
      createdAt: Date.now(),
      customerId: input.customerId,
      customerName: input.customerName,
      metal,
      grossMg: input.grossMg,
      purity: input.purity,
      fineMg: input.fineMg,
      notes: input.notes,
      ledgerRef: entry.id,
      utilizedFineMg: 0,
    };
    await depositRepository.save(record);
    await get().refresh();
    return record;
  },
  utilize: async (customerId, fineMg, reference) => {
    const available = get().balanceFor(customerId);
    if (fineMg > available) {
      throw new Error(
        `Cannot use ${fineMg}mg from customer's deposited gold — only ${available}mg still available.`,
      );
    }
    // Oldest-deposit-first drawdown, mirroring standard FIFO stock costing —
    // ownership of any SPECIFIC deposit isn't distinguished by the customer
    // (it's their gold either way), only the total balance matters.
    let remaining = fineMg;
    const deposits = [...get().deposits]
      .filter((d) => d.customerId === customerId && d.utilizedFineMg < d.fineMg)
      .sort((a, b) => a.createdAt - b.createdAt);
    for (const d of deposits) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, d.fineMg - d.utilizedFineMg);
      await depositRepository.save({ ...d, utilizedFineMg: d.utilizedFineMg + take });
      remaining -= take;
    }
    await get().refresh();
    void reference; // kept for future audit-log linkage when this is wired to an order/bill
  },
  balanceFor: (customerId, metal) => {
    return get()
      .deposits.filter(
        (d) => d.customerId === customerId && (!metal || (d.metal ?? "Gold") === metal),
      )
      .reduce((sum, d) => sum + (d.fineMg - d.utilizedFineMg), 0);
  },
}));
