import { useEffect, useState } from "react";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import {
  usePeople,
  PERSON_TYPE_LABELS,
  maskAadhaar,
  kycComplete,
  KYC_DOC_LABELS,
  type KycDocKey,
} from "@/lib/people-store";
import { FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useAttachments, getAttachmentUrl } from "@/lib/attachments-store";
import { peopleForms } from "@/components/forms/DynamicFields";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintLayout } from "@/components/print/PrintLayout";
import { useSettings } from "@/lib/settings-store";
import { generateKycCoverSheetPdf } from "@/lib/pdf/document-pdf-generator";
import { toast } from "sonner";

export const Route = createFileRoute("/people/print/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    const shortName =
      shopName
        ?.split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase() ||
      shopName?.slice(0, 3).toUpperCase() ||
      "ERP";
    return {
      meta: [{ title: `KYC Sheet · ${shortName}` }],
    };
  },
  component: PrintPage,
});

/** One printable document: whatever the KYC slot holds, from the attachments store. */
interface KycDoc {
  docKey: string;
  label: string;
  number?: string;
  url?: string;
  fileName?: string;
  isImage: boolean;
  updatedAt?: number;
}

function PrintPage() {
  const { id } = useParams({ from: "/people/print/$id" });
  const person = usePeople((s) => s.people.find((p) => p.id === id));
  // Source of truth for KYC files: attachment metadata plus Supabase-backed
  // storage references. Legacy inlined rows are still readable.
  const attachmentItems = useAttachments((s) => s.items);
  const formsMetadata = useSettings((s) => s.formsMetadata);
  const firm = useSettings((s) => s.firm);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Full-size bytes, resolved from document storage. Printing off the 240px thumbnail
  // would be unreadable, and non-image docs (PDF scans) have no thumbnail at
  // all — they'd silently drop off the printout entirely.
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});
  const prefixForPerson = person ? `person:${person.id}:` : null;
  const [loadingUrls, setLoadingUrls] = useState(true);

  useEffect(() => {
    if (!prefixForPerson) {
      setLoadingUrls(false);
      return;
    }
    let cancelled = false;
    const keys = Object.keys(attachmentItems).filter((k) => k.startsWith(prefixForPerson));

    if (keys.length === 0) {
      setLoadingUrls(false);
      return;
    }

    void Promise.all(
      keys.map(async (key) => {
        const docKey = key.slice(prefixForPerson.length);
        try {
          const url = await getAttachmentUrl("person", person!.id, docKey);
          return url ? ([key, url] as const) : null;
        } catch (err) {
          console.warn(`[people.print] could not load ${key}:`, err);
          return null;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setResolvedUrls(Object.fromEntries(pairs.filter((p): p is [string, string] => !!p)));
      setLoadingUrls(false);
    });

    return () => {
      cancelled = true;
    };
  }, [prefixForPerson, attachmentItems]);

  useEffect(() => {
    if (!loadingUrls) {
      document.documentElement.setAttribute("data-print-ready", "true");
    } else {
      document.documentElement.removeAttribute("data-print-ready");
    }
  }, [loadingUrls]);

  const {
    docNumber,
    isReprint,
    reprintCount,
    reprintOpen,
    setReprintOpen,
    handlePrintTrigger,
    recordReprint,
  } = usePrintRecord("worker_kyc", person?.id ?? "");

  if (!person) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
        <div className="text-center space-y-3">
          <h1 className="font-serif text-2xl text-gold">Record not found</h1>
          <p className="text-sm text-muted-foreground">This person may have been removed.</p>
          <Link to="/people" className="text-gold underline">
            Back to People
          </Link>
        </div>
      </div>
    );
  }

  const isKycComplete = kycComplete(person);
  const isWorkerType = ["karigar", "worker", "employee", "outside_worker"].includes(person.type);

  // Only forms this person actually has values for — printing a heading over six
  // blank cells is noise on a document someone has to file.
  const printableCustomForms = peopleForms(formsMetadata).filter((f) =>
    f.fields.some((field) => {
      const v = person.customForms?.[f.id]?.[field.name];
      return v !== undefined && v !== null && v !== "";
    }),
  );

  const prefix = `person:${person.id}:`;
  const docNumbers: Partial<Record<KycDocKey, string | undefined>> = {
    aadhaar_front: maskAadhaar(person.aadhaar),
    aadhaar_back: maskAadhaar(person.aadhaar),
    pan: person.pan,
  };

  const docs: KycDoc[] = Object.entries(attachmentItems)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, rec]) => {
      const docKey = key.slice(prefix.length);
      // Vault bytes win; thumbnail/base64 are the fallback while they load and
      // for legacy pre-vault records.
      const url = resolvedUrls[key] || rec.fileDataUrl || rec.thumbnailDataUrl;
      const name = rec.fileName ?? "";
      return {
        docKey,
        label: KYC_DOC_LABELS[docKey as KycDocKey] ?? docKey,
        number: docNumbers[docKey as KycDocKey],
        url,
        fileName: name,
        isImage:
          !!url &&
          // mimeType is authoritative for vaulted files — their object URL is a
          // `blob:` and carries no type hint the way a data: URL does.
          ((rec.mimeType?.startsWith("image/") ?? false) ||
            url.startsWith("data:image/") ||
            /\.(jpg|jpeg|png|webp|gif)$/i.test(name) ||
            (!rec.mimeType && !name)),
        updatedAt: rec.updatedAt,
      };
    })
    .filter((d) => !!d.url);

  const photoDoc = docs.find((d) => d.docKey === "photo");
  const attachedDocs = docs.filter((d) => d !== photoDoc);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const blob = generateKycCoverSheetPdf(
        {
          fullName: person!.fullName,
          personType: PERSON_TYPE_LABELS[person!.type],
          aadhaarMasked: person!.aadhaar ? maskAadhaar(person!.aadhaar) : undefined,
          panNumber: person!.pan,
          phone: person!.phone,
          altPhone: person!.altPhone,
          email: person!.email,
          currentAddress: person!.currentAddress,
          workType: person!.workType,
          joiningDate: person!.joiningDate,
          kycComplete: isKycComplete,
          attachedDocs: docs.map((d) => d.label),
          customFields: printableCustomForms.flatMap((f) =>
            f.fields
              .map((field) => {
                const raw = person!.customForms?.[f.id]?.[field.name];
                if (raw === undefined || raw === null || raw === "") return null;
                const value = typeof raw === "boolean" ? (raw ? "Yes" : "No") : String(raw);
                return { label: `${f.name}: ${field.label}`, value };
              })
              .filter((x): x is { label: string; value: string } => x !== null),
          ),
        },
        firm,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KYC-${person!.fullName.replace(/\s+/g, "-")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-foreground">
      <PrintToolbar
        title="KYC Sheet"
        docNumber={docNumber}
        isReprint={isReprint}
        reprintCount={reprintCount}
        reprintOpen={reprintOpen}
        setReprintOpen={setReprintOpen}
        onPrint={handlePrintTrigger}
        onReprintConfirm={recordReprint}
        backUrl="/people"
        onDownloadPdf={handleDownloadPdf}
        downloadingPdf={downloadingPdf}
      />

      <div className="p-4 md:p-8 flex flex-col items-center gap-8 overflow-y-auto">
        {
          <>
            {/* PAGE 1: COVER SHEET */}
            <PrintLayout
              title={isWorkerType ? "Worker KYC Cover Sheet" : "Customer KYC Cover Sheet"}
              docNumber={docNumber}
              docType="worker_kyc"
              recordId={person.id}
              createdAt={person.createdAt}
              size="a4"
              showQR={true}
              qrLabel="Verify KYC"
              qrPosition="footer"
            >
              <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                  <div className="text-3xl font-bold text-black">{person.fullName}</div>
                  <div className="text-sm text-stone-600 mt-1">
                    <span className="uppercase tracking-wider font-semibold">
                      {PERSON_TYPE_LABELS[person.type]}
                    </span>{" "}
                    · ID: {person.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
                {photoDoc?.url ? (
                  <div className="h-32 w-28 border-2 border-stone-300 overflow-hidden bg-stone-50 flex-shrink-0 shadow-sm">
                    <img
                      src={photoDoc.url}
                      alt="Passport"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="h-32 w-28 border-2 border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-xs text-stone-400 text-center flex-shrink-0">
                    Affix
                    <br />
                    Photo
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-8">
                <InfoCell label="Mobile Number" value={person.phone} />
                <InfoCell label="Alt Mobile" value={person.altPhone} />
                <InfoCell label="Email" value={person.email} />
                <InfoCell label="Current Address" value={person.currentAddress} />
                <InfoCell
                  label="Aadhaar Number"
                  value={person.aadhaar ? maskAadhaar(person.aadhaar) : null}
                />
                <InfoCell label="PAN Number" value={person.pan} />
                <InfoCell label="Work / Trade" value={person.workType} />
                <InfoCell label="Joining Date" value={person.joiningDate} />
              </div>

              {/* Custom fields defined in Settings → Forms. Printed alongside the
                  built-in details so a field the workshop chose to capture
                  actually reaches the paper record. */}
              {printableCustomForms.map((f) => (
                <div key={f.id} className="mb-8">
                  <div className="font-semibold text-lg mb-3 border-b border-stone-300 pb-1">
                    {f.name}
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {f.fields.map((field) => {
                      const raw = person.customForms?.[f.id]?.[field.name];
                      const value = typeof raw === "boolean" ? (raw ? "Yes" : "No") : (raw ?? null);
                      return (
                        <InfoCell
                          key={field.name}
                          label={field.label}
                          value={value === "" ? null : (value as string | null)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="border border-stone-300 p-6 rounded bg-stone-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-semibold text-lg">Verification Status</div>
                  {isKycComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
                <div className="text-sm mb-8">
                  {isKycComplete ? (
                    <span className="text-green-700 font-bold tracking-wide">
                      COMPLETE - FULLY VERIFIED
                    </span>
                  ) : (
                    <span className="text-yellow-700 font-bold tracking-wide">
                      INCOMPLETE - PENDING DOCUMENTS
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-8 mt-12 text-sm text-stone-600">
                  <div className="border-t border-stone-400 pt-2">
                    Verified By (Name & Designation)
                  </div>
                  <div className="border-t border-stone-400 pt-2 text-right">
                    Authorised Signature & Stamp
                  </div>
                </div>
              </div>
            </PrintLayout>

            {/* PAGE 2+: ATTACHED DOCUMENTS */}
            {attachedDocs.map((doc) => (
              <div key={doc.docKey} className="print:break-before-page w-full flex justify-center">
                <PrintLayout
                  title={doc.label}
                  docNumber={doc.number || "—"}
                  docType="worker_kyc"
                  recordId={person.id}
                  createdAt={doc.updatedAt}
                  size="a4"
                  showQR={false}
                >
                  <div className="flex items-start justify-between gap-4 mb-4 border-b border-stone-200 pb-4">
                    <div>
                      <div className="text-2xl font-bold">{person.fullName}</div>
                      <div className="text-sm text-stone-600 font-mono mt-1">
                        ID: {person.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div className="text-sm font-medium mt-3 text-stone-800">
                        Attached Document: <span className="font-bold">{doc.label}</span>
                      </div>
                      <div className="text-xs text-stone-500 mt-1">
                        Status: {isKycComplete ? "Verified Profile" : "Pending Verification"}
                      </div>
                    </div>
                    {photoDoc?.url ? (
                      <div className="h-24 w-20 border border-stone-300 overflow-hidden bg-stone-50 flex-shrink-0 shadow-sm">
                        <img
                          src={photoDoc.url}
                          alt="Passport Thumb"
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-20 border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-[10px] text-stone-400 text-center flex-shrink-0">
                        No
                        <br />
                        Photo
                      </div>
                    )}
                  </div>

                  <div className="mt-2 border border-stone-200 h-[190mm] flex items-center justify-center bg-stone-50/30 p-2 overflow-hidden rounded">
                    {doc.isImage ? (
                      <img
                        src={doc.url}
                        alt={doc.label}
                        className="max-h-full max-w-full object-contain drop-shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-stone-500">
                        <FileText className="h-16 w-16 mb-2 text-stone-300" />
                        <div className="font-medium text-stone-600">
                          Non-image document attached
                        </div>
                        <div className="text-xs font-mono mt-1 text-stone-400">{doc.fileName}</div>
                      </div>
                    )}
                  </div>
                </PrintLayout>
              </div>
            ))}
          </>
        }
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b border-stone-200 pb-1">
      <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">{label}</div>
      <div className="text-sm font-semibold text-stone-900 mt-1">{value || "—"}</div>
    </div>
  );
}
