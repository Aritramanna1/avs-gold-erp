/**
 * Tenant Email Accounts — non-secret configuration (credentials stay in comm_provider_secrets).
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import type { AvsProductId } from "./communication-events";

export type TenantEmailProviderType =
  | "email_smtp"
  | "email_google_workspace"
  | "email_resend"
  | "email_sendgrid"
  | "email_ses"
  | "email_mailgun";

export interface TenantEmailAccount {
  id: string;
  firmId: string;
  productId?: AvsProductId;
  branchId?: string;
  displayName?: string;
  fromEmail: string;
  replyTo?: string;
  providerType: TenantEmailProviderType;
  providerSettings: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
  lastTestAt?: string;
  lastTestStatus?: string;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): TenantEmailAccount {
  return {
    id: String(row.id),
    firmId: String(row.firm_id),
    productId: row.product_id ? (String(row.product_id) as AvsProductId) : undefined,
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    displayName: row.display_name ? String(row.display_name) : undefined,
    fromEmail: String(row.from_email),
    replyTo: row.reply_to ? String(row.reply_to) : undefined,
    providerType: String(row.provider_type) as TenantEmailProviderType,
    providerSettings: (row.provider_settings ?? {}) as Record<string, unknown>,
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
    lastTestAt: row.last_test_at ? String(row.last_test_at) : undefined,
    lastTestStatus: row.last_test_status ? String(row.last_test_status) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function fetchTenantEmailAccounts(opts?: {
  firmId?: string;
}): Promise<TenantEmailAccount[]> {
  let query = supabase
    .from("tenant_email_accounts" as never)
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts?.firmId) query = query.eq("firm_id", opts.firmId);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRow);
}

export async function upsertTenantEmailAccount(input: {
  id?: string;
  fromEmail: string;
  displayName?: string;
  replyTo?: string;
  providerType: TenantEmailProviderType;
  providerSettings?: Record<string, unknown>;
  isDefault?: boolean;
  isActive?: boolean;
  productId?: AvsProductId;
  branchId?: string;
}): Promise<TenantEmailAccount | null> {
  const payload = {
    from_email: input.fromEmail,
    display_name: input.displayName ?? null,
    reply_to: input.replyTo ?? null,
    provider_type: input.providerType,
    provider_settings: input.providerSettings ?? {},
    is_default: input.isDefault ?? false,
    is_active: input.isActive ?? true,
    product_id: input.productId ?? null,
    branch_id: input.branchId ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("tenant_email_accounts" as never)
      .update(payload as never)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("tenant_email_accounts" as never)
    .insert(payload as never)
    .select("*")
    .single();
  if (error || !data) return null;
  return mapRow(data as Record<string, unknown>);
}

export async function deleteTenantEmailAccount(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("tenant_email_accounts" as never)
    .delete()
    .eq("id", id);
  return !error;
}
