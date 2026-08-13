/**
 * Clears every business-data store's in-memory runtime cache on sign-out, so
 * a previous user's orders/invoices/ledger/customer
 * data can never flash on screen for the next person who logs in on the
 * same device before the fresh post-login pull (data-loader.ts) completes.
 * These same reset() actions previously only ran from the DEV-only
 * test-seed helper — never wired into the real sign-out path. Dynamic
 * imports keep this off the hot/initial bundle path since it only runs on
 * sign-out.
 */
import { useSettlements } from "@/lib/settlement-store";
import { useWorkers } from "@/lib/workers-store";

export async function resetAllBusinessStores(): Promise<void> {
  const [
    { usePeople },
    { useOrders },
    { useJobCards },
    { useStock },
    { useBilling },
    { useRepairs },
    { useRateCuts },
    { useDailyCloses },
    { useLedger },
    { useWhatsapp },
    { usePrintLog },
    { useWorkerGoldBook },
    { useWorkerReturns },
    { usePolishing },
    { useOutsideWork },
    { useOutsideWorkLabour },
    { useMaterialVault },
    { useManufacturingBarcodes },
    { useMeltStore },
    { useCommLog },
    { useGoldSettlement },
    { useLotBatches },
    { useStoneTracking },
    { useCreditNotes, useDebitNotes, useEstimates, useDeliveryChallans },
  ] = await Promise.all([
    import("@/lib/people-store"),
    import("@/lib/orders-store"),
    import("@/lib/jobcards-store"),
    import("@/lib/stock-store"),
    import("@/lib/billing-store"),
    import("@/lib/repair-store"),
    import("@/lib/ratecut-store"),
    import("@/lib/dailyclose-store"),
    import("@/lib/ledger-store"),
    import("@/lib/whatsapp-store"),
    import("@/lib/printlog-store"),
    import("@/lib/worker-gold-book-store"),
    import("@/lib/worker-return-store"),
    import("@/lib/polishing-store"),
    import("@/lib/outside-work-store"),
    import("@/lib/outside-work-labour-store"),
    import("@/lib/material-vault-store"),
    import("@/lib/manufacturing-barcode-store"),
    import("@/lib/melt-store"),
    import("@/lib/comm-log-store"),
    import("@/lib/gold-settlement-store"),
    import("@/lib/lot-batch-store"),
    import("@/lib/stone-tracking-store"),
    import("@/lib/billing-documents-store"),
  ]);

  usePeople.getState().reset();
  useOrders.getState().reset();
  useJobCards.getState().reset();
  useStock.setState({ items: [], movements: [] });
  useBilling.getState().reset();
  useRepairs.getState().reset();
  useRateCuts.getState().reset();
  useDailyCloses.getState().reset();
  useLedger.getState().reset();
  useWhatsapp.getState().reset();
  usePrintLog.getState().reset();
  useWorkers.getState().reset();
  useWorkerGoldBook.getState().reset();
  useWorkerReturns.getState().reset();
  usePolishing.getState().reset();
  useOutsideWork.getState().reset();
  useOutsideWorkLabour.getState().reset();
  useMaterialVault.getState().reset();
  useManufacturingBarcodes.getState().reset();
  useMeltStore.getState().reset();
  useSettlements.getState().reset();
  useCommLog.getState().reset();
  useGoldSettlement.getState().reset();
  useLotBatches.getState().reset();
  useStoneTracking.getState().reset();
  useCreditNotes.getState().reset();
  useDebitNotes.getState().reset();
  useEstimates.getState().reset();
  useDeliveryChallans.getState().reset();
}
