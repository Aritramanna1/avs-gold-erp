import { useSettings } from "@/lib/settings-store";

export function PrintHeader({
  title,
  recordBranchId,
}: {
  title?: string;
  recordBranchId?: string;
}) {
  const { firm, branches, selectedBranchId } = useSettings();

  // Find the branch - resolve from recordBranchId, or currently selected branch, or fallback
  const resolvedBranchId = recordBranchId || selectedBranchId || "MAIN";
  const branch = branches.find((b) => b.id === resolvedBranchId) || branches[0];

  const address = branch && branch.address ? branch.address : firm.address;
  const phone = branch && branch.phone ? branch.phone : firm.phone;
  const gstin = branch && branch.gstin ? branch.gstin : firm.gstin;

  return (
    <div
      className="text-center border-b border-black/30 pb-3 mb-6 font-sans text-neutral-800"
      id="mtj-print-header"
    >
      <div className="text-2xl font-serif font-semibold tracking-wide text-black">
        {firm.shopName.toUpperCase()}
      </div>
      {branch && branch.id !== "MAIN" && (
        <div className="text-xs font-semibold text-gray-700 mt-0.5">({branch.name})</div>
      )}
      <div className="text-xs text-gray-600 mt-1 space-y-0.5">
        {address && <div>{address}</div>}
        {phone && <div>Tel / Mob: {phone}</div>}
        {gstin && (
          <div className="font-mono text-[11px] font-bold tracking-wider">GSTIN: {gstin}</div>
        )}
      </div>
      {title && (
        <div className="text-xs font-serif font-bold uppercase tracking-wider text-black mt-3 bg-black/5 py-1.5 max-w-xs mx-auto rounded">
          {title}
        </div>
      )}
    </div>
  );
}
