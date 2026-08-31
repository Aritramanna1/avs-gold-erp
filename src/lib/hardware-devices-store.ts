/**
 * Hardware Device Manager — Supabase-backed device registry.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export type HardwareDeviceType =
  | "barcode_scanner"
  | "barcode_printer"
  | "label_printer"
  | "rfid_reader"
  | "rfid_scanner"
  | "weighing_scale"
  | "pos_printer"
  | "a4_printer"
  | "customer_display"
  | "camera"
  | "signature_pad";

export interface HardwareDevice {
  id: string;
  firmId: string;
  branchId?: string;
  workstationId?: string;
  name: string;
  deviceType: HardwareDeviceType;
  providerAdapter: string;
  model?: string;
  connectionType: string;
  capabilities: string[];
  config: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
  status: string;
  lastSeenAt?: string;
}

function mapRow(row: Record<string, unknown>): HardwareDevice {
  return {
    id: String(row.id),
    firmId: String(row.firm_id),
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    workstationId: row.workstation_id ? String(row.workstation_id) : undefined,
    name: String(row.name),
    deviceType: String(row.device_type) as HardwareDeviceType,
    providerAdapter: String(row.provider_adapter ?? "generic"),
    model: row.model ? String(row.model) : undefined,
    connectionType: String(row.connection_type ?? "usb"),
    capabilities: Array.isArray(row.capabilities) ? (row.capabilities as string[]) : [],
    config: (row.config ?? {}) as Record<string, unknown>,
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    status: String(row.status ?? "unknown"),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : undefined,
  };
}

export async function fetchHardwareDevices(branchId?: string): Promise<HardwareDevice[]> {
  let query = supabase
    .from("hardware_devices" as never)
    .select("*")
    .eq("is_active", true)
    .order("name");
  if (branchId) query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function upsertHardwareDevice(input: {
  id?: string;
  name: string;
  deviceType: HardwareDeviceType;
  branchId?: string;
  providerAdapter?: string;
  connectionType?: string;
  isDefault?: boolean;
}): Promise<HardwareDevice | null> {
  const payload = {
    name: input.name,
    device_type: input.deviceType,
    branch_id: input.branchId ?? null,
    provider_adapter: input.providerAdapter ?? "generic",
    connection_type: input.connectionType ?? "usb",
    is_default: input.isDefault ?? false,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await supabase
      .from("hardware_devices" as never)
      .update(payload as never)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from("hardware_devices" as never)
    .insert(payload as never)
    .select("*")
    .single();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}
