import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Download, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { guardRoute } from "@/lib/permissions";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SourceOfTruthBadge } from "@/components/ledger/SourceOfTruthBadge";
import { CompanyCashLedgerTable } from "@/components/ledger/CompanyCashLedgerTable";
import {
  compileCompanyCashLedger,
  companyCashLedgerOpeningPaise,
  companyCashLedgerToExportRows,
  listMoneySourceModules,
} from "@/lib/company-cash-ledger";
import { useMoneyVoucherStore } from "@/lib/money-voucher";
import type { UniversalMoneyEntry } from "@/lib/money-voucher";
import { fetchCompanyCashLedgerPage } from "@/lib/ledger-pagination";
import { useChartOfAccountsStore } from "@/lib/chart-of-accounts-store";
import { usePeople } from "@/lib/people-store";
import { paiseToRupees } from "@/lib/billing-store";
import {
  exportToCSV,
  exportToXLSX,
  rangeForPeriod,
  thisMonthRange,
  type DateRange,
  type ReportPeriod,
} from "@/lib/report-engine";
import { usePrintEngine } from "@/lib/print-engine";
import { useCustomizationHubPreferences } from "@/lib/customization-hub-preferences-store";
import { formatLedgerSourceLabel } from "@/lib/ledger-narration";
import { useLanguage } from "@/contexts/LanguageContext";

export const Route = createFileRoute("/treasury/cash-book")({
  validateSearch: z.object({ source: z.string().optional() }).parse,
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "Company Cash Book · AVS ERP" }] }),
  component: CompanyCashBookPage,
});

function CompanyCashBookPage() {
  const { t } = useLanguage();
  const { source: sourceFromUrl } = Route.useSearch();
  const hydrateMoney = useMoneyVoucherStore((s) => s.hydrate);
  const moneyLoading = useMoneyVoucherStore((s) => s.loading);
  const moneyEntries = useMoneyVoucherStore((s) => s.entries);
  const ensureCoA = useChartOfAccountsStore((s) => s.hydrate);
  const ledgerAccounts = useChartOfAccountsStore((s) => s.ledgerAccounts);
  const accounts = useMemo(
    () => ledgerAccounts.filter((a) => a.isCashOrBank && a.isActive),
    [ledgerAccounts],
  );
  const people = usePeople((s) => s.people);
  const defaultExport = useCustomizationHubPreferences((s) => s.reports.defaultExport);
  const { triggerPrint } = usePrintEngine();

  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [customRange, setCustomRange] = useState<DateRange>(thisMonthRange());
  const [accountId, setAccountId] = useState<string>("all");
  const [partyId, setPartyId] = useState<string>("all");
  const [source, setSource] = useState<string>(sourceFromUrl ?? "all");

  useEffect(() => {
    if (sourceFromUrl) setSource(sourceFromUrl);
  }, [sourceFromUrl]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [serverEntries, setServerEntries] = useState<UniversalMoneyEntry[] | null>(null);
  const [serverTotal, setServerTotal] = useState(0);
  const [pageOffset, setPageOffset] = useState(0);
  const pageSize = 200;

  useEffect(() => {
    void hydrateMoney();
    void ensureCoA();
  }, [hydrateMoney, ensureCoA]);

  const dateRange = useMemo(
    () => rangeForPeriod(period, customRange),
    [period, customRange],
  );

  const filters = useMemo(
    () => ({
      accountId: accountId === "all" ? undefined : accountId,
      partyId: partyId === "all" ? undefined : partyId,
      source: source === "all" ? undefined : source,
      dateRange,
      search: search.trim() || undefined,
    }),
    [accountId, partyId, source, dateRange, search],
  );

  useEffect(() => {
    setPageOffset(0);
  }, [accountId, partyId, source, dateRange.from, dateRange.to, search]);

  useEffect(() => {
    let cancelled = false;
    void fetchCompanyCashLedgerPage({
      accountId: accountId === "all" ? undefined : accountId,
      partyId: partyId === "all" ? undefined : partyId,
      source: source === "all" ? undefined : source,
      from: dateRange.from,
      to: dateRange.to,
      limit: pageSize,
      offset: pageOffset,
    })
      .then((res) => {
        if (!cancelled) {
          setServerEntries(res.rows);
          setServerTotal(res.total);
        }
      })
      .catch(() => {
        if (!cancelled) setServerEntries(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, partyId, source, dateRange, pageOffset, moneyEntries.length]);

  const rows = useMemo(
    () => compileCompanyCashLedger(filters, serverEntries ?? undefined),
    [filters, moneyEntries, accounts, serverEntries],
  );
  const openingPaise = useMemo(
    () => companyCashLedgerOpeningPaise(filters, serverEntries ?? undefined),
    [filters, moneyEntries, accounts, serverEntries],
  );

  const sourceModules = useMemo(() => listMoneySourceModules(), [moneyEntries]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await hydrateMoney();
      await ensureCoA();
    } finally {
      setRefreshing(false);
    }
  }

  function handleExport(format: "csv" | "xlsx") {
    const data = companyCashLedgerToExportRows(rows);
    if (format === "csv") exportToCSV("company-cash-book.csv", data);
    else exportToXLSX("company-cash-book.xlsx", { "Cash Book": data });
  }

  return (
    <div
      data-testid="print-layout-root"
      className="p-4 md:p-8 max-w-7xl mx-auto print:p-0"
    >
      <PageHeader
        title={t("books.cashBookTitle")}
        subtitle={t("books.cashBookSubtitle")}
        actions={
          <div className="flex flex-wrap gap-2 no-print items-center">
            <SourceOfTruthBadge variant="ledger" />
            <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing || moneyLoading}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {refreshing ? t("books.cashBookRefreshing") : t("books.cashBookRefresh")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport(defaultExport === "csv" ? "csv" : "xlsx")}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> {t("books.cashBookExport")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                triggerPrint(
                  `/reports/book-print/cash_book?from=${dateRange.from}&to=${dateRange.to}`,
                  `${t("books.cashBookTitle")} · ${t("books.cashBookPrint")}`,
                )
              }
            >
              <Printer className="h-4 w-4 mr-1" /> {t("books.cashBookPrint")}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/treasury/vouchers">{t("books.cashBookReceiptsPayments")}</Link>
            </Button>
          </div>
        }
      />

      <div className="no-print mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 border rounded-lg bg-muted/20">
        <div>
          <Label className="text-xs">{t("books.cashBookPeriod")}</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t("books.periodToday")}</SelectItem>
              <SelectItem value="weekly">{t("books.periodThisWeek")}</SelectItem>
              <SelectItem value="monthly">{t("books.periodThisMonth")}</SelectItem>
              <SelectItem value="yearly">{t("books.periodThisYear")}</SelectItem>
              <SelectItem value="custom">{t("books.periodCustom")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "custom" ? (
          <>
            <div>
              <Label className="text-xs">{t("books.from")}</Label>
              <Input type="date" value={customRange.from} onChange={(e) => setCustomRange((r) => ({ ...r, from: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">{t("books.to")}</Label>
              <Input type="date" value={customRange.to} onChange={(e) => setCustomRange((r) => ({ ...r, to: e.target.value }))} />
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground flex items-end pb-2">
            {dateRange.from} → {dateRange.to}
          </div>
        )}
        <div>
          <Label className="text-xs">{t("books.cashBankAccount")}</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("books.allAccounts")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("books.allCashBank")}</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("books.party")}</Label>
          <Select value={partyId} onValueChange={setPartyId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("books.allParties")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("books.allParties")}</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">{t("books.sourceModule")}</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={t("books.allSources")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("books.allSources")}</SelectItem>
              {sourceModules.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatLedgerSourceLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">{t("books.searchVoucher")}</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("books.searchVoucherPlaceholder")} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs font-mono">
        <span>
          {t("books.opening")}: <strong>₹{paiseToRupees(openingPaise)}</strong>
        </span>
        <span>
          {t("books.closing")}:{" "}
          <strong>
            ₹{paiseToRupees(rows.length ? rows[rows.length - 1].closingPaise : openingPaise)}
          </strong>
        </span>
        <span className="text-muted-foreground">{rows.length} {t("books.lines")}</span>
      </div>

      <CompanyCashLedgerTable rows={rows} showOpeningFooter openingPaise={openingPaise} />
      {serverEntries && serverTotal > pageSize ? (
        <div className="flex gap-2 mt-3 no-print">
          <Button
            size="sm"
            variant="outline"
            disabled={pageOffset === 0}
            onClick={() => setPageOffset((o) => Math.max(0, o - pageSize))}
          >
            {t("books.previous")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pageOffset + pageSize >= serverTotal}
            onClick={() => setPageOffset((o) => o + pageSize)}
          >
            {t("books.next")}
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            {pageOffset + 1}–{Math.min(pageOffset + pageSize, serverTotal)} {t("books.of")} {serverTotal}
          </span>
        </div>
      ) : null}
    </div>
  );
}
