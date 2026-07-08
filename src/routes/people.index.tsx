import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
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
  PERSON_TYPE_LABELS,
  KYC_DOC_LABELS,
  maskAadhaar,
  kycComplete,
  tabsForType,
} from "@/lib/people-store";
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
  Coins,
  Clock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AttachmentButton } from "@/components/attachment-placeholder-modal";
import { useAttachments } from "@/lib/attachments-store";
import { useSettings } from "@/lib/settings-store";
import { PrintPreviewModal } from "@/components/print/PrintPreviewModal";

import { compileCustomerLedger } from "@/lib/customer-account-ledger";
import { useGoldSettlement } from "@/lib/gold-settlement-store";
import { useLedger } from "@/lib/ledger-store";
import { fineGoldMg, mgToGrams, gramsToMg, parsePurity, COMMON_PURITIES } from "@/lib/gold";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";

import { guardRoute } from "@/lib/permissions";

export const Route = createFileRoute("/people/")({
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "People / KYC · AVS Gold ERP" }] }),
  component: PeoplePage,
});

const TABS = [
  { key: "customers", label: "Customers", icon: User, types: ["customer"] as PersonType[] },
  { key: "firms", label: "Firms", icon: Building2, types: ["firm_customer"] as PersonType[] },
  {
    key: "karigars",
    label: "Karigars / Workers",
    icon: Hammer,
    types: ["karigar", "worker"] as PersonType[],
  },
  { key: "employees", label: "Employees", icon: Briefcase, types: ["employee"] as PersonType[] },
  {
    key: "vendors",
    label: "Vendors / Outside Workers",
    icon: Truck,
    types: ["vendor", "outside_worker"] as PersonType[],
  },
  { key: "kyc", label: "KYC Documents", icon: FileText, types: [] as PersonType[] },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function PeoplePage() {
  const { t } = useLanguage();
  const people = usePeople((s) => s.people);
  const [tab, setTab] = useState<TabKey>("customers");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewingLedgerId, setViewingLedgerId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Person | null>(null);
  const [addingType, setAddingType] = useState<PersonType | null>(null);
  const [storageNotice, setStorageNotice] = useState(false);

  const [printOpen, setPrintOpen] = useState(false);
  const [printUrl, setPrintUrl] = useState("");
  const [printTitle, setPrintTitle] = useState("");

  const triggerPrint = (url: string, titleName: string) => {
    setPrintUrl(url);
    setPrintTitle(titleName);
    setPrintOpen(true);
  };

  const selected = useMemo(
    () => people.find((p) => p.id === selectedId) ?? null,
    [people, selectedId],
  );

  const filteredForTab = useMemo(() => {
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
          (p.workType ?? "").toLowerCase().includes(q),
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

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="flex flex-wrap h-auto bg-card border border-border p-1">
          {TABS.map((tItem) => {
            const Icon = tItem.icon;
            const count =
              tItem.key === "kyc"
                ? people.filter((p) => !kycComplete(p)).length
                : people.filter((p) => tItem.types.includes(p.type)).length;
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
                    onChange={(e) => setQuery(e.target.value)}
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
                        list={filteredForTab}
                        selectedId={selectedId}
                        onSelect={(id) => {
                          setSelectedId(id);
                          setViewingLedgerId(null);
                        }}
                        onEdit={(p) => setEditing(p)}
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

      <PrintPreviewModal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={printTitle}
        printUrl={printUrl}
        docNo=""
      />
    </div>
  );
}

/* ----------------------------- Avatar ----------------------------- */

function PersonAvatar({ person, className }: { person: Person; className: string }) {
  const rec = useAttachments((s) => s.items[`person:${person.id}:photo`]);
  const [broken, setBroken] = useState(false);
  const photoUrl = rec?.fileDataUrl;
  if (photoUrl && !broken) {
    return (
      <div className={`${className} overflow-hidden bg-accent`}>
        <img
          src={photoUrl}
          alt={person.fullName}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={`${className} gradient-gold grid place-items-center text-primary-foreground font-serif`}
    >
      {person.fullName.charAt(0).toUpperCase()}
    </div>
  );
}

/* ----------------------------- Lists ----------------------------- */

function PeopleList({
  list,
  selectedId,
  onSelect,
  onEdit,
}: {
  list: Person[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (p: Person) => void;
}) {
  const { t } = useLanguage();
  const setActive = usePeople((s) => s.setActive);
  const remove = usePeople((s) => s.remove);
  const handleDelete = (p: Person) => {
    if (!window.confirm(`Delete ${p.fullName}? This cannot be undone.`)) return;
    remove(p.id)
      .then(() => toast.success(`${p.fullName} deleted.`))
      .catch(() => toast.error(`Failed to delete ${p.fullName}.`));
  };
  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-muted-foreground">
        {t("people.no_records")}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {list.map((p) => {
        const isSel = p.id === selectedId;
        return (
          <div
            key={p.id}
            className={`rounded-xl border bg-card p-4 transition-all ${
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
                <Button size="sm" variant="ghost" onClick={() => setActive(p.id, !p.active)}>
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
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-muted-foreground">
        {t("people.add_person_first")}
      </div>
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
        <div key={p.id} className="rounded-xl border border-border bg-card p-4">
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
  if (!person) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
        <div className="font-serif text-gold text-lg mb-1">{t("people.selected_title")}</div>
        {t("people.selected_placeholder")}
      </div>
    );
  }
  const isCustomerLike = person.type === "customer" || person.type === "firm_customer";
  return (
    <div
      data-testid="people-selected-card"
      className="rounded-2xl border border-gold/30 bg-card p-5 shadow-gold space-y-4"
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right break-words">{value}</span>
    </div>
  );
}

/* ----------------------------- Form dialog ----------------------------- */

function PersonFormDialog({
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
    active: initial?.active ?? true,
    fullName: initial?.fullName ?? "",
    phone: initial?.phone ?? "",
    altPhone: initial?.altPhone ?? "",
    email: initial?.email ?? "",
    currentAddress: initial?.currentAddress ?? "",
    permanentAddress: initial?.permanentAddress ?? "",
    villageCity: initial?.villageCity ?? "",
    state: initial?.state ?? "",
    aadhaar: initial?.aadhaar ?? "",
    pan: initial?.pan ?? "",
    gstin: initial?.gstin ?? "",
    workType: initial?.workType ?? "",
    joiningDate: initial?.joiningDate ?? "",
    emergencyName: initial?.emergencyName ?? "",
    emergencyPhone: initial?.emergencyPhone ?? "",
    referenceName: initial?.referenceName ?? "",
    referencePhone: initial?.referencePhone ?? "",
    dateOfBirth: initial?.dateOfBirth ?? "",
    skills: initial?.skills ?? "",
    experience: initial?.experience ?? "",
    dailyWagePaise: initial?.dailyWagePaise ?? (undefined as number | undefined),
    bankAccountName: initial?.bankAccountName ?? "",
    bankAccountNumber: initial?.bankAccountNumber ?? "",
    bankIfsc: initial?.bankIfsc ?? "",
    bankName: initial?.bankName ?? "",
    notes: initial?.notes ?? "",
    branchId: initial?.branchId ?? useSettings.getState().selectedBranchId ?? "",
  };
  const key = (initial?.id ?? "new") + "-" + (defaultType ?? "");
  const [form, setForm, clearForm] = useDraft("mtj-person-form-" + key, () => empty);
  // Reset when the dialog opens with a different target (e.g. "Add Karigar"
  // clicked after "Add Customer" was previously open). `useDraft`'s internal
  // useState only initializes once per component instance — since this
  // dialog is always mounted (parent toggles `open`, never unmounts it), a
  // changed `key` alone doesn't re-run that initializer, so the previous
  // type/fields would otherwise persist into the newly-opened dialog.
  const [lastKey, setLastKey] = useState(key);
  if (open && lastKey !== key) {
    setForm(empty);
    setErrors({});
    setWarnings({});
    setLastKey(key);
  }

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Clear error active for this field
    if (errors[k]) {
      setErrors((e) => ({ ...e, [k]: "" }));
    }
  };

  const isFirm = form.type === "firm_customer";
  const isWorkerish = ["karigar", "worker", "employee", "vendor", "outside_worker"].includes(
    form.type,
  );

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

    if (isFirm && form.gstin.trim()) {
      const cleanGst = form.gstin.trim().toUpperCase();
      const gstinReg = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinReg.test(cleanGst)) {
        newErrors.gstin = "Invalid Indian GSTIN format rules.";
      }
    }

    setErrors(newErrors);
    setWarnings(newWarnings);

    return Object.keys(newErrors).length === 0;
  };

  const save = () => {
    if (submitting) return;
    if (!validate()) return;
    setSubmitting(true);
    if (initial) {
      update(initial.id, form)
        .then(() => onSaved({ ...initial, ...form, updatedAt: Date.now() }))
        .finally(() => setSubmitting(false));
    } else {
      add(form)
        .then((created) => onSaved(created))
        .catch(() => {})
        .finally(() => setSubmitting(false));
    }
    clearForm();
    onClose();
  };

  // Keyboard-first (Priority 4/3): Ctrl+S saves without reaching for the mouse.
  useSaveShortcut(save, open);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-gold text-2xl">
            {initial ? "Edit Person" : "Add Person"}
          </DialogTitle>
          <DialogDescription>
            Simple, plain details. Use the box you would normally write on paper.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Type</Label>
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

          <div className="grid gap-2">
            <Label>Branch</Label>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name *" error={errors.fullName}>
              <Input
                data-testid="people-full-name"
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
              />
            </Field>
            <Field label="Phone *" error={errors.phone} warning={warnings.phone}>
              <Input
                data-testid="people-phone"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                inputMode="tel"
              />
            </Field>
            <Field label="Alternate phone">
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
            <Field label="Village / City">
              <Input
                value={form.villageCity}
                onChange={(e) => set("villageCity", e.target.value)}
              />
            </Field>
            <Field label="State">
              <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label="Current address">
              <Input
                value={form.currentAddress}
                onChange={(e) => set("currentAddress", e.target.value)}
              />
            </Field>
            <Field label="Permanent / native address">
              <Input
                value={form.permanentAddress}
                onChange={(e) => set("permanentAddress", e.target.value)}
              />
            </Field>
            <Field label="Aadhaar number" error={errors.aadhaar} warning={warnings.aadhaar}>
              <Input
                value={form.aadhaar}
                onChange={(e) => set("aadhaar", e.target.value)}
                placeholder="XXXX XXXX 1234"
              />
            </Field>
            <Field label="PAN (optional)">
              <Input value={form.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} />
            </Field>
            {isFirm && (
              <Field label="GSTIN" error={errors.gstin}>
                <Input
                  value={form.gstin}
                  onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                />
              </Field>
            )}
            {isWorkerish && (
              <>
                <Field label="Work type / role *" error={errors.workType}>
                  <Input
                    data-testid="people-work-role"
                    value={form.workType}
                    onChange={(e) => set("workType", e.target.value)}
                    placeholder="e.g. Hand-making, Polishing, Billing"
                  />
                </Field>
                <Field label="Joining date">
                  <Input
                    type="date"
                    value={form.joiningDate}
                    onChange={(e) => set("joiningDate", e.target.value)}
                  />
                </Field>
                <Field label="Date of birth">
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => set("dateOfBirth", e.target.value)}
                  />
                </Field>
                <Field label="Daily wage (₹)">
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
                <Field label="Skills">
                  <Input
                    value={form.skills}
                    onChange={(e) => set("skills", e.target.value)}
                    placeholder="e.g. Hand-making, Soldering, Filigree"
                  />
                </Field>
                <Field label="Experience">
                  <Input
                    value={form.experience}
                    onChange={(e) => set("experience", e.target.value)}
                    placeholder="e.g. 8 years goldsmithing"
                  />
                </Field>
              </>
            )}
            {isWorkerish && (
              <>
                <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border">
                  Bank Account Details
                </div>
                <Field label="Account holder name">
                  <Input
                    value={form.bankAccountName}
                    onChange={(e) => set("bankAccountName", e.target.value)}
                  />
                </Field>
                <Field label="Account number">
                  <Input
                    value={form.bankAccountNumber}
                    onChange={(e) => set("bankAccountNumber", e.target.value)}
                    inputMode="numeric"
                  />
                </Field>
                <Field label="IFSC code">
                  <Input
                    value={form.bankIfsc}
                    onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                  />
                </Field>
                <Field label="Bank name">
                  <Input
                    value={form.bankName}
                    onChange={(e) => set("bankName", e.target.value)}
                    placeholder="e.g. State Bank of India"
                  />
                </Field>
              </>
            )}
            <Field label="Emergency contact name">
              <Input
                value={form.emergencyName}
                onChange={(e) => set("emergencyName", e.target.value)}
              />
            </Field>
            <Field label="Emergency contact phone">
              <Input
                value={form.emergencyPhone}
                onChange={(e) => set("emergencyPhone", e.target.value)}
                inputMode="tel"
              />
            </Field>
            <Field label="Reference / guarantor name">
              <Input
                value={form.referenceName}
                onChange={(e) => set("referenceName", e.target.value)}
              />
            </Field>
            <Field label="Reference / guarantor phone">
              <Input
                value={form.referencePhone}
                onChange={(e) => set("referencePhone", e.target.value)}
                inputMode="tel"
              />
            </Field>
          </div>

          <Field label="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button data-testid="people-save" onClick={save} disabled={submitting}>
            {submitting ? "Saving..." : initial ? "Save changes" : "Add person"}
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

/* -------------------- Customer Personal Ledger View -------------------- */

function CustomerPersonalLedgerView({
  person,
  onBack,
  triggerPrint,
}: {
  person: Person;
  onBack: () => void;
  triggerPrint: (url: string, titleName: string) => void;
}) {
  const { t } = useLanguage();
  const [showAddForm, setShowAddForm] = useState(false);
  const [txType, setTxType] = useState<
    "gold_received" | "gold_given" | "cash_received_against_gold" | "cash_paid_against_gold"
  >("gold_received");
  const [gross, setGross] = useState("");
  const [less, setLess] = useState("");
  const [purity, setPurity] = useState("916");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-run compiled ledger on change of settlements list or other store triggers
  const settlements = useGoldSettlement((s) => s.settlements);
  const ledger = useMemo(() => compileCustomerLedger(person.id), [person.id, settlements]);

  const calculatedFineMg = useMemo(() => {
    try {
      const g = gramsToMg(gross);
      const l = gramsToMg(less);
      const n = Math.max(0, g - l);
      const p = parsePurity(purity);
      return fineGoldMg(n, p);
    } catch {
      return 0;
    }
  }, [gross, less, purity]);

  // Auto-fill valued amount if rate and net gold are set
  useEffect(() => {
    const r = parseFloat(rate);
    const g = parseFloat(gross) || 0;
    const l = parseFloat(less) || 0;
    const net = Math.max(0, g - l);
    if (!isNaN(r) && r > 0 && net > 0) {
      setAmount((r * net).toFixed(2));
    }
  }, [rate, gross, less]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const purityVal = parsePurity(purity);
      const grossMg = gramsToMg(gross);
      const lessMg = gramsToMg(less);
      const netMg = Math.max(0, grossMg - lessMg);
      const fineMg = fineGoldMg(netMg, purityVal);
      const amountPaise = rupeesToPaise(amount);
      const ratePaise = rupeesToPaise(rate);

      if (["gold_received", "gold_given"].includes(txType) && grossMg <= 0) {
        throw new Error("Gross weight is required and must be greater than 0.");
      }

      if (
        ["cash_received_against_gold", "cash_paid_against_gold"].includes(txType) &&
        amountPaise <= 0
      ) {
        throw new Error("Amount is required and must be greater than 0.");
      }

      // 1. Add Settlement in store & sync to DB
      await useGoldSettlement.getState().addSettlement({
        party_type: "customer",
        party_id: person.id,
        settlement_type: txType,
        purity: purityVal,
        gross_mg: grossMg,
        net_mg: netMg,
        wastage_mg: lessMg,
        rate_per_gram_paise: ratePaise,
        amount_paise: amountPaise,
        notes: notes.trim() || undefined,
        direction: ["gold_received", "cash_received_against_gold"].includes(txType)
          ? "Jama"
          : "Naam",
      });

      // 2. Add ledger entry in global gold ledger for physical inventory synchronization
      if (txType === "gold_received") {
        await useLedger.getState().append({
          type: "customer_gold_received",
          netFineMg: fineMg,
          deltas: { customer: fineMg },
          grossMg: grossMg,
          purity: purityVal,
          fineMg,
          notes: `Deposit from Customer ${person.fullName}: ${notes}`,
        });
      } else if (txType === "gold_given") {
        await useLedger.getState().append({
          type: "customer_gold_credit_applied",
          netFineMg: -fineMg,
          deltas: { customer: -fineMg },
          grossMg: grossMg,
          purity: purityVal,
          fineMg,
          notes: `Return/issue to Customer ${person.fullName}: ${notes}`,
        });
      }

      // Clear fields
      setGross("");
      setLess("");
      setRate("");
      setAmount("");
      setNotes("");
      setShowAddForm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5 h-9">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h2 className="font-serif text-xl text-gold">{person.fullName}'s Account</h2>
            <p className="text-xs text-muted-foreground">Running Gold Passbook & Monetary Ledger</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              triggerPrint(
                `/people/ledger-print/${person.id}`,
                `Ledger Statement · ${person.fullName}`,
              )
            }
            className="gap-1.5 h-9 text-gold border-gold/30 hover:bg-gold/10"
          >
            <Printer className="h-4 w-4" /> Print Statement
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-1.5 h-9 bg-primary text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Record Entry
          </Button>
        </div>
      </div>

      {/* Summaries Side-by-Side */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gold">
              Gold Account Custody
            </span>
            <div className="font-serif text-2xl text-gold mt-1 font-mono font-bold">
              {mgToGrams(ledger.closingGoldMg)}{" "}
              <span className="text-xs font-sans text-muted-foreground">g fine</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 font-mono">
              {ledger.closingGoldMg > 0
                ? "Advance Gold deposited (We owe them gold)"
                : ledger.closingGoldMg < 0
                  ? "Outstanding Gold balance (Customer owes us gold)"
                  : "Fully balanced"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Monetary Running Balance
            </span>
            <div
              className={`font-serif text-2xl mt-1 font-mono font-bold ${ledger.closingMoneyPaise > 0 ? "text-destructive" : ledger.closingMoneyPaise < 0 ? "text-emerald-500" : "text-foreground"}`}
            >
              ₹ {paiseToRupees(ledger.closingMoneyPaise)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {ledger.closingMoneyPaise > 0
                ? "Outstanding balance (Customer owes us money)"
                : ledger.closingMoneyPaise < 0
                  ? "Advance balance (Shop owes customer money)"
                  : "Fully balanced"}
            </p>
          </div>
        </div>
      </div>

      {/* Record Entry form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-elegant"
        >
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-serif text-base text-gold">Record Direct Gold/Money Entry</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 col-span-2">
              <Label>Transaction Type</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { v: "gold_received", label: "Gold Deposit" },
                  { v: "gold_given", label: "Gold Issue" },
                  { v: "cash_received_against_gold", label: "Receipt Payment" },
                  { v: "cash_paid_against_gold", label: "Payment Paid" },
                ].map((typeOption) => (
                  <Button
                    key={typeOption.v}
                    type="button"
                    variant={txType === typeOption.v ? "default" : "outline"}
                    className="text-xs h-8 px-2"
                    onClick={() => setTxType(typeOption.v as any)}
                  >
                    {typeOption.label}
                  </Button>
                ))}
              </div>
            </div>

            {["gold_received", "gold_given"].includes(txType) && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="grossWeight">Gross Weight (g)</Label>
                  <Input
                    id="grossWeight"
                    inputMode="decimal"
                    placeholder="10.000"
                    value={gross}
                    onChange={(e) => setGross(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lessWeight">Less Weight / Loss (g)</Label>
                  <Input
                    id="lessWeight"
                    inputMode="decimal"
                    placeholder="0.000"
                    value={less}
                    onChange={(e) => setLess(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txPurity">Purity (Touch)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="txPurity"
                      inputMode="numeric"
                      placeholder="916"
                      value={purity}
                      onChange={(e) => setPurity(e.target.value)}
                      required
                      className="flex-1 font-mono"
                    />
                    <Select value={purity} onValueChange={(v) => setPurity(v)}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_PURITIES.map((p) => (
                          <SelectItem key={p.value} value={String(p.value)}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Calculated Fine Gold</Label>
                  <div className="h-10 px-3 bg-muted/40 rounded-lg flex items-center text-sm font-mono text-gold font-bold">
                    {mgToGrams(calculatedFineMg)} g Fine
                  </div>
                </div>
              </>
            )}

            {["cash_received_against_gold", "cash_paid_against_gold"].includes(txType) && (
              <>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="txAmount">Amount (₹)</Label>
                  <Input
                    id="txAmount"
                    inputMode="decimal"
                    placeholder="50000.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="font-mono font-bold text-base"
                  />
                </div>
              </>
            )}

            {["gold_received", "gold_given"].includes(txType) && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="txRate">Optional Rate (₹/g)</Label>
                  <Input
                    id="txRate"
                    inputMode="decimal"
                    placeholder="7200.00"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txAmountComputed">Optional Valued Amount (₹)</Label>
                  <Input
                    id="txAmountComputed"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="txNotes">Notes / Description</Label>
              <Textarea
                id="txNotes"
                placeholder="Details of old gold ornament, metal transaction, cash payment, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-primary text-primary-foreground"
            >
              {submitting ? "Saving..." : "Save Entry"}
            </Button>
          </div>
        </form>
      )}

      {/* Ledger Passbook Table */}
      <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <span className="font-serif text-sm text-gold font-bold">Passbook Ledger Logs</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {ledger.rows.length} rows
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/45 text-muted-foreground text-[10px] uppercase font-mono tracking-wider border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Ref</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left min-w-[150px]">Description</th>
                <th className="px-3 py-3 text-right">Gold In</th>
                <th className="px-3 py-3 text-right">Gold Out</th>
                <th className="px-3 py-3 text-right">Dr (Money)</th>
                <th className="px-3 py-3 text-right">Cr (Money)</th>
                <th className="px-4 py-3 text-right font-bold border-l border-border/40">
                  Gold Bal
                </th>
                <th className="px-4 py-3 text-right font-bold font-sans">Money Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {ledger.rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/10">
                  <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                    {row.date}
                  </td>
                  <td className="px-3 py-2.5 font-mono uppercase text-muted-foreground">
                    {row.voucherNo}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-[10px] font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-[200px] break-words">
                    {row.description}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gold whitespace-nowrap">
                    {row.goldInMg > 0 ? `${mgToGrams(row.goldInMg)} g` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                    {row.goldOutMg > 0 ? `${mgToGrams(row.goldOutMg)} g` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-destructive whitespace-nowrap">
                    {row.moneyDebitPaise > 0 ? `₹${paiseToRupees(row.moneyDebitPaise)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-emerald-500 whitespace-nowrap">
                    {row.moneyCreditPaise > 0 ? `₹${paiseToRupees(row.moneyCreditPaise)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold font-mono text-gold border-l border-border/40 whitespace-nowrap">
                    {mgToGrams(row.closingGoldMg)} g
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-bold font-mono whitespace-nowrap ${row.closingMoneyPaise > 0 ? "text-destructive" : row.closingMoneyPaise < 0 ? "text-emerald-500" : "text-foreground"}`}
                  >
                    ₹{paiseToRupees(row.closingMoneyPaise)}
                  </td>
                </tr>
              ))}
              {ledger.rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-muted-foreground">
                    No ledger records found for this customer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// re-export for tab routing logic (used elsewhere later)
export { tabsForType };
