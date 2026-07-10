import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useDebitNotes } from "@/lib/billing-documents-store";
import { paiseToRupees } from "@/lib/billing-store";
import { useSettings } from "@/lib/settings-store";
import { usePrintEngine } from "@/lib/print-engine";
import { useCan } from "@/lib/rbac";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Printer, Ban } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/billing/debit-notes/$id")({
  head: () => ({ meta: [{ title: "Debit Note · AVS Gold ERP" }] }),
  component: DebitNoteDetail,
});

function DebitNoteDetail() {
  const { id } = useParams({ from: "/billing/debit-notes/$id" });
  const notes = useDebitNotes((s) => s.notes);
  const refresh = useDebitNotes((s) => s.refresh);
  const cancel = useDebitNotes((s) => s.cancel);
  const { firm } = useSettings();
  const { triggerPrint } = usePrintEngine();
  const { can, email } = useCan();
  const note = notes.find((n) => n.id === id);

  useEffect(() => {
    if (notes.length === 0) refresh();
  }, [notes.length, refresh]);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!note) {
    return (
      <div className="p-8 max-w-3xl mx-auto text-center">
        <h1 className="font-serif text-2xl text-gold">Debit note not found</h1>
        <Link to="/billing/debit-notes" className="text-gold underline mt-4 inline-block">
          Back to Debit Notes
        </Link>
      </div>
    );
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      const { data } = await supabase.auth.getSession();
      await cancel(note!.id, {
        id: data.session?.user.id ?? null,
        email: data.session?.user.email ?? email ?? null,
      });
      toast.success("Debit note cancelled.");
      setCancelOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to cancel debit note.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 md:p-8 print:bg-white print:p-0">
      <div className="flex gap-2 mb-4 print:hidden flex-wrap">
        <Link to="/billing/debit-notes">
          <Button variant="ghost" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> All Debit Notes
          </Button>
        </Link>
        <Button
          onClick={() =>
            triggerPrint(
              `/billing/debit-note-print/${note.id}`,
              `Debit Note Preview · ${note.debitNoteNo}`,
            )
          }
          className="gap-1.5"
        >
          <Printer className="h-4 w-4" /> Print
        </Button>
        {note.status === "issued" && can("billing.delete") && (
          <Button variant="destructive" className="gap-1.5" onClick={() => setCancelOpen(true)}>
            <Ban className="h-4 w-4" /> Cancel Debit Note
          </Button>
        )}
      </div>

      <div
        className="bg-white text-neutral-900 shadow-lg rounded-lg mx-auto print:shadow-none print:rounded-none p-10"
        style={{ maxWidth: 794, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}
      >
        <div className="flex items-start justify-between border-b-4 border-amber-500 pb-4 mb-4">
          <div>
            <div className="text-xl font-bold text-amber-700">{firm.shopName.toUpperCase()}</div>
            {firm.address && <div className="text-xs text-neutral-500">{firm.address}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-amber-600">DEBIT NOTE</div>
            <div className="text-xs text-neutral-500 font-mono">{note.debitNoteNo}</div>
            <Badge variant={note.status === "issued" ? "outline" : "destructive"} className="mt-1">
              {note.status === "issued" ? "Issued" : "Cancelled"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div>
            <div className="text-xs uppercase text-neutral-400">Customer</div>
            <div className="font-medium">{note.customerName}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-neutral-400">Against Invoice</div>
            <div className="font-medium">{note.invoiceNo}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-neutral-400">Date</div>
            <div>{new Date(note.createdAt).toLocaleDateString("en-IN")}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-neutral-400">Amount</div>
            <div className="font-semibold text-amber-700">₹ {paiseToRupees(note.amountPaise)}</div>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase text-neutral-400 mb-1">Reason</div>
          <div className="text-sm border border-neutral-200 rounded-md p-3">{note.reason}</div>
        </div>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Debit Note {note.debitNoteNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This is recorded in the audit log and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Back</AlertDialogCancel>
            <AlertDialogAction disabled={cancelling} onClick={handleCancel}>
              {cancelling ? "Cancelling…" : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
