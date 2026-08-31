/**
 * Per-device Sound Effects ON/OFF — Settings and Customization.
 */
import { Volume2, VolumeX } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUiSoundPreference } from "@/lib/ui-sound-preference-store";
import { emitUiFeedback } from "@/lib/ui-feedback";

export function SoundEffectsPanel() {
  const enabled = useUiSoundPreference((s) => s.enabled);
  const setEnabled = useUiSoundPreference((s) => s.setEnabled);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-w-2xl">
      <div className="flex items-center gap-2 text-gold">
        {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        <h2 className="font-serif text-lg">Sound effects</h2>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Short confirmation chimes after a save, payment, invoice, gold posting, manufacturing
        completion, sync, or successful scan is confirmed. Failures use a quieter alert. Taps and
        navigation stay silent. This device keeps its own preference. System silent mode and
        browser autoplay rules are respected.
      </p>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
        <div>
          <div className="text-sm font-medium">Sound effects</div>
          <div className="text-[11px] text-muted-foreground">{enabled ? "On" : "Off"}</div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(next) => {
            setEnabled(next);
            if (next) emitUiFeedback("save");
          }}
          aria-label="Toggle sound effects"
        />
      </div>
    </div>
  );
}
