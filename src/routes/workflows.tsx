import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/workflows")({
  head: () => ({
    meta: [
      {
        title: "Jewellery ERP Workflows — AVS ERP",
        description:
          "Master → Transaction → Ledger → Stock → Billing → Reports — how AVS ERP runs jewellery manufacturing.",
      },
    ],
  }),
  component: WorkflowsPage,
});

const STEPS = [
  {
    title: "Master data",
    body: "Parties (customer, karigar, supplier), purity grades, alloy formulas, document numbering, barcode profiles, and print templates.",
  },
  {
    title: "Transactions",
    body: "Gold Vault in/out, karigar issue and return, melt, metal conversion, manufacturing job cards, outside work, and ready-stock entry.",
  },
  {
    title: "Ledger & khata",
    body: "Every fine-metal post hits the Gold Vault ledger. Balances are derived from approved movements — never a parallel editable stock of fine gold.",
  },
  {
    title: "Stock & tags",
    body: "Ready-stock items carry GW, NW, optional Dia Pcs, and HUID as separate text. Symbology is Code128 by default; EAN-13 / GS1 DataMatrix when a GS1 company prefix is configured.",
  },
  {
    title: "Billing & settlement",
    body: "Manufacturing invoices, GST documents, gold settlement, and cash/gold isolation — printed through the Universal Print Engine.",
  },
  {
    title: "Reports & audit",
    body: "Gold position, vault reconciliation, worker books, and the ERP Audit Report (PASS / FAIL / BLOCKED with evidence).",
  },
];

function WorkflowsPage() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-3xl px-4 py-14 space-y-10">
        <header className="space-y-3">
          <h1 className="font-serif text-4xl">Jewellery ERP workflows</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            AVS ERP follows the factory path shops already understand. The product explains itself
            before you sign up — here is the sequence.
          </p>
        </header>
        <ol className="space-y-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid gap-2 sm:grid-cols-[3rem_1fr]">
              <span className="font-serif text-3xl text-amber-800/70">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h2 className="font-serif text-xl">{s.title}</h2>
                <p className="mt-1 text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          Next:{" "}
          <Link className="underline underline-offset-2" to="/solutions/inventory">
            Gold &amp; material
          </Link>
          {" · "}
          <Link className="underline underline-offset-2" to="/solutions/hardware">
            Hardware
          </Link>
          {" · "}
          <Link className="underline underline-offset-2" to="/solutions/security">
            Multi-tenant security
          </Link>
        </p>
      </div>
    </MarketingLayout>
  );
}
