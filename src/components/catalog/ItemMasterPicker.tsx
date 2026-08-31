import { useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useItemMasters } from "@/lib/item-masters-store";
import { hasOrganizationFeature } from "@/lib/identity/feature-gate";

export interface ItemMasterSelection {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
  purity_stamp: string;
  default_touch_pct: number;
  hsn_code: string;
}

interface ItemMasterPickerProps {
  value?: string;
  onSelect: (item: ItemMasterSelection) => void;
  placeholder?: string;
  className?: string;
}

export function ItemMasterPicker({
  value,
  onSelect,
  placeholder = "Pick master item…",
  className,
}: ItemMasterPickerProps) {
  const entitled = hasOrganizationFeature("item_masters");
  const { items, load, hydrated } = useItemMasters();

  useEffect(() => {
    if (!entitled) return;
    if (!hydrated) void load();
  }, [entitled, hydrated, load]);

  const activeItems = useMemo(() => items.filter((i) => i.is_active), [items]);
  const selected = activeItems.find((i) => i.item_code === value || i.item_name === value);

  if (!entitled) return null;
  return (
    <Select
      value={selected?.item_code ?? ""}
      onValueChange={(code) => {
        const item = activeItems.find((i) => i.item_code === code);
        if (!item) return;
        onSelect({
          id: item.id,
          item_code: item.item_code,
          item_name: item.item_name,
          category: item.category,
          purity_stamp: item.purity_stamp,
          default_touch_pct: item.default_touch_pct,
          hsn_code: item.hsn_code,
        });
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {activeItems.map((item) => (
          <SelectItem key={item.id} value={item.item_code}>
            {item.item_code} — {item.item_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
