import { useMemo } from "react";
import { useLedger } from "@/lib/ledger-store";
import {
  formatVaultGoldStockLabel,
  vaultGoldPurityOptionsForIssue,
  type VaultGoldPurityLine,
} from "@/lib/vault-gold-stock";
import { cn } from "@/lib/utils";

type VaultGoldStockSelectProps = {
  value: string;
  onChange: (lineId: string, line: VaultGoldPurityLine | null) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** When set, only show this purity (read-only display of stock). */
  lockPurityPermille?: number;
};

/**
 * Pick gold to issue from live Gold Vault stock (one row per purity, aggregated balance).
 */
export function VaultGoldStockSelect({
  value,
  onChange,
  className,
  disabled,
  placeholder = "-- Select vault gold stock --",
  lockPurityPermille,
}: VaultGoldStockSelectProps) {
  const entries = useLedger((s) => s.entries);
  const lines = useMemo(() => {
    const all = vaultGoldPurityOptionsForIssue(entries);
    if (lockPurityPermille == null) return all;
    return all.filter((l) => l.purity === Math.round(lockPurityPermille));
  }, [entries, lockPurityPermille]);

  return (
    <div className="space-y-1">
      <select
        value={value}
        disabled={disabled || lines.length === 0}
        data-testid="vault-gold-stock-select"
        onChange={(e) => {
          const id = e.target.value;
          const line = lines.find((l) => l.id === id) ?? null;
          onChange(id, line);
        }}
        className={cn(
          "w-full h-9 rounded-md border border-input bg-background px-2 text-xs font-mono",
          className,
        )}
      >
        <option value="">{lines.length === 0 ? "No gold in vault" : placeholder}</option>
        {lines.map((line) => (
          <option key={line.id} value={line.id}>
            {formatVaultGoldStockLabel(line)}
          </option>
        ))}
      </select>
      {lines.length === 0 ? (
        <p className="text-[11px] text-amber-700">
          No gold in Gold Vault yet. Post opening balances or receive metal first.
        </p>
      ) : null}
    </div>
  );
}

export function VaultGoldStockHint({ line }: { line: VaultGoldPurityLine | null }) {
  if (!line) return null;
  return (
    <p className="text-[11px] font-mono text-muted-foreground">
      Vault stock: {formatVaultGoldStockLabel(line)}
    </p>
  );
}
