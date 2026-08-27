import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  verifyPayload,
  payloadFor,
  parsePayload,
  type VerifyOutcome,
  type ParsedPayload,
} from "@/lib/verify-token";
import { usePrintLog, PRINT_DOC_LABELS, type PrintDocType } from "@/lib/printlog-store";
import { useOrders } from "@/lib/orders-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useBilling } from "@/lib/billing-store";
import { useRepairs } from "@/lib/repair-store";
import { usePeople } from "@/lib/people-store";
import { useStock } from "@/lib/stock-store";
import { useDailyCloses } from "@/lib/dailyclose-store";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useWorkers } from "@/lib/workers-store";
import { useRateCuts } from "@/lib/ratecut-store";
import {
  findReceiptRecordById,
  findReceiptRecordByNumber,
  type ReceiptRecord,
} from "@/lib/services/receipt-record-service";
import { consumePublicRateLimitAsync } from "@/lib/public-rate-limit";
import {
  ArrowLeft,
  CheckCircle2,
  Scan,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Camera,
  ClipboardPaste,
  StopCircle,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/verify")({
  head: () => ({ meta: [{ title: "Verify Receipt · AVS Gold ERP" }] }),
  component: VerifyPage,
});

function registerReceiptRecord(record: ReceiptRecord): boolean {
  const item = record.data as any;
  const id = item.id;
  if (!id) return false;
  switch (record.table) {
    case "orders":
      if (!useOrders.getState().orders.some((row) => row.id === id))
        useOrders.setState({ orders: [...useOrders.getState().orders, item] });
      return true;
    case "job_cards":
      if (!useJobCards.getState().jobs.some((row) => row.id === id))
        useJobCards.setState({ jobs: [...useJobCards.getState().jobs, item] });
      return true;
    case "invoices":
      if (!useBilling.getState().invoices.some((row) => row.id === id))
        useBilling.setState({ invoices: [...useBilling.getState().invoices, item] });
      return true;
    case "repairs":
      if (!useRepairs.getState().repairs.some((row) => row.id === id))
        useRepairs.setState({ repairs: [...useRepairs.getState().repairs, item] });
      return true;
    case "daily_close":
      if (!useDailyCloses.getState().closes.some((row) => row.id === id))
        useDailyCloses.setState({ closes: [...useDailyCloses.getState().closes, item] });
      return true;
    case "inventory":
      if (!useStock.getState().items.some((row) => row.id === id))
        useStock.setState({ items: [...useStock.getState().items, item] });
      return true;
    case "people":
      if (!usePeople.getState().people.some((row) => row.id === id))
        usePeople.setState({ people: [...usePeople.getState().people, item] });
      return true;
    case "gold_settlements":
      if (!useGoldSettlement.getState().settlements.some((row: any) => row.id === id))
        useGoldSettlement.setState({
          settlements: [...useGoldSettlement.getState().settlements, item],
        });
      return true;
    case "worker_settlements":
      if (!useWorkers.getState().settlements.some((row) => row.id === id))
        useWorkers.setState({ settlements: [...useWorkers.getState().settlements, item] });
      return true;
    case "worker_transactions": {
      const state = useWorkers.getState();
      const kind = record.kind ?? item.kind;
      if (kind === "withdrawal" && !state.withdrawals.some((row) => row.id === id))
        useWorkers.setState({ withdrawals: [...state.withdrawals, item] });
      else if (kind === "loan" && !state.loans.some((row) => row.id === id))
        useWorkers.setState({ loans: [...state.loans, item] });
      else if (kind === "salary_advance" && !state.advances.some((row) => row.id === id))
        useWorkers.setState({ advances: [...state.advances, item] });
      else if (kind === "gold_advance" && !state.goldAdvances.some((row) => row.id === id))
        useWorkers.setState({ goldAdvances: [...state.goldAdvances, item] });
      else if (kind === "wastage_return" && !state.wastageReturns.some((row) => row.id === id))
        useWorkers.setState({ wastageReturns: [...state.wastageReturns, item] });
      return true;
    }
    case "rate_cut_records":
      if (!useRateCuts.getState().records.some((row) => row.id === id))
        useRateCuts.setState({ records: [...useRateCuts.getState().records, item] });
      return true;
    default:
      return false;
  }
}

async function fetchAndRegisterLiveRecord(docType: PrintDocType, id: string): Promise<boolean> {
  const record = await findReceiptRecordById(docType, id);
  if (!record) return false;
  return registerReceiptRecord(record);
  /* Historical direct-cloud fallback removed from execution; retained in this
     comment during the Version 1 audit for traceability.
  try {
    switch (docType) {
      case "order_slip":
      case "gold_receipt":
      case "old_gold_receipt":
      case "advance_receipt": {
        const { data } = await supabase.from("orders").select("data").eq("id", id).maybeSingle();
        if (data?.data) {
          const orders = useOrders.getState().orders;
          if (!orders.some((o) => o.id === id)) {
            useOrders.setState({ orders: [...orders, data.data as any] });
          }
          return true;
        }
        break;
      }
      case "job_card":
      case "gold_issue_slip":
      case "gold_receive_slip":
      case "filings_receipt": {
        const { data } = await supabase.from("job_cards").select("data").eq("id", id).maybeSingle();
        if (data?.data) {
          const jobs = useJobCards.getState().jobs;
          if (!jobs.some((j) => j.id === id)) {
            useJobCards.setState({ jobs: [...jobs, data.data as any] });
          }
          return true;
        }
        break;
      }
      case "gst_invoice":
      case "retail_invoice":
      case "payment_receipt": {
        const { data } = await supabase.from("invoices").select("data").eq("id", id).maybeSingle();
        if (data?.data) {
          const invoices = useBilling.getState().invoices;
          if (!invoices.some((i) => i.id === id)) {
            useBilling.setState({ invoices: [...invoices, data.data as any] });
          }
          return true;
        }
        break;
      }
      case "repair_receipt":
      case "repair_delivery_slip":
      case "repair_invoice":
      case "polishing_receipt": {
        const { data } = await supabase.from("repairs").select("data").eq("id", id).maybeSingle();
        if (data?.data) {
          const repairs = useRepairs.getState().repairs;
          if (!repairs.some((r) => r.id === id)) {
            useRepairs.setState({ repairs: [...repairs, data.data as any] });
          }
          return true;
        }
        break;
      }

      case "daily_close_report": {
        const { data } = await supabase
          .from("daily_close")
          .select("data")
          .eq("id", id)
          .maybeSingle();
        if (data?.data) {
          const closes = useDailyCloses.getState().closes;
          if (!closes.some((c) => c.id === id)) {
            useDailyCloses.setState({ closes: [...closes, data.data as any] });
          }
          return true;
        }
        break;
      }
      case "jewellery_tag": {
        const { data } = await supabase.from("inventory").select("data").eq("id", id).maybeSingle();
        if (data?.data) {
          const items = useStock.getState().items;
          if (!items.some((i) => i.id === id)) {
            useStock.setState({ items: [...items, data.data as any] });
          }
          return true;
        }
        break;
      }
      case "worker_kyc": {
        const { data } = await supabase.from("people").select("data").eq("id", id).maybeSingle();
        if (data?.data) {
          const people = usePeople.getState().people;
          if (!people.some((p) => p.id === id)) {
            usePeople.setState({ people: [...people, data.data as any] });
          }
          return true;
        }
        break;
      }
      case "gold_settlement": {
        const { data } = await (supabase as any)
          .from("gold_settlements")
          .select("data")
          .eq("id", id)
          .maybeSingle();
        if (data?.data) {
          const settlements = useGoldSettlement.getState().settlements;
          if (!settlements.some((s: any) => s.id === id)) {
            useGoldSettlement.setState({ settlements: [...settlements, data.data as any] });
          }
          return true;
        }
        break;
      }
      case "home_settlement_slip": {
        const { data } = await supabase
          .from("worker_settlements")
          .select("data")
          .eq("id", id)
          .maybeSingle();
        if (data?.data) {
          const settlements = useWorkers.getState().settlements;
          if (!settlements.some((s) => s.id === id)) {
            useWorkers.setState({ settlements: [...settlements, data.data as any] });
          }
          return true;
        }
        break;
      }
      case "gold_advance_slip":
      case "wastage_return_receipt":
      case "loan_slip":
      case "withdrawal_slip": {
        const { data } = await supabase
          .from("worker_transactions")
          .select("data, kind")
          .eq("id", id)
          .maybeSingle();
        if (data?.data) {
          const payload = data.data as any;
          const workersState = useWorkers.getState();
          if (data.kind === "withdrawal") {
            if (!workersState.withdrawals.some((x) => x.id === id)) {
              useWorkers.setState({ withdrawals: [...workersState.withdrawals, payload] });
            }
          } else if (data.kind === "loan") {
            if (!workersState.loans.some((x) => x.id === id)) {
              useWorkers.setState({ loans: [...workersState.loans, payload] });
            }
          } else if (data.kind === "salary_advance") {
            if (!workersState.advances.some((x) => x.id === id)) {
              useWorkers.setState({ advances: [...workersState.advances, payload] });
            }
          } else if (data.kind === "gold_advance") {
            if (!workersState.goldAdvances.some((x) => x.id === id)) {
              useWorkers.setState({ goldAdvances: [...workersState.goldAdvances, payload] });
            }
          } else if (data.kind === "wastage_return") {
            if (!workersState.wastageReturns.some((x) => x.id === id)) {
              useWorkers.setState({ wastageReturns: [...workersState.wastageReturns, payload] });
            }
          }
          return true;
        }
        break;
      }
    }
  } catch (err) {
    console.error("[verify] Error doing live database backup fetch:", err);
  }
  return false; */
}

async function findAndRegisterLiveRecordByDocNo(code: string): Promise<boolean> {
  const cleanCode = code.trim();
  const record = await findReceiptRecordByNumber(cleanCode);
  if (!record) return false;
  return registerReceiptRecord(record);
  /* Historical direct-cloud fallback removed from execution.
  try {
    // 1. Check job_cards by jobNo
    {
      const { data } = await supabase
        .from("job_cards")
        .select("data")
        .eq("job_no", cleanCode)
        .limit(1);
      if (data && data.length > 0) {
        const item = data[0].data as any;
        const jobs = useJobCards.getState().jobs;
        if (!jobs.some((j) => j.id === item.id)) {
          useJobCards.setState({ jobs: [...jobs, item] });
        }
        return true;
      }
    }
    // 2. Check orders by orderNo
    {
      const { data } = await supabase
        .from("orders")
        .select("data")
        .eq("order_no", cleanCode)
        .limit(1);
      if (data && data.length > 0) {
        const item = data[0].data as any;
        const orders = useOrders.getState().orders;
        if (!orders.some((o) => o.id === item.id)) {
          useOrders.setState({ orders: [...orders, item] });
        }
        return true;
      }
    }
    // 3. Check invoices by invoiceNo
    {
      const { data } = await supabase
        .from("invoices")
        .select("data")
        .eq("invoice_no", cleanCode)
        .limit(1);
      if (data && data.length > 0) {
        const item = data[0].data as any;
        const invoices = useBilling.getState().invoices;
        if (!invoices.some((i) => i.id === item.id)) {
          useBilling.setState({ invoices: [...invoices, item] });
        }
        return true;
      }
    }
    // 4. Check repairs by repairNo
    {
      const { data } = await supabase
        .from("repairs")
        .select("data")
        .eq("repair_no", cleanCode)
        .limit(1);
      if (data && data.length > 0) {
        const item = data[0].data as any;
        const repairs = useRepairs.getState().repairs;
        if (!repairs.some((r) => r.id === item.id)) {
          useRepairs.setState({ repairs: [...repairs, item] });
        }
        return true;
      }
    }
    // 5. Check rate_cut_records by slipNo
    {
      const { data } = await supabase
        .from("rate_cut_records")
        .select("data")
        .eq("rate_cut_no", cleanCode)
        .limit(1);
      if (data && data.length > 0) {
        const item = data[0].data as any;
        const records = useRateCuts.getState().records;
        if (!records.some((rc) => rc.id === item.id)) {
          useRateCuts.setState({ records: [...records, item] });
        }
        return true;
      }
    }
  } catch (err) {
    console.error("[verify] Error finding live doc by number:", err);
  }
  return false; */
}

function lookupByDocNo(
  code: string,
): { docType: PrintDocType; docNumber: string; recordId: string; createdAt: number } | null {
  const cleanCode = code.trim();

  // 1. Check Job Cards
  const j = useJobCards.getState().jobs.find((x) => x.jobNo === cleanCode);
  if (j) return { docType: "job_card", docNumber: j.jobNo, recordId: j.id, createdAt: j.createdAt };

  // 2. Check Orders
  const o = useOrders.getState().orders.find((x) => x.orderNo === cleanCode);
  if (o)
    return { docType: "order_slip", docNumber: o.orderNo, recordId: o.id, createdAt: o.createdAt };

  // 3. Check GST / Retail Invoices
  const i = useBilling.getState().invoices.find((x) => x.invoiceNo === cleanCode);
  if (i)
    return {
      docType: "gst_invoice",
      docNumber: i.invoiceNo,
      recordId: i.id,
      createdAt: i.createdAt,
    };

  // 4. Check Repairs
  const r = useRepairs.getState().repairs.find((x) => x.repairNo === cleanCode);
  if (r)
    return {
      docType: "repair_receipt",
      docNumber: r.repairNo,
      recordId: r.id,
      createdAt: r.createdAt,
    };

  return null;
}

function VerifyPage() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<VerifyOutcome | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const events = usePrintLog((s) => s.events);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{
    detect: (el: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
  } | null>(null);

  // Public QR links: /verify?payload=AVS|... — works logged-out without ERP chrome.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("payload") || params.get("p");
    if (fromQuery) {
      void executeVerification(fromQuery);
    }
  }, []);

  async function executeVerification(codeParam: string) {
    if (!codeParam) return;
    const rl = await consumePublicRateLimitAsync("public:verify", {
      limit: 40,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      setError(`Too many verification attempts. Retry in ${Math.ceil(rl.retryAfterMs / 1000)}s.`);
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const cleanCode = codeParam.trim();
      if (/^(AVS|MTJ)\|/i.test(cleanCode)) {
        const parsed = parsePayload(cleanCode);
        if (parsed) {
          await fetchAndRegisterLiveRecord(parsed.docType, parsed.recordId);
        }
        setRaw(cleanCode);
        setResult(verifyPayload(cleanCode));
      } else {
        await findAndRegisterLiveRecordByDocNo(cleanCode);
        const matched = lookupByDocNo(cleanCode);
        if (matched) {
          const payload = payloadFor(matched);
          setRaw(payload);
          setResult(verifyPayload(payload));
        } else {
          setRaw(cleanCode);
          setResult({ ok: false, reason: "not_found" });
        }
      }
    } catch (e: any) {
      setError(e.message || "An error occurred during verification");
    } finally {
      setLoading(false);
    }
  }

  // Trigger instant verify if code is parsed from QR scan url parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code") || params.get("query") || "";
    if (codeParam) {
      executeVerification(codeParam);
    }
  }, []);

  useEffect(() => {
    if (!cameraActive) return;
    let cancelled = false;
    let raf = 0;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const BarcodeDetector = (window as any).BarcodeDetector;
        if (!BarcodeDetector) {
          setError("Camera scanning is not supported in this browser. Use paste fallback.");
          stopCamera();
          return;
        }
        detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
        loop();
      } catch (e) {
        setError("Could not access camera. Check permissions or use paste fallback.");
        stopCamera();
      }
    }

    async function loop() {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || !streamRef.current?.active) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          const value = barcodes[0].rawValue;
          setRaw(value);
          executeVerification(value);
          stopCamera();
          return;
        }
      } catch (e) {
        // ignore frame-level errors
      }
      raf = requestAnimationFrame(loop);
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      detectorRef.current = null;
    };
  }, [cameraActive]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current = null;
    setCameraActive(false);
  }

  function run() {
    if (!raw.trim()) return;
    executeVerification(raw);
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setRaw(text);
      executeVerification(text);
    } catch (e) {
      setError("Could not read clipboard. Paste manually.");
    }
  }

  function clear() {
    setRaw("");
    setResult(null);
    setError(null);
    stopCamera();
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/reports">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Reports
          </Button>
        </Link>
      </div>
      <PageHeader
        title="Verify Receipt"
        subtitle="Scan a QR code from any AVS printout, enter a document number (e.g. Order No, Invoice No), or paste the payload manually."
      />

      <div className="space-y-4">
        <div className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium">Scan with camera</h3>
            </div>
            <Button
              variant={cameraActive ? "destructive" : "default"}
              size="sm"
              onClick={cameraActive ? stopCamera : () => setCameraActive(true)}
              className="gap-2"
              disabled={loading}
            >
              {cameraActive ? (
                <>
                  <StopCircle className="h-4 w-4" /> Stop camera
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4" /> Start camera
                </>
              )}
            </Button>
          </div>

          {cameraActive && (
            <div className="mt-4">
              <video
                ref={videoRef}
                className="w-full rounded-lg border border-border bg-black aspect-video object-cover"
                muted
                playsInline
              />
              <p className="text-xs text-muted-foreground mt-2">
                Point the QR code at the camera. It will auto-verify once detected.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Or enter document number / paste payload</h3>
          </div>
          <Textarea
            data-testid="verify-qr-input"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="e.g. O-202606-001, I-202606-001, or full AVS|order_slip|... payload"
            className="font-mono text-xs min-h-[100px]"
            disabled={loading}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button data-testid="verify-submit" onClick={run} className="gap-2" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <Scan className="h-4 w-4" /> Verify
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={pasteFromClipboard}
              className="gap-2"
              disabled={loading}
            >
              <ClipboardPaste className="h-4 w-4" /> Paste from clipboard
            </Button>
            {raw && (
              <Button variant="ghost" onClick={clear} disabled={loading}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-8 flex flex-col items-center justify-center p-8 bg-card border border-border rounded-md gap-3 animate-pulse">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
          <p className="text-sm font-medium text-gold">Checking the secure ERP records...</p>
          <p className="text-xs text-muted-foreground">
            This guarantees real-time cryptographic integrity protection.
          </p>
        </div>
      )}

      {!loading && result && (
        <div className="mt-5">
          {result.ok ? (
            <ValidCard
              outcome={result}
              reprintCount={
                events.find(
                  (e) => e.docType === result.doc.docType && e.linkedId === result.doc.recordId,
                )?.reprintCount ?? 0
              }
            />
          ) : (
            <InvalidCard outcome={result} />
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-6">
        Paste-based verification works on every device. Camera scanning requires a browser that
        supports the Web BarcodeDetector API and camera access.
      </p>
    </div>
  );
}

function ValidCard({
  outcome,
  reprintCount,
}: {
  outcome: Extract<VerifyOutcome, { ok: true }>;
  reprintCount: number;
}) {
  const d = outcome.doc;
  return (
    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-300" />
        <h3 className="font-serif text-lg text-emerald-200">Valid document</h3>
        <Badge
          variant="outline"
          className="ml-auto bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
        >
          Verified
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Row k="Type" v={PRINT_DOC_LABELS[d.docType] ?? d.docType} />
        <Row k="Number" v={d.docNumber} />
        {d.customerName && <Row k="Customer" v={d.customerName} />}
        {d.linkedSummary && <Row k="Linked" v={d.linkedSummary} />}
        {d.createdAt && <Row k="Issued" v={new Date(d.createdAt).toLocaleString("en-IN")} />}
        <Row k="Reprint count" v={String(reprintCount)} />
      </dl>
      <div className="mt-3 flex items-center gap-2 text-xs text-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> Checksum matches ERP data.
      </div>
    </div>
  );
}

function InvalidCard({ outcome }: { outcome: Extract<VerifyOutcome, { ok: false }> }) {
  const msg =
    outcome.reason === "format"
      ? "Unknown format. This does not look like an AVS verification QR."
      : outcome.reason === "not_found"
        ? "Document not found in ERP. It may have been deleted or never existed on this device."
        : "Tampered: payload exists but checksum does not match current ERP data.";
  const Icon = outcome.reason === "tampered" ? ShieldX : ShieldAlert;
  return (
    <div className="rounded-md border border-red-500/40 bg-red-500/10 p-5">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-red-300" />
        <h3 className="font-serif text-lg text-red-200">
          {outcome.reason === "tampered"
            ? "Tampered / Mismatch"
            : outcome.reason === "not_found"
              ? "Document Not Found"
              : "Unknown format"}
        </h3>
      </div>
      <p className="text-sm text-red-100 mt-2">{msg}</p>
      {outcome.payload && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Row k="Type" v={PRINT_DOC_LABELS[outcome.payload.docType] ?? outcome.payload.docType} />
          <Row k="Number" v={outcome.payload.docNumber} />
        </dl>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/50 pb-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-right">{v}</span>
    </div>
  );
}
