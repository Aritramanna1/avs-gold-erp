import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { usePrintEngine } from "@/lib/print-engine";
import { useDraft } from "@/lib/drafts-store";
import { useSaveShortcut } from "@/lib/keyboard/use-save-shortcut";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  usePeople,
  type Person,
  type PersonType,
  type KycDocKey,
  type BankAccount,
  PERSON_TYPE_LABELS,
  KYC_DOC_LABELS,
  maskAadhaar,
  kycComplete,
  tabsForType,
} from "@/lib/people-store";
import { PersonProfileAvatar } from "@/components/people/PersonProfileAvatar";
import {
  User,
  Building2,
  Hammer,
  Briefcase,
  Truck,
  FileText,
  Plus,
  Printer,
  Pencil,
  Power,
  Search,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MapPin,
  Camera,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Coins,
  Clock,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
import { useAttachments, useAttachmentUrl } from "@/lib/attachments-store";
import { useSettings } from "@/lib/settings-store";
import { DynamicFormRenderer } from "@/components/forms/DynamicFormRenderer";
import { DynamicFields, peopleForms } from "@/components/forms/DynamicFields";
import { ReferenceNotesPanel } from "@/components/reference-notes/ReferenceNotesPanel";
import { CustomerPersonalLedgerView } from "@/components/customer-personal-ledger-view";
import { findPersonIdForCentralParty } from "@/lib/central-foundation";
import { fetchPeoplePage, fetchPeopleTabCounts, type PeopleTabCounts } from "@/lib/people-query";
import { EmptyState, InlineSavingState, WebAppState } from "@/components/web-app-state";
import { ActionableEmptyState } from "@/components/ui/ActionableEmptyState";

import { guardRoute } from "@/lib/permissions";
import { fineGoldMg } from "@/lib/gold";

export const Route = createFileRoute("/people/")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "People / KYC · AVS Gold ERP" }] }),
  component: PeoplePage,
});

const TABS = [
  {
    key: "customers",
    label: "Customers",
    icon: User,
    types: ["customer", "firm_customer"] as PersonType[],
  },
  {
    key: "firms",
    label: "Trade / Jewellers",
    icon: Building2,
    types: ["jeweller", "dealer", "agent", "firm_customer"] as PersonType[],
  },
  {
    key: "karigars",
    label: "Karigars / Workers",
    icon: Hammer,
    types: ["karigar", "worker", "outside_karigar", "outside_worker"] as PersonType[],
  },
  { key: "employees", label: "Employees", icon: Briefcase, types: ["employee"] as PersonType[] },
  {
    key: "vendors",
    label: "Suppliers & Vendors",
    icon: Truck,
    types: [
      "supplier",
      "refinery",
      "hallmark_vendor",
      "service_provider",
      "other",
      "vendor",
    ] as PersonType[],
  },
  { key: "kyc", label: "KYC Documents", icon: FileText, types: [] as PersonType[] },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function PeoplePage() {
  const { t } = useLanguage();
  const navigate = useNavigate({ from: "/people/" });
  const search = useSearch({ from: "/people/" }) as {
    selected?: string;
    central?: string;
    tab?: TabKey;
    q?: string;
    page?: number;
  };
  const people = usePeople((s) => s.people);
  const selectedBranchId = useSettings((s) => s.selectedBranchId);
  const currentUserRole = useSettings((s) => s.currentUserRole);
  const tab = search.tab && TABS.some((item) => item.key === search.tab) ? search.tab : "customers";
  const query = search.q ?? "";
  const page = Math.max(1, Number(search.page) || 1);
  const pageSize = 25;
  const [pagedPeople, setPagedPeople] = useState<Person[]>([]);
  const [pageTotalCount, setPageTotalCount] = useState(0);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [tabCounts, setTabCounts] = useState<PeopleTabCounts>({
    customers: 0,
    firms: 0,
    karigars: 0,
    employees: 0,
    vendors: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => search.selected || search.central || null);
  const [viewingLedgerId, setViewingLedgerId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const [addingType, setAddingType] = useState<PersonType | null>(null);
  const [storageNotice, setStorageNotice] = useState(false);

  useEffect(() => {
    if (search.selected || search.central) {
      setSelectedId(search.selected || search.central || null);
    }
  }, [search.selected, search.central]);

  const { triggerPrint } = usePrintEngine();
  const selected = useMemo(
    () =>
      people.find((p) => p.id === selectedId) ??
      pagedPeople.find((p) => p.id === selectedId) ??
      null,
    [pagedPeople, people, selectedId],
  );

  const updateSearch = (patch: Partial<{ tab: TabKey; q: string; page: number }>) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
      replace: true,
    });
  };

  const visibleBranchId = useMemo(() => {
    const globalRoles = [
      "Super Owner",
      "Administrator",
      "CEO (View Only)",
      "owner",
      "admin",
      "saas_admin",
    ];
    return currentUserRole && !globalRoles.includes(currentUserRole)
      ? selectedBranchId || "MAIN"
      : null;
  }, [currentUserRole, selectedBranchId]);

  useEffect(() => {
    let cancelled = false;
    void fetchPeopleTabCounts(visibleBranchId)
      .then((counts) => {
        if (!cancelled) setTabCounts(counts);
      })
      .catch(() => {
        if (!cancelled) {
          setTabCounts({ customers: 0, firms: 0, karigars: 0, employees: 0, vendors: 0 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [visibleBranchId]);

  useEffect(() => {
    const tabSpec = TABS.find((item) => item.key === tab);
    if (!tabSpec || tabSpec.key === "kyc") {
      setPagedPeople([]);
      setPageTotalCount(0);
      setPeopleLoading(false);
      setPeopleError(null);
      return;
    }

    let cancelled = false;
    setPeopleLoading(true);
    setPeopleError(null);
    void fetchPeoplePage({
      page,
      pageSize,
      query,
      types: tabSpec.types,
      branchId: visibleBranchId,
    })
      .then((result) => {
        if (cancelled) return;
        setPagedPeople(result.people);
        setPageTotalCount(result.totalCount);
      })
      .catch((error) => {
        if (cancelled) return;
        setPeopleError(error instanceof Error ? error.message : "Could not load people.");
        setPagedPeople([]);
        setPageTotalCount(0);
      })
      .finally(() => {
        if (!cancelled) setPeopleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, query, tab, visibleBranchId]);

  useEffect(() => {
    const selected = search.selected ?? null;
    if (!selected) return;
    const person = people.find((p) => p.id === selected);
    if (!person) return;
    setSelectedId(person.id);
    updateSearch({ tab: tabsForType(person.type) as TabKey });
    setViewingLedgerId(null);
  }, [people, search.selected]);

  useEffect(() => {
    if (!search.central) return;
    let cancelled = false;
    void findPersonIdForCentralParty(search.central)
      .then((personId) => {
        if (cancelled || !personId) return;
        const person = people.find((p) => p.id === personId);
        if (!person) return;
        setSelectedId(person.id);
        updateSearch({ tab: tabsForType(person.type) as TabKey });
        setViewingLedgerId(null);
      })
      .catch((error) => {
        console.warn("Unable to open central party deep link", error);
      });
    return () => {
      cancelled = true;
    };
  }, [people, search.central]);

  const legacyFilteredForTab = useMemo(() => {
    const t = TABS.find((x) => x.key === tab)!;
    const q = query.trim().toLowerCase();
    let list = people;
    if (t.key !== "kyc") {
      list = people.filter((p) => t.types.includes(p.type));
    }
    if (q) {
      list = list.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.workType ?? "").toLowerCase().includes(q) ||
          // Custom fields are searchable too — a value the workshop chose to
          // capture is worthless if it can't be found again.
          false,
      );
    }
    return list;
  }, [people, tab, query]);

  const addOptions: { type: PersonType; label: string }[] = [
    { type: "customer", label: t("people.add_customer") },
    { type: "firm_customer", label: t("people.add_firm") },
    { type: "karigar", label: t("people.add_karigar") },
    { type: "employee", label: t("people.add_employee") },
    { type: "vendor", label: t("people.add_vendor") },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title={t("people.title")}
        subtitle={t("people.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            {addOptions.map((o) => (
              <Button
                key={o.type}
                id={o.type === "customer" ? "people-add-customer-btn" : undefined}
                data-testid={o.type === "customer" ? "people-add-button" : `people-add-${o.type}`}
                size="sm"
                variant={o.type === "customer" ? "default" : "secondary"}
                onClick={() => setAddingType(o.type)}
              >
                <Plus className="h-4 w-4 mr-1" /> {o.label}
              </Button>
            ))}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => updateSearch({ tab: v as TabKey })}>
        {/* Mobile tab selector */}
        <div className="block md:hidden mb-3">
          <Select value={tab} onValueChange={(v) => updateSearch({ tab: v as TabKey })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map((tItem) => {
                const count =
                  tItem.key === "kyc"
                    ? people.filter((p) => !kycComplete(p)).length
                    : (tabCounts[tItem.key as keyof PeopleTabCounts] ?? 0);
                return (
                  <SelectItem key={tItem.key} value={tItem.key}>
                    {t("people.tab_" + tItem.key)} ({count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        {/* Desktop tab bar */}
        <TabsList className="hidden md:flex flex-wrap h-auto bg-card border border-border p-1">
          {TABS.map((tItem) => {
            const Icon = tItem.icon;
            const count =
              tItem.key === "kyc"
                ? people.filter((p) => !kycComplete(p)).length
                : (tabCounts[tItem.key as keyof PeopleTabCounts] ?? 0);
            return (
              <TabsTrigger
                key={tItem.key}
                value={tItem.key}
                className="gap-2 data-[state=active]:bg-accent data-[state=active]:text-gold"
              >
                <Icon className="h-4 w-4" />
                <span>{t("people.tab_" + tItem.key)}</span>
                <span className="ml-1 rounded-full bg-background/40 px-2 text-[10px]">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {viewingLedgerId && selected ? (
              <CustomerPersonalLedgerView
                person={selected}
                onBack={() => setViewingLedgerId(null)}
                triggerPrint={triggerPrint}
              />
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => updateSearch({ q: e.target.value })}
                    placeholder={t("people.searchPlaceholder")}
                    className="pl-9"
                  />
                </div>

                {TABS.map((tItem) => (
                  <TabsContent key={tItem.key} value={tItem.key} className="mt-0">
                    {tItem.key === "kyc" ? (
                      <KycList
                        people={people}
                        onSelect={(id) => {
                          setSelectedId(id);
                          setViewingLedgerId(null);
                        }}
                        onPlaceholder={() => setStorageNotice(true)}
                      />
                    ) : (
                      <PeopleList
                        list={pagedPeople}
                        totalCount={pageTotalCount}
                        query={query}
                        loading={peopleLoading}
                        error={peopleError}
                        page={page}
                        pageSize={pageSize}
                        selectedId={selectedId}
                        onSelect={(id) => {
                          setSelectedId(id);
                          setViewingLedgerId(null);
                        }}
                        onEdit={(p) => setEditing(p)}
                        onPageChange={(nextPage) => updateSearch({ page: nextPage })}
                      />
                    )}
                  </TabsContent>
                ))}
              </>
            )}
          </div>

          <aside className="lg:sticky lg:top-4 self-start">
            <SelectedPersonCard
              person={selected}
              onEdit={() => selected && setEditing(selected)}
              onPlaceholder={() => setStorageNotice(true)}
              onOpenLedger={(id) => setViewingLedgerId(id)}
            />
          </aside>
        </div>
      </Tabs>

      {/* Add / Edit dialog */}
      <PersonFormDialog
        open={!!addingType || !!editing}
        onClose={() => {
          setAddingType(null);
          setEditing(null);
        }}
        initial={editing}
        defaultType={addingType ?? undefined}
        onSaved={(p) => setSelectedId(p.id)}
      />

      <Dialog open={storageNotice} onOpenChange={setStorageNotice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("people.file_upload_title")}</DialogTitle>
            <DialogDescription>{t("people.file_upload_desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setStorageNotice(false)}>{t("people.ok")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Avatar ----------------------------- */

function PersonAvatar({ person, className }: { person: Person; className: string }) {
  return (
    <PersonProfileAvatar
      personId={person.id}
      person={person}
      name={person.fullName}
      className={className}
      data-testid="person-avatar-img"
    />
  );
}

/* ----------------------------- Lists ----------------------------- */

function PeopleList({
  list,
  totalCount,
  query,
  loading,
  error,
  page,
  pageSize,
  selectedId,
  onSelect,
  onEdit,
  onPageChange,
}: {
  list: Person[];
  totalCount: number;
  query: string;
  loading: boolean;
  error: string | null;
  page: number;
  pageSize: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (p: Person) => void;
  onPageChange: (page: number) => void;
}) {
  const { t } = useLanguage();
  const setActive = usePeople((s) => s.setActive);
  const remove = usePeople((s) => s.remove);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const cachePagedPerson = (person: Person) => {
    usePeople.setState((state) =>
      state.people.some((existing) => existing.id === person.id)
        ? state
        : { people: [person, ...state.people].slice(0, 250) },
    );
  };
  const handleDelete = (p: Person) => {
    if (!window.confirm(`Delete ${p.fullName}? This cannot be undone.`)) return;
    cachePagedPerson(p);
    remove(p.id)
      .then(() => toast.success(`${p.fullName} deleted.`))
      .catch(() => toast.error(`Failed to delete ${p.fullName}.`));
  };
  if (loading) {
    return (
      <WebAppState
        title="Loading people"
        description="Fetching the current party page from Supabase."
      />
    );
  }
  if (error) {
    return (
      <WebAppState
        tone="danger"
        title="People could not load"
        description={error}
        action={{ label: "Try again", onClick: () => onPageChange(page) }}
      />
    );
  }
  if (list.length === 0) {
    const filtered = totalCount > 0 && query.trim().length > 0;
    if (filtered) {
      return (
        <EmptyState
          title="No people match this search"
          description="Clear or change the search text to see the rest of this party group."
        />
      );
    }
    return (
      <ActionableEmptyState
        variant="customer"
        title="No contacts found yet"
        description="Create your first customer, karigar, worker, or vendor to start tracking transactions, gold balances, and GST invoices."
        actionLabel="Add Customer / Party"
        onAction={() => {
          const btn = document.getElementById("people-add-customer-btn");
          if (btn) btn.click();
        }}
      />
    );
  }
  return (
    <div className="space-y-2">
      {list.map((p) => {
        const isSel = p.id === selectedId;
        return (
          <div
            key={p.id}
            className={`rounded-md border bg-card p-4 transition-all ${
              isSel ? "border-gold shadow-gold" : "border-border hover:border-gold/40"
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => onSelect(p.id)}
                className="h-12 w-12 shrink-0 rounded-full overflow-hidden"
              >
                <PersonAvatar person={p} className="h-12 w-12 rounded-full text-lg" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => onSelect(p.id)}
                    className="font-medium text-left hover:text-gold transition-colors"
                  >
                    {p.fullName}
                  </button>
                  <Badge variant="secondary" className="text-[10px]">
                    {PERSON_TYPE_LABELS[p.type]}
                  </Badge>
                  {p.stampMark && (
                    <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-400 bg-amber-500/10">
                      Stamp: {p.stampMark}
                    </Badge>
                  )}
                  {!p.active && (
                    <Badge variant="outline" className="text-[10px]">
                      {t("people.inactive")}
                    </Badge>
                  )}
                  {!kycComplete(p) && (
                    <Badge className="text-[10px] bg-warning/20 text-warning border border-warning/40">
                      {t("people.kyc_incomplete")}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {p.phone}
                  </span>
                  {p.villageCity && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {p.villageCity}
                    </span>
                  )}
                  {p.workType && <span>· {p.workType}</span>}
                  {p.gstin && <span>· GSTIN {p.gstin}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => onSelect(p.id)}>
                  {t("people.view")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onEdit(p)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  {t("people.edit")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    cachePagedPerson(p);
                    void setActive(p.id, !p.active);
                  }}
                >
                  <Power className="h-3.5 w-3.5 mr-1" />
                  {p.active ? t("people.mark_inactive") : t("people.mark_active")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="people-delete"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(p)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex flex-col gap-2 pt-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of{" "}
          {totalCount}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function KycList({
  people,
  onSelect,
  onPlaceholder,
}: {
  people: Person[];
  onSelect: (id: string) => void;
  onPlaceholder: () => void;
}) {
  const { t } = useLanguage();
  const toggleDoc = usePeople((s) => s.toggleDoc);
  if (people.length === 0) {
    return (
      <EmptyState
        title={t("people.add_person_first")}
        description="KYC documents attach to central People records. Add a customer, karigar, worker, employee, or vendor first."
      />
    );
  }
  const docKeys: KycDocKey[] = [
    "photo",
    "aadhaar_front",
    "aadhaar_back",
    "pan",
    "address_proof",
    "signature",
  ];
  return (
    <div className="space-y-3">
      {people.map((p) => (
        <div key={p.id} className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button onClick={() => onSelect(p.id)} className="font-medium hover:text-gold">
              {p.fullName}{" "}
              <span className="text-xs text-muted-foreground">· {PERSON_TYPE_LABELS[p.type]}</span>
            </button>
            {kycComplete(p) ? (
              <Badge className="bg-success/20 text-success border border-success/40">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t("people.kyc_complete")}
              </Badge>
            ) : (
              <Badge className="bg-warning/20 text-warning border border-warning/40">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t("people.kyc_incomplete")}
              </Badge>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {docKeys.map((k) => {
              const filed = !!p.docs[k];
              return (
                <div
                  key={k}
                  className={`rounded-lg border p-3 flex items-center justify-between gap-2 ${
                    filed
                      ? "border-gold/40 bg-gold/5"
                      : "border-dashed border-border bg-background/30"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm">{KYC_DOC_LABELS[k]}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {filed ? t("people.on_file") : t("people.not_on_file")}
                    </div>
                  </div>
                  <AttachmentButton
                    entityType="person"
                    entityId={p.id}
                    docKey={k}
                    docLabel={KYC_DOC_LABELS[k]}
                    title={`${p.fullName} — ${KYC_DOC_LABELS[k]}`}
                    onSaved={(next) => {
                      // Keep the legacy KYC boolean in sync so kycComplete() still works.
                      if (next.filed !== filed) toggleDoc(p.id, k);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Selected card ----------------------------- */

function SelectedPersonCard({
  person,
  onEdit,
  onPlaceholder: _onPlaceholder,
  onOpenLedger,
}: {
  person: Person | null;
  onEdit: () => void;
  onPlaceholder: () => void;
  onOpenLedger: (id: string) => void;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const toggleDoc = usePeople((s) => s.toggleDoc);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  if (!person) {
    return (
      <WebAppState
        title={t("people.selected_title")}
        description={t("people.selected_placeholder")}
      />
    );
  }
  const isCustomerLike = person.type === "customer" || person.type === "firm_customer";
  return (
    <div
      data-testid="people-selected-card"
      className="rounded-md border border-gold/30 bg-card p-5 shadow-gold space-y-4"
    >
      <div className="flex items-center gap-3">
        <PersonAvatar person={person} className="h-14 w-14 rounded-full text-xl" />
        <div className="min-w-0">
          <div className="font-serif text-lg text-gold truncate">{person.fullName}</div>
          <div className="text-xs text-muted-foreground">{PERSON_TYPE_LABELS[person.type]}</div>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <Row label={t("people.lbl_phone")} value={person.phone} />
        {person.altPhone && <Row label={t("people.lbl_altPhone")} value={person.altPhone} />}
        {person.email && <Row label="Email" value={person.email} />}
        {(person.currentAddress || person.villageCity) && (
          <Row
            label={t("people.lbl_address")}
            value={[person.currentAddress, person.villageCity, person.state]
              .filter(Boolean)
              .join(", ")}
          />
        )}
        <Row label={t("people.lbl_aadhaar")} value={maskAadhaar(person.aadhaar)} />
        {person.pan && <Row label={t("people.lbl_pan")} value={person.pan} />}
        {person.gstin && <Row label={t("people.lbl_gstin")} value={person.gstin} />}
        {person.workType && <Row label={t("people.lbl_workType")} value={person.workType} />}
        {person.joiningDate && (
          <Row label={t("people.lbl_joiningDate")} value={person.joiningDate} />
        )}
        {person.branchId && (
          <Row
            label="Branch"
            value={
              useSettings.getState().branches.find((b) => b.id === person.branchId)?.name ??
              person.branchId
            }
          />
        )}
        <Row
          label={t("people.lbl_status")}
          value={person.active ? t("people.lbl_active") : t("people.lbl_inactive")}
        />
        <Row
          label={t("people.lbl_kyc")}
          value={kycComplete(person) ? t("people.lbl_complete") : t("people.lbl_incomplete")}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1" />
          {t("people.btn_edit")}
        </Button>
        <Button
          size="sm"
          data-testid="people-print"
          className="gap-1 bg-primary text-primary-foreground hover:opacity-90"
          onClick={() =>
            navigate({ to: "/people/print/$id" as any, params: { id: person.id } as any })
          }
        >
          <Printer className="h-3.5 w-3.5 text-inherit" />
          {t("people.btn_print_kyc")}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="col-span-2 border-gold/45 text-gold hover:bg-gold/10 gap-1.5"
          onClick={() => onOpenLedger(person.id)}
        >
          <BookOpen className="h-3.5 w-3.5 text-gold" />
          Gold & Money Ledger
        </Button>

        {isCustomerLike ? (
          <Button
            size="sm"
            variant="outline"
            className="col-span-2 border-gold/45 text-gold hover:bg-gold/10 gap-1.5"
            onClick={() => navigate({ to: "/people/$id", params: { id: person.id } })}
          >
            <BookOpen className="h-3.5 w-3.5 text-gold" />
            Full Account
          </Button>
        ) : null}

        <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/ledger" })}>
          Shop Gold Ledger
        </Button>
        {isCustomerLike ? (
          <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/orders/new" })}>
            {t("people.btn_create_order")}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            data-testid="people-photos-files"
            onClick={() => setPhotosOpen(true)}
          >
            <Camera className="h-3.5 w-3.5 mr-1" />
            {t("people.btn_photos_files")}
          </Button>
        )}
        {isCustomerLike && (
          <Button
            size="sm"
            variant="ghost"
            data-testid="people-photos-files"
            onClick={() => setPhotosOpen(true)}
            className="col-span-2"
          >
            <Camera className="h-3.5 w-3.5 mr-1" />
            {t("people.btn_photos_files")}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setFormsOpen(true)} className="col-span-2">
          <FileText className="h-3.5 w-3.5 mr-1" />
          Forms
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNotesOpen(true)} className="col-span-2">
          <MessageSquare className="h-3.5 w-3.5 mr-1" />
          Reference Notes
        </Button>
        {isCustomerLike && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate({ to: `/communications` as any })}
            className="col-span-2 text-gold hover:text-gold border border-gold/25 bg-gold/5"
          >
            <Clock className="h-3.5 w-3.5 mr-1" />
            CRM Timeline & LTV Profile
          </Button>
        )}
        {isCustomerLike && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate({ to: "/repair/new" })}
            className="col-span-2"
          >
            Add Repair
          </Button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Ledger, Orders and Repair will pre-fill with this person where supported.
      </p>

      <PersonPhotosDialog
        open={photosOpen}
        onOpenChange={setPhotosOpen}
        person={person}
        onToggle={(k, nextFiled) => {
          const current = !!person.docs[k];
          if (current !== nextFiled) toggleDoc(person.id, k);
        }}
      />

      <PersonFormsDialog open={formsOpen} onOpenChange={setFormsOpen} person={person} />

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reference Notes</DialogTitle>
            <DialogDescription>Internal notes attached to {person.fullName}.</DialogDescription>
          </DialogHeader>
          <ReferenceNotesPanel entityType="person" entityId={person.id} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PersonPhotosDialog({
  open,
  onOpenChange,
  person,
  onToggle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  person: Person;
  onToggle: (k: KycDocKey, nextFiled: boolean) => void;
}) {
  const docKeys: KycDocKey[] = [
    "photo",
    "aadhaar_front",
    "aadhaar_back",
    "pan",
    "address_proof",
    "signature",
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" data-testid="people-photos-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-gold" /> {person.fullName} — Photos / Files
          </DialogTitle>
          <DialogDescription>
            Mark each KYC document as filed (paper register) and add an optional note.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {docKeys.map((k) => {
            const filed = !!person.docs[k];
            return (
              <div
                key={k}
                className={`rounded-lg border p-3 flex items-center justify-between gap-2 ${
                  filed
                    ? "border-gold/40 bg-gold/5"
                    : "border-dashed border-border bg-background/30"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm">{KYC_DOC_LABELS[k]}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {filed ? "On file (paper register)" : "Not on file"}
                  </div>
                </div>
                <AttachmentButton
                  entityType="person"
                  entityId={person.id}
                  docKey={k}
                  docLabel={KYC_DOC_LABELS[k]}
                  title={`${person.fullName} — ${KYC_DOC_LABELS[k]}`}
                  onSaved={(next) => onToggle(k, next.filed)}
                />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PersonFormsDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  person: Person;
}) {
  const settings = useSettings();
  const updatePerson = usePeople((s) => s.update);
  // Same definition the People form and print use. Previously this filtered the
  // raw metadata, so this dialog rendered the built-in-duplicating fields (name,
  // phone, aadhaar…) and wrote them into customForms — a second, conflicting copy
  // of facts the person record already owns.
  const kycForms = peopleForms(settings.formsMetadata);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dynamic Forms - {person.fullName}</DialogTitle>
          <DialogDescription>
            Fill out requested forms and save them to the profile.
          </DialogDescription>
        </DialogHeader>

        {kycForms.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No forms configured in settings.
          </div>
        ) : (
          <Tabs defaultValue={kycForms[0].id}>
            <TabsList className="mb-4">
              {kycForms.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {kycForms.map((f) => (
              <TabsContent key={f.id} value={f.id}>
                <DynamicFormRenderer
                  formMeta={f}
                  initialData={person.customForms?.[f.id] || {}}
                  onSave={(data) => {
                    const currentForms = person.customForms || {};
                    updatePerson(person.id, {
                      customForms: {
                        ...currentForms,
                        [f.id]: data,
                      },
                    });
                    toast.success(`${f.name} saved!`);
                  }}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );
}

/* ----------------------------- Form dialog ----------------------------- */

export function PersonFormDialog({
  open,
  onClose,
  initial,
  defaultType,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: Person | null;
  defaultType?: PersonType;
  onSaved: (p: Person) => void;
}) {
  const add = usePeople((s) => s.add);
  const update = usePeople((s) => s.update);
  const branches = useSettings((s) => s.branches);

  const people = usePeople((s) => s.people);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const empty = {
    type: defaultType ?? initial?.type ?? ("customer" as PersonType),
    roles: initial?.roles ?? [defaultType ?? initial?.type ?? ("customer" as PersonType)],
    active: initial?.active ?? true,
    fullName: initial?.fullName ?? "",
    stampMark: initial?.stampMark ?? initial?.shortName ?? "",
    shortName: initial?.shortName ?? initial?.stampMark ?? "",
    tradeName: initial?.tradeName ?? "",
    legalName: initial?.legalName ?? "",
    contactPerson: initial?.contactPerson ?? "",
    phone: initial?.phone ?? "",
    altPhone: initial?.altPhone ?? "",
    whatsapp: initial?.whatsapp ?? "",
    email: initial?.email ?? "",
    addressLine1: initial?.addressLine1 ?? initial?.currentAddress ?? "",
    addressLine2: initial?.addressLine2 ?? "",
    area: initial?.area ?? "",
    villageCity: initial?.villageCity ?? "",
    district: initial?.district ?? "",
    state: initial?.state ?? "",
    pin: initial?.pin ?? "",
    currentAddress: initial?.currentAddress ?? "",
    permanentAddress: initial?.permanentAddress ?? "",
    aadhaar: initial?.aadhaar ?? "",
    pan: initial?.pan ?? "",
    gstin: initial?.gstin ?? "",
    msmeUdyamNo: initial?.msmeUdyamNo ?? "",
    tan: initial?.tan ?? "",
    businessType: initial?.businessType ?? "proprietorship",
    placeOfSupply: initial?.placeOfSupply ?? "",
    tdsTcsApplicability: initial?.tdsTcsApplicability ?? ("none" as const),
    cashCreditLimitPaise: initial?.cashCreditLimitPaise ?? (undefined as number | undefined),
    goldCreditLimitMg:
      initial?.goldCreditLimitMg ??
      initial?.maxFineGoldCreditMg ??
      (undefined as number | undefined),
    dueDays: initial?.dueDays ?? (undefined as number | undefined),
    // ── Real Opening Balances ──
    cashOpeningBalancePaise: initial?.cashOpeningBalancePaise ?? (undefined as number | undefined),
    cashOpeningType: initial?.cashOpeningType ?? ("receivable" as const),
    goldOpeningGrossMg: initial?.goldOpeningGrossMg ?? (undefined as number | undefined),
    goldOpeningTouch: initial?.goldOpeningTouch ?? 91.6,
    goldOpeningFineMg: initial?.goldOpeningFineMg ?? (undefined as number | undefined),
    goldOpeningType: initial?.goldOpeningType ?? ("receivable" as const),
    silverOpeningFineMg: initial?.silverOpeningFineMg ?? (undefined as number | undefined),
    openingBillsCount: initial?.openingBillsCount ?? (undefined as number | undefined),
    openingBalanceNotes: initial?.openingBalanceNotes ?? "",
    workType: initial?.workType ?? "",
    joiningDate: initial?.joiningDate ?? "",
    emergencyName: initial?.emergencyName ?? "",
    emergencyPhone: initial?.emergencyPhone ?? "",
    referenceName: initial?.referenceName ?? "",
    referencePhone: initial?.referencePhone ?? "",
    dateOfBirth: initial?.dateOfBirth ?? "",
    anniversary: initial?.anniversary ?? "",
    spouseName: initial?.spouseName ?? "",
    skills: initial?.skills ?? "",
    experience: initial?.experience ?? "",
    dailyWagePaise: initial?.dailyWagePaise ?? (undefined as number | undefined),
    bankAccounts:
      initial?.bankAccounts ??
      (initial?.bankAccountNumber
        ? [
            {
              id: "b_1",
              bankName: initial?.bankName ?? "",
              accountHolderName: initial?.bankAccountName ?? initial?.fullName ?? "",
              accountNumber: initial?.bankAccountNumber,
              accountType: "savings" as const,
              ifscCode: initial?.bankIfsc ?? "",
              isPrimary: true,
              active: true,
            },
          ]
        : []),
    bankAccountName: initial?.bankAccountName ?? "",
    bankAccountNumber: initial?.bankAccountNumber ?? "",
    bankIfsc: initial?.bankIfsc ?? "",
    bankName: initial?.bankName ?? "",
    notes: initial?.notes ?? "",
    branchId: initial?.branchId ?? useSettings.getState().selectedBranchId ?? "",
    customForms: (initial?.customForms ?? {}) as Record<string, Record<string, any>>,
  };
  const key = (initial?.id ?? "new") + "-" + (defaultType ?? "");
  const [form, setForm, clearForm] = useDraft("mtj-person-form-" + key, () => empty);
  const [lastKey, setLastKey] = useState(key);
  if (open && lastKey !== key) {
    setForm(empty);
    setErrors({});
    setWarnings({});
    setLastKey(key);
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) {
      setErrors((e) => ({ ...e, [k]: "" }));
    }
  };

  const formsMetadata = useSettings((s) => s.formsMetadata);
  const customForms = useMemo(() => peopleForms(formsMetadata), [formsMetadata]);
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});

  const setCustomField = (formId: string, name: string, value: any) => {
    setForm((f) => ({
      ...f,
      customForms: {
        ...(f.customForms ?? {}),
        [formId]: { ...((f.customForms ?? {})[formId] ?? {}), [name]: value },
      },
    }));
    if (customFieldErrors[formId]) {
      setCustomFieldErrors((e) => ({ ...e, [formId]: "" }));
    }
  };

  const isB2B = [
    "firm_customer",
    "jeweller",
    "dealer",
    "supplier",
    "refinery",
    "hallmark_vendor",
  ].includes(form.type);
  const isWorkerish = [
    "karigar",
    "worker",
    "employee",
    "outside_karigar",
    "outside_worker",
    "vendor",
  ].includes(form.type);

  const addBankAccount = () => {
    const nextAccount = {
      id: `ba_${Date.now()}`,
      bankName: "",
      accountHolderName: form.fullName || "",
      accountNumber: "",
      accountType: "current" as const,
      ifscCode: "",
      isPrimary: (form.bankAccounts?.length ?? 0) === 0,
      active: true,
    };
    set("bankAccounts", [...(form.bankAccounts || []), nextAccount]);
  };

  const updateBankAccount = (id: string, patch: Partial<BankAccount>) => {
    set(
      "bankAccounts",
      (form.bankAccounts || []).map((ba) => (ba.id === id ? { ...ba, ...patch } : ba)),
    );
  };

  const removeBankAccount = (id: string) => {
    set(
      "bankAccounts",
      (form.bankAccounts || []).filter((ba) => ba.id !== id),
    );
  };

  const setPrimaryBankAccount = (id: string) => {
    set(
      "bankAccounts",
      (form.bankAccounts || []).map((ba) => ({ ...ba, isPrimary: ba.id === id })),
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const newWarnings: Record<string, string> = {};

    if (!form.fullName.trim()) {
      newErrors.fullName = "Name is required.";
    }

    const cleanPhone = form.phone.trim();
    if (!cleanPhone) {
      newErrors.phone = "Phone is required.";
    } else {
      const numericPhone = cleanPhone.replace(/\D/g, "");
      if (numericPhone.length !== 10) {
        newErrors.phone = "Phone number must be exactly 10 digits.";
      }

      const isDupPhone = people.some(
        (p) => p.phone.replace(/\D/g, "") === numericPhone && p.id !== initial?.id,
      );
      if (isDupPhone) {
        newWarnings.phone = "Duplicate Warning: A registry user with this phone exists.";
      }
    }

    if (isWorkerish && !form.workType.trim()) {
      newErrors.workType = "Work type / role is required for workers.";
    }

    if (form.aadhaar.trim()) {
      const cleanAadhaar = form.aadhaar.replace(/\s/g, "");
      if (cleanAadhaar.length !== 12 && !/^\d+$/.test(cleanAadhaar)) {
        newErrors.aadhaar = "Aadhaar must be a 12-digit numeric code.";
      }

      const isDupAadhaar = people.some(
        (p) => p.aadhaar && p.aadhaar.replace(/\s/g, "") === cleanAadhaar && p.id !== initial?.id,
      );
      if (isDupAadhaar) {
        newWarnings.aadhaar = "Duplicate Warning: Aadhaar matches active record.";
      }
    }

    if (isB2B && form.gstin.trim()) {
      const cleanGst = form.gstin.trim().toUpperCase();
      const gstinReg = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinReg.test(cleanGst)) {
        newErrors.gstin = "Invalid Indian GSTIN format rules.";
      }
    }

    const newCustomErrors: Record<string, string> = {};
    for (const f of customForms) {
      const values = form.customForms?.[f.id] ?? {};
      const missing = f.fields
        .filter((field) => field.required)
        .filter((field) => {
          const v = values[field.name] ?? field.defaultValue;
          return v === undefined || v === null || v === "";
        })
        .map((field) => field.label);
      if (missing.length) {
        newCustomErrors[f.id] = `Required: ${missing.join(", ")}`;
      }
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
    setCustomFieldErrors(newCustomErrors);

    return Object.keys(newErrors).length === 0 && Object.keys(newCustomErrors).length === 0;
  };

  const save = () => {
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    const payload = {
      ...form,
      currentAddress: form.addressLine1 || form.currentAddress,
      maxFineGoldCreditMg: form.goldCreditLimitMg,
    };
    if (initial) {
      update(initial.id, payload as any)
        .then(() => {
          onSaved({ ...initial, ...payload, updatedAt: Date.now() } as any);
          clearForm();
          onClose();
        })
        .catch(() => toast.error(`Failed to save ${form.fullName || "person"}. Please try again.`))
        .finally(() => setSubmitting(false));
    } else {
      add(payload as any)
        .then((created) => {
          onSaved(created);
          clearForm();
          onClose();
        })
        .catch(() => toast.error(`Failed to save ${form.fullName || "person"}. Please try again.`))
        .finally(() => setSubmitting(false));
    }
  };

  useSaveShortcut(save, open);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold text-2xl">
            {initial ? "Edit Party Master" : "Add New Party / Account"}
          </DialogTitle>
          <DialogDescription>
            Complete Party 360 profile with trade credentials, tax compliance, credit limits, and
            bank registry.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Primary Party Role *</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as PersonType)}>
                <SelectTrigger data-testid="people-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERSON_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Assigned Branch</Label>
              <Select value={form.branchId} onValueChange={(v) => set("branchId", v)}>
                <SelectTrigger data-testid="people-branch-select">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border">
            Identity & Contact Details
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full Name / Primary Display Name *" error={errors.fullName}>
              <Input
                data-testid="people-full-name"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="e.g. Raju Das or Maa Tara Jewellers"
              />
            </Field>
            <Field label="Account Stamp / Punch Mark (Short Name)">
              <Input
                value={form.stampMark || ""}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  set("stampMark", val);
                  set("shortName", val);
                }}
                placeholder="e.g. SRM (Punched on finished jewellery)"
              />
            </Field>
            <Field label="Trade / Shop Name (DBA)">
              <Input
                value={form.tradeName}
                onChange={(e) => set("tradeName", e.target.value)}
                placeholder="e.g. Das Gold Works"
              />
            </Field>
            <Field label="Legal Entity Name (Registered)">
              <Input
                value={form.legalName}
                onChange={(e) => set("legalName", e.target.value)}
                placeholder="e.g. Das Gold Works Pvt Ltd"
              />
            </Field>
            <Field label="Contact Person Name">
              <Input
                value={form.contactPerson}
                onChange={(e) => set("contactPerson", e.target.value)}
                placeholder="e.g. Raju Das (Owner)"
              />
            </Field>
            <Field label="Primary Mobile / Phone *" error={errors.phone} warning={warnings.phone}>
              <Input
                data-testid="people-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                inputMode="tel"
                placeholder="10-digit mobile"
              />
            </Field>
            <Field label="WhatsApp Number">
              <Input
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                inputMode="tel"
                placeholder="For PDF invoice delivery"
              />
            </Field>
            <Field label="Alternate Phone">
              <Input
                value={form.altPhone}
                onChange={(e) => set("altPhone", e.target.value)}
                inputMode="tel"
              />
            </Field>
            <Field label="Email Address">
              <Input
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
          </div>

          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border">
            Address & Location
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Address Line 1 (Street / Building)">
              <Input
                value={form.addressLine1}
                onChange={(e) => set("addressLine1", e.target.value)}
                placeholder="Shop 12, Gold Market"
              />
            </Field>
            <Field label="Area / Landmark">
              <Input
                value={form.area}
                onChange={(e) => set("area", e.target.value)}
                placeholder="Bowbazar"
              />
            </Field>
            <Field label="City / Village">
              <Input
                value={form.villageCity}
                onChange={(e) => set("villageCity", e.target.value)}
                placeholder="Kolkata"
              />
            </Field>
            <Field label="District">
              <Input
                value={form.district}
                onChange={(e) => set("district", e.target.value)}
                placeholder="Kolkata"
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                placeholder="West Bengal"
              />
            </Field>
            <Field label="PIN Code">
              <Input
                value={form.pin}
                onChange={(e) => set("pin", e.target.value)}
                placeholder="700012"
              />
            </Field>
          </div>

          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border">
            Tax, MSME & Statutory Compliance
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="GSTIN" error={errors.gstin}>
              <Input
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                placeholder="19AAACM1234F1Z5"
              />
            </Field>
            <Field label="PAN">
              <Input
                value={form.pan}
                onChange={(e) => set("pan", e.target.value.toUpperCase())}
                placeholder="AAACM1234F"
              />
            </Field>
            <Field label="MSME / Udyam No.">
              <Input
                value={form.msmeUdyamNo}
                onChange={(e) => set("msmeUdyamNo", e.target.value.toUpperCase())}
                placeholder="UDYAM-WB-00-12345"
              />
            </Field>
            <Field label="TAN">
              <Input
                value={form.tan}
                onChange={(e) => set("tan", e.target.value.toUpperCase())}
                placeholder="CALM12345F"
              />
            </Field>
            <Field label="GST Place of Supply (State Code)">
              <Input
                value={form.placeOfSupply}
                onChange={(e) => set("placeOfSupply", e.target.value)}
                placeholder="e.g. 19 (WB), 27 (MH)"
              />
            </Field>
            <Field label="Aadhaar Number" error={errors.aadhaar} warning={warnings.aadhaar}>
              <Input
                value={form.aadhaar}
                onChange={(e) => set("aadhaar", e.target.value)}
                placeholder="XXXX XXXX 1234"
              />
            </Field>
          </div>

          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border">
            Credit Limits & Commercial Terms
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Cash Credit Limit (₹)">
              <Input
                type="number"
                min={0}
                value={
                  form.cashCreditLimitPaise !== undefined ? form.cashCreditLimitPaise / 100 : ""
                }
                onChange={(e) =>
                  set(
                    "cashCreditLimitPaise",
                    e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined,
                  )
                }
                placeholder="₹ 500,000"
              />
            </Field>
            <Field label="Fine Gold Metal Limit (Grams)">
              <Input
                type="number"
                min={0}
                step={0.001}
                value={form.goldCreditLimitMg !== undefined ? form.goldCreditLimitMg / 1000 : ""}
                onChange={(e) =>
                  set(
                    "goldCreditLimitMg",
                    e.target.value ? Math.round(parseFloat(e.target.value) * 1000) : undefined,
                  )
                }
                placeholder="e.g. 50.000 g"
              />
            </Field>
            <Field label="Payment Due Term (Days)">
              <Input
                type="number"
                min={0}
                value={form.dueDays !== undefined ? form.dueDays : ""}
                onChange={(e) =>
                  set("dueDays", e.target.value ? parseInt(e.target.value, 10) : undefined)
                }
                placeholder="30 days"
              />
            </Field>
          </div>

          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-amber-500">
              <Coins className="h-3.5 w-3.5" /> Opening Balances & Metal Outstandings
            </span>
            <Badge
              variant="outline"
              className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/5"
            >
              Single Source of Truth
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 p-3 rounded-lg border bg-muted/10">
            {/* Cash Opening Balance */}
            <div className="space-y-2 p-2.5 rounded bg-card border">
              <span className="font-semibold text-xs text-foreground block">
                Cash Opening Balance
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Balance Type</Label>
                  <select
                    value={form.cashOpeningType || "receivable"}
                    onChange={(e) => set("cashOpeningType", e.target.value as any)}
                    className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value="receivable">Receivable (Dr - Customer owes)</option>
                    <option value="payable">Payable (Cr - We owe)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Amount (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={
                      form.cashOpeningBalancePaise !== undefined
                        ? form.cashOpeningBalancePaise / 100
                        : ""
                    }
                    onChange={(e) =>
                      set(
                        "cashOpeningBalancePaise",
                        e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined,
                      )
                    }
                    placeholder="0.00"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Gold Opening Balance */}
            <div className="space-y-2 p-2.5 rounded bg-card border">
              <span className="font-semibold text-xs text-foreground block">
                Gold Metal Opening Balance
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Metal Type</Label>
                  <select
                    value={form.goldOpeningType || "receivable"}
                    onChange={(e) => set("goldOpeningType", e.target.value as any)}
                    className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value="receivable">Receivable (Dr)</option>
                    <option value="payable">Payable (Cr)</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Gross Wt (g)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.001}
                    value={
                      form.goldOpeningGrossMg !== undefined ? form.goldOpeningGrossMg / 1000 : ""
                    }
                    onChange={(e) => {
                      const grossG = parseFloat(e.target.value || "0");
                      const touch = form.goldOpeningTouch || 91.6;
                      const grossMg = Math.round(grossG * 1000);
                      const fineMg = fineGoldMg(grossMg, Math.min(Math.round(touch * 10), 999));
                      set("goldOpeningGrossMg", e.target.value ? grossMg : undefined);
                      set("goldOpeningFineMg", e.target.value ? fineMg : undefined);
                    }}
                    placeholder="0.000"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Touch (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.goldOpeningTouch || 91.6}
                    onChange={(e) => {
                      const touch = parseFloat(e.target.value || "91.6");
                      const grossMg = form.goldOpeningGrossMg || 0;
                      const fineMg = fineGoldMg(grossMg, Math.min(Math.round(touch * 10), 999));
                      set("goldOpeningTouch", touch);
                      set("goldOpeningFineMg", grossMg > 0 ? fineMg : undefined);
                    }}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
              {form.goldOpeningFineMg !== undefined && form.goldOpeningFineMg > 0 && (
                <div className="text-[10px] font-mono text-amber-600 pt-0.5">
                  Calculated Pure Fine: {(form.goldOpeningFineMg / 1000).toFixed(3)} g
                </div>
              )}
            </div>

            {/* Silver & Notes */}
            <div className="space-y-1 sm:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Silver Opening Fine Weight (g)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.001}
                    value={
                      form.silverOpeningFineMg !== undefined ? form.silverOpeningFineMg / 1000 : ""
                    }
                    onChange={(e) =>
                      set(
                        "silverOpeningFineMg",
                        e.target.value ? Math.round(parseFloat(e.target.value) * 1000) : undefined,
                      )
                    }
                    placeholder="0.000 g"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">
                    Opening Balance Reference / Notes
                  </Label>
                  <Input
                    value={form.openingBalanceNotes || ""}
                    onChange={(e) => set("openingBalanceNotes", e.target.value)}
                    placeholder="e.g. Migrated from FY25-26 physical Khata book #4"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border flex items-center justify-between">
            <span>Bank Accounts Registry ({form.bankAccounts?.length || 0})</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addBankAccount}
              className="h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" /> Add Bank A/C
            </Button>
          </div>

          <div className="space-y-3">
            {(form.bankAccounts || []).length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                No bank accounts registered. Click "Add Bank A/C" to register payout accounts.
              </p>
            ) : (
              (form.bankAccounts || []).map((ba, idx) => (
                <div key={ba.id} className="rounded-lg border p-3 bg-muted/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Account #{idx + 1}{" "}
                      {ba.isPrimary && <Badge className="text-[10px] ml-1.5">Primary</Badge>}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {!ba.isPrimary && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPrimaryBankAccount(ba.id)}
                          className="h-6 text-[11px] px-2 text-amber-500"
                        >
                          Make Primary
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeBankAccount(ba.id)}
                        className="h-6 text-[11px] px-2 text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Input
                      placeholder="Bank Name (e.g. HDFC Bank)"
                      value={ba.bankName}
                      onChange={(e) => updateBankAccount(ba.id, { bankName: e.target.value })}
                    />
                    <Input
                      placeholder="Account Holder Name"
                      value={ba.accountHolderName}
                      onChange={(e) =>
                        updateBankAccount(ba.id, { accountHolderName: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Account Number"
                      value={ba.accountNumber}
                      onChange={(e) => updateBankAccount(ba.id, { accountNumber: e.target.value })}
                      inputMode="numeric"
                    />
                    <Input
                      placeholder="IFSC Code (e.g. HDFC0001234)"
                      value={ba.ifscCode}
                      onChange={(e) =>
                        updateBankAccount(ba.id, { ifscCode: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {isWorkerish && (
            <>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border">
                Worker / Karigar Profile
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Work Type / Role *" error={errors.workType}>
                  <Input
                    data-testid="people-work-role"
                    value={form.workType}
                    onChange={(e) => set("workType", e.target.value)}
                    placeholder="e.g. Hand-making, Setting, Filigree"
                  />
                </Field>
                <Field label="Joining Date">
                  <Input
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => set("joiningDate", e.target.value)}
                  />
                </Field>
                <Field label="Daily Wage (₹)">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.dailyWagePaise !== undefined ? form.dailyWagePaise / 100 : ""}
                    onChange={(e) =>
                      set(
                        "dailyWagePaise",
                        e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined,
                      )
                    }
                    placeholder="e.g. 800"
                  />
                </Field>
                <Field label="Specialized Skills">
                  <Input
                    value={form.skills}
                    onChange={(e) => set("skills", e.target.value)}
                    placeholder="e.g. Mina, Polishing, Diamond Setting"
                  />
                </Field>
                <Field label="Experience">
                  <Input
                    value={form.experience}
                    onChange={(e) => set("experience", e.target.value)}
                    placeholder="e.g. 10 years master artisan"
                  />
                </Field>
                <Field label="Spouse / Father Name">
                  <Input
                    value={form.spouseName}
                    onChange={(e) => set("spouseName", e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {/* Custom fields defined in Settings → Forms */}
          {customForms.map((f) => (
            <div key={f.id} className="grid gap-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border">
                {f.name}
              </div>
              <DynamicFields
                fields={f.fields}
                values={form.customForms?.[f.id] ?? {}}
                onChange={(name, value) => setCustomField(f.id, name, value)}
              />
              {customFieldErrors[f.id] && (
                <p className="text-xs text-destructive font-medium">{customFieldErrors[f.id]}</p>
              )}
            </div>
          ))}

          <Field label="Internal Notes & Special Terms">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Terms, commission rates, or delivery instructions"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="people-save" onClick={save} disabled={submitting}>
            {submitting ? (
              <InlineSavingState />
            ) : initial ? (
              "Save Party Changes"
            ) : (
              "Create Party Master"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FieldProps {
  label: string;
  error?: string;
  warning?: string;
  children: React.ReactNode;
}

function Field({ label, error, warning, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive font-medium mt-0.5">{error}</p>}
      {warning && <p className="text-xs text-amber-500 font-medium mt-0.5">{warning}</p>}
    </div>
  );
}

// re-export for tab routing logic (used elsewhere later)
export { tabsForType };
