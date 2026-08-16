/**
 * Supabase-backed hardware device registry — branch/workstation assignments.
 */
import { useCallback, useEffect, useState } from "react";
import { Panel, StatusBadge } from "@/components/design-system";
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
import {
  fetchHardwareDevices,
  upsertHardwareDevice,
  type HardwareDevice,
  type HardwareDeviceType,
} from "@/lib/hardware-devices-store";
import { useCurrentBranchId } from "@/lib/branch-store";
import { HardDrive, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const DEVICE_TYPES: { value: HardwareDeviceType; label: string }[] = [
  { value: "weighing_scale", label: "Weighing Scale" },
  { value: "barcode_scanner", label: "Barcode Scanner" },
  { value: "barcode_printer", label: "Barcode Printer" },
  { value: "label_printer", label: "Label Printer" },
  { value: "pos_printer", label: "POS / Thermal Printer" },
  { value: "a4_printer", label: "A4 Printer" },
  { value: "rfid_reader", label: "RFID Reader" },
  { value: "camera", label: "Camera" },
];

export function HardwareDevicesRegistry() {
  const branchId = useCurrentBranchId();
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [deviceType, setDeviceType] = useState<HardwareDeviceType>("weighing_scale");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchHardwareDevices(branchId ?? undefined);
    setDevices(list);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd() {
    if (!name.trim()) {
      toast.error("Device name is required");
      return;
    }
    setSaving(true);
    const created = await upsertHardwareDevice({
      name: name.trim(),
      deviceType,
      branchId: branchId ?? undefined,
      isDefault: devices.length === 0,
    });
    setSaving(false);
    if (created) {
      toast.success("Device registered");
      setName("");
      void load();
    } else {
      toast.error("Failed to register device");
    }
  }

  return (
    <Panel
      title="Registered Devices"
      description="Tenant-scoped hardware registry stored in Supabase. Assign devices to this branch or use globally."
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label className="text-xs">Device Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Front Counter Scale"
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Type</Label>
            <Select
              value={deviceType}
              onValueChange={(v) => setDeviceType(v as HardwareDeviceType)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={() => void handleAdd()} disabled={saving} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Register Device
        </Button>

        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            No devices registered for this branch yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-sm border border-border">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.deviceType.replace(/_/g, " ")} · {d.connectionType}
                    {d.isDefault ? " · default" : ""}
                  </p>
                </div>
                <StatusBadge
                  tone={d.status === "online" ? "success" : d.isActive ? "neutral" : "warning"}
                  label={d.status}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
