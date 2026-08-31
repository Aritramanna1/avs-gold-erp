/**
 * Email template library — system + tenant customizations with versioning.
 */
import { dataProvider as supabase } from "@/lib/providers/data-provider";
import {
  EMAIL_TEMPLATE_CATALOG,
  isPlatformEmailTemplateKey,
  renderPlaceholderEmailTemplate,
  type EmailTemplateType,
  type EmailTemplateVariables,
} from "../email-templates";
import { sanitizeEmailHtml } from "@/lib/sanitize-html";

export interface EmailTemplateRecord {
  id: string;
  templateKey: string;
  name: string;
  eventKey?: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate?: string;
  isSystem: boolean;
  isPublished: boolean;
  version: number;
  firmId?: string;
}

function mapRow(row: Record<string, unknown>): EmailTemplateRecord {
  return {
    id: String(row.id),
    templateKey: String(row.template_key),
    name: String(row.name),
    eventKey: row.event_key ? String(row.event_key) : undefined,
    subjectTemplate: String(row.subject_template),
    htmlTemplate: String(row.html_template),
    textTemplate: row.text_template ? String(row.text_template) : undefined,
    isSystem: Boolean(row.is_system),
    isPublished: Boolean(row.is_published),
    version: Number(row.version ?? 1),
    firmId: row.firm_id ? String(row.firm_id) : undefined,
  };
}

export async function fetchEmailTemplates(options?: {
  includePlatformTemplates?: boolean;
}): Promise<EmailTemplateRecord[]> {
  const { data, error } = await supabase
    .from("email_template_library" as never)
    .select("*")
    .order("name");
  if (error || !data) return [];
  const rows = (data as Record<string, unknown>[]).map(mapRow);
  if (options?.includePlatformTemplates === false) {
    return rows.filter((row) => !isPlatformEmailTemplateKey(row.templateKey));
  }
  return rows;
}

export async function seedSystemEmailTemplatesIfEmpty(): Promise<number> {
  return seedSystemEmailTemplates();
}

/** Upserts published system templates with {{placeholders}}, even if some rows already exist. */
export async function seedSystemEmailTemplates(): Promise<number> {
  const rows = EMAIL_TEMPLATE_CATALOG.map((t) => {
    const rendered = renderPlaceholderEmailTemplate(t.key as EmailTemplateType);
    return {
      id: `system_${t.key}`,
      product_id: "ORNEXA",
      template_key: t.key,
      name: t.name,
      subject_template: rendered.subject,
      html_template: rendered.html,
      text_template: rendered.text,
      is_system: true,
      is_published: true,
      version: 1,
      variables: ["recipient_name", "tenant_name", "action_url", "document_number", "amount"],
    };
  });

  const { error } = await supabase.from("email_template_library" as never).upsert(rows as never, {
    onConflict: "id",
  });
  return error ? 0 : rows.length;
}

export async function publishEmailTemplateDraft(input: {
  id: string;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate?: string;
}): Promise<boolean> {
  const safeHtml = sanitizeEmailHtml(input.htmlTemplate);
  const { data: current } = await supabase
    .from("email_template_library" as never)
    .select("*")
    .eq("id", input.id)
    .single();
  if (!current) return false;
  const row = current as Record<string, unknown>;
  const nextVersion = Number(row.version ?? 1) + 1;

  await supabase.from("email_template_versions" as never).insert({
    template_id: input.id,
    firm_id: row.firm_id,
    version: nextVersion,
    subject_template: input.subjectTemplate,
    html_template: safeHtml,
    text_template: input.textTemplate ?? null,
    is_published: true,
  } as never);

  const { error } = await supabase
    .from("email_template_library" as never)
    .update({
      subject_template: input.subjectTemplate,
      html_template: safeHtml,
      text_template: input.textTemplate ?? null,
      version: nextVersion,
      is_published: true,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id);
  return !error;
}

export async function rollbackEmailTemplate(id: string, version: number): Promise<boolean> {
  const { data: ver } = await supabase
    .from("email_template_versions" as never)
    .select("*")
    .eq("template_id", id)
    .eq("version", version)
    .maybeSingle();
  if (!ver) return false;
  const v = ver as Record<string, unknown>;
  const { error } = await supabase
    .from("email_template_library" as never)
    .update({
      subject_template: v.subject_template,
      html_template: v.html_template,
      text_template: v.text_template,
      version: version,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
  return !error;
}

export function previewTemplate(
  subjectTemplate: string,
  htmlTemplate: string,
  vars: EmailTemplateVariables,
): { subject: string; html: string } {
  const interpolate = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const map: Record<string, string> = {
        recipient_name: vars.recipientName,
        tenant_name: vars.firmName ?? "",
        product_name: vars.productName ?? "AVS ERP",
        action_url: vars.actionUrl ?? "#",
        document_number: vars.documentNumber ?? "",
        amount: vars.amountFormatted ?? "",
      };
      return map[key] ?? `{{${key}}}`;
    });
  return { subject: interpolate(subjectTemplate), html: interpolate(htmlTemplate) };
}

export async function resolvePublishedEmailTemplate(
  templateKey: EmailTemplateType,
  firmId?: string,
): Promise<{
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate?: string;
} | null> {
  if (firmId) {
    const { data: firmRow } = await supabase
      .from("email_template_library" as never)
      .select("subject_template,html_template,text_template,is_published")
      .eq("template_key", templateKey)
      .eq("firm_id", firmId)
      .eq("is_published", true)
      .maybeSingle();
    if (firmRow) {
      const row = firmRow as Record<string, unknown>;
      return {
        subjectTemplate: String(row.subject_template ?? ""),
        htmlTemplate: String(row.html_template ?? ""),
        textTemplate: row.text_template ? String(row.text_template) : undefined,
      };
    }
  }

  const { data: systemRow } = await supabase
    .from("email_template_library" as never)
    .select("subject_template,html_template,text_template,is_published")
    .eq("template_key", templateKey)
    .eq("is_system", true)
    .eq("is_published", true)
    .maybeSingle();
  if (!systemRow) return null;
  const row = systemRow as Record<string, unknown>;
  return {
    subjectTemplate: String(row.subject_template ?? ""),
    htmlTemplate: String(row.html_template ?? ""),
    textTemplate: row.text_template ? String(row.text_template) : undefined,
  };
}

export async function sendTestEmail(
  to: string,
  subject: string,
  html: string,
  branchId?: string,
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await (
    supabase as unknown as {
      functions: {
        invoke: (
          name: string,
          opts: { body: Record<string, unknown> },
        ) => Promise<{
          data: { error?: string } | null;
          error: { message: string } | null;
        }>;
      };
    }
  ).functions.invoke("send-email", { body: { to, subject, htmlBody: html, branchId } });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: String(data.error) };
  return { success: true };
}
