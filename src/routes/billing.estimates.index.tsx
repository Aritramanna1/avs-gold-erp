import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Estimate, useEstimates } from "@/lib/billing-documents-store";
import type { Person } from "@/lib/people-store";
import { paiseToRupees } from "@/lib/billing-store";
import { fetchActiveCustomerOptions, fetchEstimates } from "@/lib/billing-documents-query";
import { FileText, Plus, Printer, Search, X } from "lucide-react";

export const Route = createFileRoute("/billing/estimates/")({
  head: () => ({ meta: [{ title: "Estimates · AVS Gold ERP" }] }),
  component: EstimatesIndex,
});

function EstimatesIndex() {
  const create = useEstimates((s) => s.create);
  const cancel = useEstimates((s) => s.cancel);
  const convert = useEstimates((s) => s.convertToInvoice);
  const [query, setQuery] = useState("");
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [validDays, setValidDays] = useState("7");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([fetchEstimates(query), fetchActiveCustomerOptions()])
      .then(([nextEstimates, nextPeople]) => {
        if (!live) return;
        setEstimates(nextEstimates);
        setPeople(nextPeople);
      })
      .catch((error: any) => {
        if (!live) return;
        setLoadError(error?.message ?? "Could not load estimates.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [query]);
  const rows = useMemo(
    () =>
      estimates.filter((e) =>
        `${e.estimateNo} ${e.customerName}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [estimates, query],
  );
  async function save() {
    const customer = people.find((p) => p.id === customerId);
    const total = Math.round(Number(amount) * 100);
    if (!customer || !description.trim() || !Number.isFinite(total) || total <= 0) {
      setMessage("Choose a customer and enter a valid amount.");
      return;
    }
    const item = {
      id: `estimate-item-${Date.now()}`,
      itemName: description.trim(),
      category: "Jewellery",
      purity: 0,
      grossMg: 0,
      netMg: 0,
      fineMg: 0,
      goldRatePerGramPaise: 0,
      goldValuePaise: 0,
      makingChargesPaise: total,
      stoneChargesPaise: 0,
      hallmarkChargesPaise: 0,
      otherChargesPaise: 0,
      discountPaise: 0,
      lineTotalPaise: total,
      chargeMode: "job_work" as const,
    };
    const created = await create({
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      items: [item],
      gst: "none",
      subtotalPaise: total,
      gstPaise: 0,
      grandTotalPaise: total,
      validUntilIso: new Date(Date.now() + Number(validDays || 7) * 86400000).toISOString(),
      branchId: undefined,
      notes: "Estimate / quotation — not a tax invoice.",
    });
    setEstimates((current) => [
      created,
      ...current.filter((estimate) => estimate.id !== created.id),
    ]);
    setShowNew(false);
    setDescription("");
    setAmount("");
    setMessage("Estimate saved.");
  }
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        title="Estimates & quotations"
        subtitle="Create a clear quote, print it, or convert it into an invoice."
        actions={
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New estimate
          </Button>
        }
      />
      {message && <p className="mb-4 border border-border bg-card p-3 text-sm">{message}</p>}
      {showNew && (
        <div className="mb-6 border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl">New estimate</h2>
            <Button size="icon" variant="ghost" onClick={() => setShowNew(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Customer
              <select
                className="mt-1 w-full rounded-md border bg-background p-2"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select customer</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Valid for days
              <input
                className="mt-1 w-full rounded-md border bg-background p-2"
                inputMode="numeric"
                value={validDays}
                onChange={(e) => setValidDays(e.target.value)}
              />
            </label>
            <label className="text-sm md:col-span-2">
              Description
              <input
                className="mt-1 w-full rounded-md border bg-background p-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 22K necklace making and stone setting"
              />
            </label>
            <label className="text-sm">
              Quoted amount (₹)
              <input
                className="mt-1 w-full rounded-md border bg-background p-2"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </label>
          </div>
          <Button className="mt-4" onClick={() => void save()}>
            Save estimate
          </Button>
        </div>
      )}
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search estimate or customer"
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {loadError ? (
          <div className="p-8 text-center text-sm">
            <p className="text-destructive">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void fetchEstimates(query).then(setEstimates)}
            >
              Retry
            </Button>
          </div>
        ) : loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading estimates...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Estimate</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Valid until</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs text-gold">{e.estimateNo}</td>
                  <td className="p-3">
                    {e.customerName}
                    <div className="text-xs text-muted-foreground">{e.customerPhone}</div>
                  </td>
                  <td className="p-3">
                    {e.validUntilIso ? new Date(e.validUntilIso).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3 text-right">₹ {paiseToRupees(e.grandTotalPaise)}</td>
                  <td className="p-3">{e.status}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Link to="/billing/estimate/$id" params={{ id: e.id }}>
                        <Button size="sm" variant="outline">
                          <Printer className="h-4 w-4" />
                        </Button>
                      </Link>
                      {e.status === "draft" && (
                        <>
                          <Button
                            size="sm"
                            onClick={async () => {
                              const result = await convert(e.id);
                              if (result) {
                                setEstimates((current) =>
                                  current.map((estimate) =>
                                    estimate.id === e.id
                                      ? {
                                          ...estimate,
                                          status: "converted",
                                          convertedToInvoiceId: result.invoiceId,
                                          updatedAt: Date.now(),
                                        }
                                      : estimate,
                                  ),
                                );
                              }
                            }}
                          >
                            Convert
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await cancel(e.id);
                              setEstimates((current) =>
                                current.map((estimate) =>
                                  estimate.id === e.id
                                    ? { ...estimate, status: "cancelled", updatedAt: Date.now() }
                                    : estimate,
                                ),
                              );
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !loadError && rows.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">No estimates yet.</p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        An estimate is not a tax invoice. Final GST tax details are applied when the invoice is
        issued.
      </p>
    </div>
  );
}
