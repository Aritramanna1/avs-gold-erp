import { useEffect, useState } from "react";
import { Panel } from "@/components/design-system";
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
  fetchOptIns,
  upsertOptIn,
  type WhatsAppOptIn,
} from "@/lib/comm/whatsapp/whatsapp-opt-in-store";
import { usePeople } from "@/lib/people-store";
import { Badge } from "@/components/ui/badge";

export function WhatsAppOptInManager() {
  const [optIns, setOptIns] = useState<WhatsAppOptIn[]>([]);
  const [phone, setPhone] = useState("");
  const [partyId, setPartyId] = useState("");
  const people = usePeople((s) => s.people);

  const load = async () => setOptIns(await fetchOptIns());
  useEffect(() => {
    void load();
  }, []);

  async function handleRecord(status: "opted_in" | "opted_out") {
    if (!phone.trim()) return;
    await upsertOptIn({
      phone: phone.trim(),
      partyId: partyId || undefined,
      status,
      source: "manual_erp",
      purpose: "marketing_and_service",
    });
    setPhone("");
    void load();
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Panel
        title="WhatsApp Consent (Opt-in)"
        description="Meta requires documented opt-in before template messages. Campaign audience builder excludes non-opted contacts automatically."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91…"
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Link to Party (optional)</Label>
            <Select value={partyId} onValueChange={setPartyId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select party" />
              </SelectTrigger>
              <SelectContent>
                {people.slice(0, 100).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={() => void handleRecord("opted_in")}>
            Record Opt-in
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleRecord("opted_out")}>
            Record Opt-out
          </Button>
        </div>
      </Panel>

      <Panel title="Consent Registry">
        <ul className="divide-y divide-border text-sm max-h-80 overflow-y-auto">
          {optIns.map((o) => (
            <li key={o.id} className="py-2 flex justify-between items-center gap-2">
              <div>
                <p className="font-mono text-xs">{o.phoneE164}</p>
                <p className="text-[10px] text-muted-foreground">{o.source ?? "—"}</p>
              </div>
              <Badge variant={o.status === "opted_in" ? "default" : "secondary"}>{o.status}</Badge>
            </li>
          ))}
          {optIns.length === 0 && (
            <li className="py-4 text-xs text-muted-foreground">No consent records yet.</li>
          )}
        </ul>
      </Panel>
    </div>
  );
}
