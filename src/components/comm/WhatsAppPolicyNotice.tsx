import { useCommunicationPolicy } from "@/hooks/use-communication-policy";

export function WhatsAppPolicyNotice() {
  const policy = useCommunicationPolicy();
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
      <p>
        Official WhatsApp API:{" "}
        <strong>{policy.whatsapp_api_enabled ? "ON" : "OFF"}</strong>
        {" · "}
        Legacy PHP send:{" "}
        <strong>{policy.legacy_whatsapp_php_enabled ? "ON" : "OFF"}</strong>
        {" · "}
        WhatsApp credits:{" "}
        <strong>{policy.whatsapp_credits_enabled ? "ON" : "OFF"}</strong>
      </p>
      {!policy.whatsapp_api_enabled && (
        <p className="text-muted-foreground">
          Automatic notifications go by Email. Use Share on a document to send it through WhatsApp
          on this device. Configuration below stays ready for when Platform Owner turns the API on.
        </p>
      )}
      {policy.whatsapp_api_enabled && (
        <p className="text-muted-foreground">
          Automated WhatsApp templates may send when this tenant is fully configured. Native Share
          remains available and never deducts credits.
        </p>
      )}
    </div>
  );
}
