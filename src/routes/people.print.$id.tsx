import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePeople, PERSON_TYPE_LABELS, maskAadhaar, kycComplete } from "@/lib/people-store";
import { FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { listAttachments } from "@/lib/fileUpload";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { usePrintRecord } from "@/components/print/usePrintRecord";
import { PrintLayout } from "@/components/print/PrintLayout";
import { useSettings } from "@/lib/settings-store";

export const Route = createFileRoute("/people/print/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    const shortName =
      shopName
        ?.split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || shopName?.slice(0, 3).toUpperCase() || "ERP";
    return {
      meta: [{ title: `KYC Sheet · ${shortName}` }],
    };
  },
  component: PrintPage,
});

function PrintPage() {
  const { id } = useParams({ from: "/people/print/$id" });
  const person = usePeople((s) => s.people.find((p) => p.id === id));
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAttachments() {
      if (!person?.id) return;
      try {
        const list = await listAttachments("person", person.id);
        setAttachments(list);
      } catch (e) {
        console.error("Error loading KYC attachments:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchAttachments();
  }, [person?.id]);

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

  const photoFile =
    attachments.find((a) => {
      const n = (a.notes || "").toLowerCase();
      const f = (a.original_file_name || "").toLowerCase();
      return (
        n.includes("photo") ||
        n.includes("face") ||
        n.includes("avatar") ||
        f.includes("photo") ||
        f.includes("face") ||
        f.includes("avatar")
      );
    }) || attachments.find((a) => a.mime_type?.startsWith("image/"));

  const docAttachments = attachments.filter((a) => a !== photoFile);
  const isKycComplete = kycComplete(person);
  const isWorkerType = ["karigar", "worker", "employee", "outside_worker"].includes(person.type);

  function findAttachment(...keywords: string[]) {
    return docAttachments.find((a) => {
      const hay = `${a.notes || ""} ${a.original_file_name || ""}`.toLowerCase();
      return keywords.some((k) => hay.includes(k));
    });
  }

  type DocRow = { label: string; number?: string; file?: (typeof attachments)[number] };
  const documentRows: DocRow[] = [
    {
      label: "Aadhaar Front",
      number: maskAadhaar(person.aadhaar),
      file: findAttachment("aadhaar front", "aadhaar_front"),
    },
    {
      label: "Aadhaar Back",
      number: maskAadhaar(person.aadhaar),
      file: findAttachment("aadhaar back", "aadhaar_back"),
    },
    { label: "PAN Card", number: person.pan, file: findAttachment("pan") },
    { label: "Address Proof", file: findAttachment("address") },
    { label: "Driving Licence", file: findAttachment("driving", "licence", "license", "dl") },
    { label: "Passport", file: findAttachment("passport") },
    { label: "Signature", file: findAttachment("signature", "sign") },
  ];
  const matchedFiles = new Set(documentRows.map((r) => r.file).filter(Boolean));
  const otherAttachments = docAttachments.filter((a) => !matchedFiles.has(a));
  for (const a of otherAttachments) {
    documentRows.push({ label: a.notes || a.original_file_name || "Other Document", file: a });
  }
  const attachedDocs = documentRows.filter(r => r.file);

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
      />

      <div className="p-4 md:p-8 flex flex-col items-center gap-8 overflow-y-auto">
        {loading && (
          <div className="text-sm text-muted-foreground animate-pulse">Loading KYC records...</div>
        )}

        {!loading && (
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
                    <span className="uppercase tracking-wider font-semibold">{PERSON_TYPE_LABELS[person.type]}</span> · ID: {person.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
                {photoFile ? (
                  <div className="h-32 w-28 border-2 border-stone-300 overflow-hidden bg-stone-50 flex-shrink-0 shadow-sm">
                    <img
                      src={photoFile.file_url}
                      alt="Passport"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="h-32 w-28 border-2 border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-xs text-stone-400 text-center flex-shrink-0">
                    Affix<br />Photo
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-8">
                <InfoCell label="Mobile Number" value={person.phone} />
                <InfoCell label="Alt Mobile" value={person.altPhone} />
                <InfoCell label="Email" value={person.email} />
                <InfoCell label="Current Address" value={person.currentAddress} />
                <InfoCell label="Aadhaar Number" value={person.aadhaar ? maskAadhaar(person.aadhaar) : null} />
                <InfoCell label="PAN Number" value={person.pan} />
                <InfoCell label="Work / Trade" value={person.workType} />
                <InfoCell label="Joining Date" value={person.joiningDate} />
              </div>

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
                    <span className="text-green-700 font-bold tracking-wide">COMPLETE - FULLY VERIFIED</span>
                  ) : (
                    <span className="text-yellow-700 font-bold tracking-wide">INCOMPLETE - PENDING DOCUMENTS</span>
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
              <div key={doc.file?.id} className="print:break-before-page w-full flex justify-center">
                <PrintLayout
                  title={doc.label}
                  docNumber={doc.number || "—"}
                  docType="worker_kyc"
                  recordId={person.id}
                  createdAt={doc.file?.uploaded_at}
                  size="a4"
                  showQR={false}
                >
                  <div className="flex items-start justify-between gap-4 mb-4 border-b border-stone-200 pb-4">
                    <div>
                      <div className="text-2xl font-bold">{person.fullName}</div>
                      <div className="text-sm text-stone-600 font-mono mt-1">ID: {person.id.slice(0, 8).toUpperCase()}</div>
                      <div className="text-sm font-medium mt-3 text-stone-800">Attached Document: <span className="font-bold">{doc.label}</span></div>
                      <div className="text-xs text-stone-500 mt-1">Status: {isKycComplete ? "Verified Profile" : "Pending Verification"}</div>
                    </div>
                    {photoFile ? (
                      <div className="h-24 w-20 border border-stone-300 overflow-hidden bg-stone-50 flex-shrink-0 shadow-sm">
                        <img
                          src={photoFile.file_url}
                          alt="Passport Thumb"
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="h-24 w-20 border border-dashed border-stone-300 bg-stone-50 flex items-center justify-center text-[10px] text-stone-400 text-center flex-shrink-0">
                        No<br />Photo
                      </div>
                    )}
                  </div>

                  <div className="mt-2 border border-stone-200 h-[190mm] flex items-center justify-center bg-stone-50/30 p-2 overflow-hidden rounded">
                    {doc.file?.mime_type?.startsWith("image/") ? (
                      <img
                        src={doc.file.file_url}
                        alt={doc.label}
                        className="max-h-full max-w-full object-contain drop-shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-stone-500">
                        <FileText className="h-16 w-16 mb-2 text-stone-300" />
                        <div className="font-medium text-stone-600">Non-image document attached</div>
                        <div className="text-xs font-mono mt-1 text-stone-400">{doc.file?.original_file_name}</div>
                      </div>
                    )}
                  </div>
                </PrintLayout>
              </div>
            ))}
          </>
        )}
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
