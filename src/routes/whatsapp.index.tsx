import { createFileRoute } from "@tanstack/react-router";
import { guardRoute } from "@/lib/permissions";
import { z } from "zod";
import { WhatsAppWorkspace } from "@/components/whatsapp/WhatsAppWorkspace";

const SearchSchema = z.object({
  tab: z.string().optional(),
  conversation: z.string().optional(),
  phone: z.string().optional(),
});

export const Route = createFileRoute("/whatsapp/")({
  validateSearch: (s) => SearchSchema.parse(s),
  beforeLoad: ({ location }) => guardRoute(location.pathname),
  head: () => ({ meta: [{ title: "WhatsApp · AVS Communication Platform" }] }),
  component: WhatsAppWorkspace,
});
