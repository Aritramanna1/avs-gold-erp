/**
 * Unified Print Engine — data-source reactivity bridge.
 *
 * Every data-mapper builder (data-mapper.ts, invoice-data.ts,
 * ledger-statements-data.ts) reads its source stores via bare
 * `.getState()` snapshots inside a plain function, not React hooks —
 * necessary because a single builder often reads several different
 * stores (e.g. buildInvoicePrintData reads useAttachments, useCatalog,
 * and useStock) and React's rules of hooks don't let a function
 * conditionally call a different fixed set of hooks per doc type.
 *
 * The cost: `resolvePrintContext()` on its own returns a plain snapshot,
 * so calling it directly in a component body (as PrintEngine.tsx does)
 * only reads store state as of THAT render. If a source store updates
 * afterward — most commonly data-loader.ts's pullBackground() finishing
 * a background Supabase pull moments after a print route's first mount —
 * nothing tells the component to look again, and the document stays
 * permanently rendered with incomplete data (not just briefly stale) for
 * the rest of that session. This isn't a slow-render/timing issue; it's a
 * genuine missing subscription, and it's architecture-wide: it affects
 * every doc type whose builder reads a store slower to hydrate than the
 * record itself, not just one document.
 *
 * `usePrintDataSourcesTick()` is the fix: it subscribes to every store any
 * builder currently reads and returns a value that changes whenever any
 * of them updates. PrintEngine re-derives `resolvePrintContext()` off this
 * tick (see PrintEngine.tsx), so once background hydration completes for
 * a relevant store, the document re-renders with the now-complete data.
 *
 * Maintenance note: when a new data-mapper builder starts reading a store
 * not already listed in DATA_SOURCE_STORES below, add it here too —
 * otherwise that store's late hydration will silently reproduce this same
 * staleness for the new doc type.
 */
import { useEffect, useState } from "react";
import {
  useCreditNotes,
  useDebitNotes,
  useEstimates,
  useDeliveryChallans,
} from "@/lib/billing-documents-store";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { usePeople } from "@/lib/people-store";
import { useAttachments } from "@/lib/attachments-store";
import { useCatalog } from "@/lib/catalog-store";
import { useStock } from "@/lib/stock-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useLedger } from "@/lib/ledger-store";
import { useMoneyVoucherStore } from "@/lib/money-voucher";
import { useJobCards } from "@/lib/jobcards-store";
import { useMfgBills } from "@/lib/manufacturing-bill-store";
import { useWorkers } from "@/lib/workers-store";

interface Subscribable {
  subscribe: (listener: () => void) => () => void;
}

const DATA_SOURCE_STORES: Subscribable[] = [
  useCreditNotes,
  useDebitNotes,
  useEstimates,
  useDeliveryChallans,
  useBilling,
  useOrders,
  usePeople,
  useAttachments,
  useCatalog,
  useStock,
  useWorkerGoldBook,
  useGoldSettlement,
  useLedger,
  useMoneyVoucherStore,
  useJobCards,
  useMfgBills,
  useWorkers,
];

export function usePrintDataSourcesTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsubscribes = DATA_SOURCE_STORES.map((store) =>
      store.subscribe(() => setTick((t) => t + 1)),
    );
    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);
  return tick;
}
