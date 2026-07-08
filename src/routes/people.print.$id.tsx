import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePeople, PERSON_TYPE_LABELS, maskAadhaar, kycComplete } from "@/lib/people-store";
import { Logo } from "@/components/ui/Logo";
import { FileText, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { useSettings } from "@/lib/settings-store";
import { AvsPrintFooter } from "@/components/AvsPrintFooter";
import { listAttachments } from "@/lib/fileUpload";
import { PrintToolbar } from "@/components/print/PrintToolbar";
import { usePrintRecord } from "@/components/print/usePrintRecord";

export const Route = createFileRoute("/people/print/$id")({
  head: () => {
    const shopName = useSettings.getState().firm?.shopName;
    const shortName =
      shopName
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
        .toUpperCase() || shopName.slice(0, 3).toUpperCase();
    return {
      meta: [{ title: `KYC Sheet · ${shortName} ERP` }],
    };
  },
  component: PrintPage,
});

function PrintPage() {
  const { firm } = useSettings();
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
  const printDate = new Date().toLocaleString("en-IN");

  function findAttachment(...keywords: string[]) {
    return docAttachments.find((a) => {
      const hay = `${a.notes || ""} ${a.original_file_name || ""}`.toLowerCase();
      return keywords.some((k) => hay.includes(k));
    });
  }

  // Row-format document list matching the legal-verification layout: each
  // row is one document with its own number and thumbnail, not a separate
  // status checklist plus a disconnected page-2 image gallery.
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

  return (
    <div className="min-h-screen bg-background text-foreground">
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

      <style>{`
        @page { size: A4; margin: 15mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-sheet { box-shadow: none !important; }
          .page-break { page-break-before: always; break-before: page; }
          .avoid-break { page-break-inside: avoid; break-inside: avoid; }
          .page-counter::after { content: counter(page); }
          body { counter-reset: page; }
          @page { counter-increment: page; }
        }
      `}</style>

      <div className="max-w-[210mm] mx-auto p-4 print:p-0">
        {/* PAGE 1 — KYC Summary */}
        <div className="print-sheet bg-white text-black border border-gray-300 rounded-lg print:rounded-none print:border-gray-400 p-8">
          {/* ── FIRM LETTERHEAD (thin strip) ── */}
          <div className="flex items-center gap-3 border-b border-gray-300 pb-2 mb-3">
            <Logo variant="svg" className="h-8 w-8 object-contain flex-shrink-0" />
            <div className="flex-1">
              <div className="font-bold text-sm text-gray-900 leading-tight">{firm.shopName}</div>
              <div className="flex flex-wrap gap-x-3 text-[9px] text-gray-500">
                {firm.address && <span>{firm.address}</span>}
                {firm.gstin && <span>GSTIN: {firm.gstin}</span>}
                {firm.phone && <span>Ph: {firm.phone}</span>}
              </div>
            </div>
          </div>

          {/* ── DOCUMENT TITLE ── */}
          <div className="text-center mb-3">
            <div className="inline-block border border-gray-400 px-6 py-1.5 rounded">
              <span className="text-[13px] font-bold uppercase tracking-[0.2em] text-gray-800">
                {isWorkerType
                  ? "Worker / Karigar KYC & Identity Sheet"
                  : "Customer / Party KYC Sheet"}
              </span>
            </div>
          </div>

          {/* ── TOP LEFT: Customer Information / TOP RIGHT: Passport Photo ── */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-4 mb-1">
            <div className="flex-1">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider">Full Name</div>
              <div className="font-bold text-xl text-gray-900 leading-tight">{person.fullName}</div>
              <div className="flex flex-wrap gap-x-4 mt-1 text-[11px] text-gray-600">
                <span>{PERSON_TYPE_LABELS[person.type]}</span>
                <span className={person.active ? "text-green-700" : "text-red-600"}>
                  {person.active ? "Active" : "Inactive"}
                </span>
                <span>ID: {person.id.slice(0, 8).toUpperCase()}</span>
              </div>
            </div>

            {/* Right: passport photo box */}
            <div className="flex-shrink-0 text-center">
              <div className="text-[9px] text-gray-500 mb-1 uppercase tracking-wider">
                Passport Photo
              </div>
              {photoFile ? (
                <div className="h-28 w-24 border-2 border-gray-400 overflow-hidden bg-gray-100">
                  <img
                    src={photoFile.file_url}
                    alt={person.fullName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <div className="h-28 w-24 border-2 border-dashed border-gray-400 bg-gray-50 flex items-center justify-center text-[10px] text-gray-400 text-center">
                  Affix
                  <br />
                  Photo
                </div>
              )}
            </div>
          </div>

          {/* ── KYC INFORMATION GRID ── */}
          <div className="border border-gray-300 rounded mt-3">
            {/* Contact row */}
            <div className="flex border-b border-gray-300">
              <InfoCell label="Mobile" value={person.phone} className="flex-1 border-r" />
              <InfoCell label="Alt. Mobile" value={person.altPhone} className="flex-1 border-r" />
              <InfoCell label="Email" value={person.email} className="flex-1 border-r" />
              <InfoCell label="Work / Trade" value={person.workType} className="flex-1" />
            </div>

            {/* Date rows */}
            <div className="flex border-b border-gray-300">
              <InfoCell
                label="Joining Date"
                value={person.joiningDate}
                className="flex-1 border-r"
              />
              <InfoCell
                label="Date of Birth"
                value={person.dateOfBirth}
                className="flex-1 border-r"
              />
              {isWorkerType && (
                <InfoCell
                  label="Daily Wage (₹)"
                  value={
                    person.dailyWagePaise
                      ? `₹${(person.dailyWagePaise / 100).toFixed(2)}`
                      : undefined
                  }
                  className="flex-1 border-r"
                />
              )}
              <InfoCell
                label="Branch"
                value={useSettings.getState().branches.find((b) => b.id === person.branchId)?.name}
                className="flex-1"
              />
            </div>

            {/* Identity */}
            <div className="flex border-b border-gray-300">
              <InfoCell
                label="Aadhaar (Masked)"
                value={maskAadhaar(person.aadhaar)}
                className="flex-1 border-r"
              />
              <InfoCell label="PAN Card" value={person.pan} className="flex-1 border-r" />
              <InfoCell label="GSTIN" value={person.gstin} className="flex-1" />
            </div>

            {/* Address */}
            <div className="flex border-b border-gray-300">
              <InfoCell
                label="Current Address"
                value={person.currentAddress}
                className="flex-1 border-r"
              />
              <InfoCell
                label="Permanent / Native Address"
                value={person.permanentAddress}
                className="flex-1"
              />
            </div>
            <div className="flex border-b border-gray-300">
              <InfoCell
                label="Village / City"
                value={person.villageCity}
                className="flex-1 border-r"
              />
              <InfoCell label="State" value={person.state} className="flex-1" />
            </div>

            {/* Emergency & Reference */}
            <div className="flex border-b border-gray-300">
              <InfoCell
                label="Emergency Contact Name"
                value={person.emergencyName}
                className="flex-1 border-r"
              />
              <InfoCell
                label="Emergency Phone"
                value={person.emergencyPhone}
                className="flex-1 border-r"
              />
              <InfoCell
                label="Reference Name"
                value={person.referenceName}
                className="flex-1 border-r"
              />
              <InfoCell label="Reference Phone" value={person.referencePhone} className="flex-1" />
            </div>

            {/* Skills & Experience (workers only) */}
            {isWorkerType && (
              <div className="flex border-b border-gray-300">
                <InfoCell label="Skills" value={person.skills} className="flex-1 border-r" />
                <InfoCell label="Experience" value={person.experience} className="flex-1" />
              </div>
            )}

            {/* Bank details (workers only) */}
            {isWorkerType && (
              <div className="flex border-b border-gray-300">
                <InfoCell
                  label="Bank Account Name"
                  value={person.bankAccountName}
                  className="flex-1 border-r"
                />
                <InfoCell
                  label="Account Number"
                  value={person.bankAccountNumber}
                  className="flex-1 border-r"
                />
                <InfoCell label="IFSC Code" value={person.bankIfsc} className="flex-1 border-r" />
                <InfoCell label="Bank Name" value={person.bankName} className="flex-1" />
              </div>
            )}

            {/* Notes */}
            {person.notes && (
              <div className="px-3 py-2 border-b border-gray-300">
                <div className="text-[9px] text-gray-500 uppercase tracking-wider">
                  Notes / Remarks
                </div>
                <div className="text-sm mt-0.5 whitespace-pre-wrap">{person.notes}</div>
              </div>
            )}

            {/* KYC Verification Status */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-600" />
                <div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider">
                    KYC Verification Status
                  </div>
                  <div className="font-bold text-sm">
                    {isKycComplete ? "COMPLETE — FULLY VERIFIED" : "INCOMPLETE — PENDING DOCUMENTS"}
                  </div>
                </div>
              </div>
              {isKycComplete ? (
                <div className="flex items-center gap-1 border border-green-600 text-green-700 text-xs font-bold px-2.5 py-1 rounded uppercase">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                </div>
              ) : (
                <div className="flex items-center gap-1 border border-amber-500 text-amber-700 text-xs font-bold px-2.5 py-1 rounded uppercase">
                  <AlertCircle className="h-3.5 w-3.5" /> Pending
                </div>
              )}
            </div>
          </div>

          {/* ── DOCUMENTS (row format: name, number, verification status, thumbnail) ── */}
          <div className="mt-5 avoid-break">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-700 border-b border-gray-400 pb-1 mb-2">
              KYC Documents
            </div>
            <table className="w-full text-xs border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-1.5 font-semibold border-b border-r border-gray-300">
                    Document
                  </th>
                  <th className="text-left px-3 py-1.5 font-semibold border-b border-r border-gray-300 w-32">
                    Document No.
                  </th>
                  <th className="text-center px-3 py-1.5 font-semibold border-b border-r border-gray-300 w-24">
                    Status
                  </th>
                  <th className="text-center px-3 py-1.5 font-semibold border-b border-gray-300 w-20">
                    Thumbnail
                  </th>
                </tr>
              </thead>
              <tbody>
                {documentRows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-1.5 border-b border-r border-gray-200 align-middle">
                      {row.label}
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-gray-200 align-middle font-mono text-[10px]">
                      {row.number || "—"}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-center border-b border-r border-gray-200 align-middle font-semibold ${row.file ? "text-green-700" : "text-red-600"}`}
                    >
                      {row.file ? "✓ On File" : "✗ Missing"}
                    </td>
                    <td className="px-2 py-1.5 border-b border-gray-200 align-middle">
                      {row.file && row.file.mime_type?.startsWith("image/") ? (
                        <img
                          src={row.file.file_url}
                          alt={row.label}
                          className="h-12 w-12 object-cover border border-gray-300 rounded mx-auto"
                          referrerPolicy="no-referrer"
                        />
                      ) : row.file ? (
                        <div className="h-12 w-12 border border-gray-300 rounded mx-auto flex items-center justify-center bg-gray-50">
                          <FileText className="h-5 w-5 text-gray-400" />
                        </div>
                      ) : (
                        <div className="h-12 w-12 border border-dashed border-gray-300 rounded mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── SIGNATURES ── */}
          <div className="mt-8 grid grid-cols-3 gap-8">
            <div>
              <div className="h-14 border-b-2 border-gray-400" />
              <div className="mt-1.5 text-[10px] text-gray-600 font-semibold">
                {person.fullName} — Signature / Thumb Impression
              </div>
            </div>
            <div>
              <div className="h-14 border-b-2 border-gray-400" />
              <div className="mt-1.5 text-[10px] text-gray-600 font-semibold">
                {firm.signatureLabelLeft || "Staff / Manager Signature"}
              </div>
            </div>
            <div>
              <div className="h-14 border-b-2 border-gray-400" />
              <div className="mt-1.5 text-[10px] text-gray-600 font-semibold">
                {firm.signatureLabelRight || "Authorised Signatory"}
              </div>
            </div>
          </div>

          <div className="mt-4 text-[9px] text-gray-400 text-center border-t border-gray-200 pt-2">
            Printed: {printDate} · This is a confidential internal KYC record of {firm.shopName}.
            Not for circulation.
          </div>
          <AvsPrintFooter />
        </div>

        {/* PAGE 2+ — KYC Document Images */}
        {!loading && attachments.length > 0 && (
          <div className="print-sheet page-break bg-white text-black border border-gray-300 rounded-lg print:rounded-none print:border-gray-400 p-8 mt-6 print:mt-0">
            {/* Header repeat */}
            <div className="flex items-center justify-between border-b-2 border-gray-800 pb-3 mb-5">
              <div className="flex items-center gap-3">
                <Logo variant="svg" className="h-10 w-10 object-contain" />
                <div>
                  <div className="font-bold text-base text-gray-900">{firm.shopName}</div>
                  <div className="text-[10px] text-gray-500">
                    KYC Documents & Proofs — {person.fullName}
                  </div>
                </div>
              </div>
              <div className="text-right text-[10px] text-gray-500">
                <div>ID: {person.id.slice(0, 8).toUpperCase()}</div>
                <div>Printed: {printDate}</div>
              </div>
            </div>

            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-700 border-b border-gray-400 pb-1 mb-4">
              Uploaded KYC Documents & Proofs ({attachments.length} file
              {attachments.length !== 1 ? "s" : ""})
            </div>

            <div className="grid grid-cols-2 gap-5">
              {attachments.map((file) => {
                const isImage = file.mime_type?.startsWith("image/");
                return (
                  <div
                    key={file.id}
                    className="avoid-break border border-gray-300 rounded p-3 bg-gray-50"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-gray-800 truncate max-w-[200px]">
                          {file.notes || file.original_file_name}
                        </div>
                        <div className="text-[9px] text-gray-500">
                          Uploaded:{" "}
                          {file.uploaded_at
                            ? new Date(file.uploaded_at).toLocaleDateString("en-IN")
                            : "—"}
                        </div>
                      </div>
                      {file.notes && (
                        <span className="text-[9px] bg-gray-200 text-gray-600 rounded px-1.5 py-0.5 font-semibold uppercase ml-1 whitespace-nowrap">
                          {file.notes.slice(0, 20)}
                        </span>
                      )}
                    </div>
                    {isImage ? (
                      <div className="h-52 w-full border border-gray-300 bg-white overflow-hidden flex items-center justify-center rounded">
                        <img
                          src={file.file_url}
                          alt={file.notes || file.original_file_name}
                          className="max-h-full max-w-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="h-52 w-full border border-gray-300 bg-white flex flex-col items-center justify-center gap-2 text-gray-500 rounded">
                        <FileText className="h-10 w-10 text-gray-400" />
                        <span className="text-xs font-semibold">Non-image Document</span>
                        <span className="text-[10px] font-mono text-gray-400 max-w-[180px] truncate">
                          {file.original_file_name}
                        </span>
                        <span className="text-[9px] text-gray-400">
                          See physical file or digital copy
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-between items-end border-t border-gray-300 pt-4">
              <div>
                <div className="h-12 w-44 border-b-2 border-gray-400 mb-1" />
                <div className="text-[10px] text-gray-600">Document Verification Officer</div>
              </div>
              <div className="text-right text-[9px] text-gray-400">
                <div>Page 2 of 2 — KYC Proofs</div>
                <div>{firm.shopName} · Confidential</div>
              </div>
            </div>
            <AvsPrintFooter />
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Loading document attachments...
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCell({
  label,
  value,
  className = "",
}: {
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={`px-3 py-2 ${className}`}>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-gray-900 mt-0.5">
        {value || <span className="text-gray-400 font-normal">—</span>}
      </div>
    </div>
  );
}
