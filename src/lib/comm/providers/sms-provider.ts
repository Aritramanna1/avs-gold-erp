import type {
  CommProvider,
  CommResult,
  ProviderConfig,
  ResolvedContent,
  CommRequest,
} from "../types";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

/** SMS delivery always crosses the server relay; provider credentials never enter this bundle. */
export class SmsProvider implements CommProvider {
  readonly name: string;
  readonly capabilities = {
    channels: ["sms"] as const,
    templates: [] as const,
    isApiDelivery: true,
  };
  private config!: ProviderConfig;
  constructor(private readonly providerType: ProviderConfig["providerType"]) {
    this.name = `SMS (${providerType.replace("sms_", "").toUpperCase()})`;
  }
  configure(config: ProviderConfig) {
    this.config = config;
  }
  async send(req: CommRequest, content: ResolvedContent): Promise<CommResult> {
    if (!req.recipient.phone)
      return {
        success: false,
        provider: this.providerType,
        channel: "sms",
        error: "Recipient phone is required.",
        status: "failed",
      };
    const { data, error } = await (supabase as any).functions.invoke("send-sms", {
      body: {
        branchId: req.branchId,
        phone: req.recipient.phone,
        message: content.textBody ?? `${req.template} notification`,
        providerType: this.config.providerType,
      },
    });
    return {
      success: !error && data?.ok === true,
      provider: this.providerType,
      channel: "sms",
      messageId: data?.messageId,
      error: error?.message || data?.error,
      status: error || data?.ok !== true ? "failed" : "queued",
    };
  }
}
