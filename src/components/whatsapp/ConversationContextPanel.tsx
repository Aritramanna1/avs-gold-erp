import { Link } from "@tanstack/react-router";
import { useWhatsAppInboxStore } from "@/lib/comm/whatsapp/whatsapp-inbox-store";
import { usePeople } from "@/lib/people-store";
import { useBilling } from "@/lib/billing-store";
import { useOrders } from "@/lib/orders-store";
import { paiseToRupees } from "@/lib/billing-store";
import { getPartyGoldBalance, getPartyCashBalance } from "@/lib/customer-account-ledger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mgToGrams } from "@/lib/gold";

export function ConversationContextPanel() {
  const { selectedId, conversations } = useWhatsAppInboxStore();
  const conv = conversations.find((c) => c.id === selectedId);
  const people = usePeople((s) => s.people);
  const invoices = useBilling((s) => s.invoices);
  const orders = useOrders((s) => s.orders);

  if (!conv) {
    return (
      <div className="border-l border-border p-4 text-xs text-muted-foreground hidden lg:block">
        Party context
      </div>
    );
  }

  const party = conv.partyId
    ? people.find((p) => p.id === conv.partyId)
    : people.find((p) =>
        p.phone?.replace(/\D/g, "").endsWith(conv.contactPhone.replace(/\D/g, "").slice(-10)),
      );

  const partyInvoices = party ? invoices.filter((i) => i.customerId === party.id).slice(0, 3) : [];
  const partyOrders = party ? orders.filter((o) => o.customerId === party.id).slice(0, 3) : [];

  const goldBal = party ? getPartyGoldBalance(party.id) : null;
  const cashBal = party ? getPartyCashBalance(party.id) : null;

  return (
    <div className="border-l border-border bg-muted/10 p-3 space-y-3 hidden lg:block overflow-y-auto">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        CRM / Party Context
      </h3>

      {party ? (
        <>
          <div>
            <p className="font-medium text-sm">{party.fullName}</p>
            <p className="text-xs text-muted-foreground">{party.phone}</p>
            <Badge variant="outline" className="mt-1 text-[10px]">
              {party.type}
            </Badge>
          </div>
          {goldBal != null && (
            <p className="text-xs">
              Gold balance:{" "}
              <strong>{mgToGrams(goldBal.outstandingFineMg)} g fine outstanding</strong>
            </p>
          )}
          {cashBal != null && cashBal.outstandingPaise !== 0 && (
            <p className="text-xs">
              Cash outstanding:{" "}
              <strong>₹ {paiseToRupees(Math.abs(cashBal.outstandingPaise))}</strong>
            </p>
          )}
          <Button size="sm" variant="outline" className="w-full" asChild>
            <Link to="/people/$id" params={{ id: party.id }}>
              Open Party 360
            </Link>
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Unknown contact — link to Party or create CRM lead from this conversation.
        </p>
      )}

      {partyInvoices.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Recent Invoices</p>
          <ul className="space-y-1">
            {partyInvoices.map((inv) => (
              <li key={inv.id} className="text-xs">
                <Link
                  to="/billing/$id"
                  params={{ id: inv.id }}
                  className="text-gold hover:underline"
                >
                  {inv.invoiceNo}
                </Link>
                {" — "}₹ {paiseToRupees(inv.grandTotalPaise)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {partyOrders.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Orders</p>
          <ul className="space-y-1">
            {partyOrders.map((o) => (
              <li key={o.id} className="text-xs">
                <Link to="/orders/$id" params={{ id: o.id }} className="text-gold hover:underline">
                  {o.orderNo}
                </Link>
                {" — "}
                {o.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground">Labels</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {(conv.labels ?? []).map((l) => (
            <Badge key={l} variant="secondary" className="text-[10px]">
              {l}
            </Badge>
          ))}
          {conv.labels.length === 0 && (
            <span className="text-[10px] text-muted-foreground">No labels</span>
          )}
        </div>
      </div>
    </div>
  );
}
